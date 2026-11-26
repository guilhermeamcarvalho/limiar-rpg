// Mesa ao vivo: o contrato único entre cliente e servidor (aba Arquitetura técnica, "Comandos e
// eventos"). O cliente manda um comando (`cmd`) e recebe a resposta pelo ack; o servidor valida,
// aplica e manda os eventos (`evt`) a cada pessoa da sala, filtrados pelo que ela pode ver.
// Comando novo? Entra aqui, no `esquemaComando`; o servidor recusa o que não estiver no contrato.
import { z } from 'zod';
import type { Papel } from '../permissoes.ts';
import { MAPAS_PRONTOS, NPCS_PRONTOS, PROPS_PRONTOS } from '../mesa/prontos.ts';
import type { PerfilOp2 } from './ficha-op2.ts';
import { esquemaPedidoDeTeste, esquemaTesteInformado, type RegistroDeTeste } from './teste-op2.ts';

/** O maior lado de um mapa depois do upload é 4096 px; a folga cobre token na borda. */
export const LIMITE_DO_MAPA = 8192;
/** Token de 1×1 a 3×3 células. */
export const TAMANHOS_DE_TOKEN = [1, 2, 3] as const;
/** Arquivo enviado pela rota de uploads: o hash do conteúdo, em WebP. */
export const NOME_DE_ARQUIVO = /^[0-9a-f]{64}\.webp$/;

const id = z.string().trim().min(1).max(40);
const coordenada = z
  .number({ error: 'A posição precisa ser um número.' })
  .min(0, { error: 'A posição não pode ser negativa.' })
  .max(LIMITE_DO_MAPA, { error: 'A posição está fora do mapa.' });

// A arte pronta do app (props, modelos de NPC e mapas) vem com o client; o servidor só guarda o id.
export type IdDePropPronto = (typeof PROPS_PRONTOS)[number]['id'];
export type IdDeNpcPronto = (typeof NPCS_PRONTOS)[number]['id'];
export type IdDeMapaPronto = (typeof MAPAS_PRONTOS)[number]['id'];
const IDS_DE_PROPS: ReadonlySet<string> = new Set(PROPS_PRONTOS.map((p) => p.id));
const IDS_DE_NPCS: ReadonlySet<string> = new Set(NPCS_PRONTOS.map((n) => n.id));
const IDS_DE_MAPAS: ReadonlySet<string> = new Set(MAPAS_PRONTOS.map((m) => m.id));
export const ehPropPronto = (imagem: string): imagem is IdDePropPronto => IDS_DE_PROPS.has(imagem);
export const ehNpcPronto = (imagem: string): imagem is IdDeNpcPronto => IDS_DE_NPCS.has(imagem);
export const ehMapaPronto = (imagem: string): imagem is IdDeMapaPronto => IDS_DE_MAPAS.has(imagem);
/** Arte que vem com o app (não é um arquivo enviado). */
export const ehImagemPronta = (imagem: string) =>
  ehPropPronto(imagem) || ehNpcPronto(imagem) || ehMapaPronto(imagem);
/** A imagem de um token: uma enviada ou um modelo de NPC (RF-19). */
const imagemDeToken = z.string().refine((v) => ehNpcPronto(v) || NOME_DE_ARQUIVO.test(v), {
  error: 'Use uma imagem enviada pelo app ou um modelo de NPC.',
});
/** A imagem de um prop: um dos prontos ou uma enviada pelo mestre. */
const imagemDeProp = z.string().refine((v) => ehPropPronto(v) || NOME_DE_ARQUIVO.test(v), {
  error: 'Use um prop pronto ou uma imagem enviada pelo app.',
});
const tamanhoDeToken = z
  .int({ error: 'O tamanho vai de 1 a 3.' })
  .min(1, { error: 'O tamanho vai de 1 a 3.' })
  .max(3, { error: 'O tamanho vai de 1 a 3.' });
const nomeCurto = z
  .string()
  .trim()
  .min(1, { error: 'Dê um nome.' })
  .max(60, { error: 'No máximo 60 caracteres.' });
const textoLongo = z.string().max(5000, { error: 'No máximo 5000 caracteres.' });

export const esquemaPonto = z.object({ x: coordenada, y: coordenada }).strict();
export type Ponto = z.infer<typeof esquemaPonto>;

/* ---------- Breu ---------- */

export const esquemaFormaDoBreu = z.discriminatedUnion(
  'tipo',
  [
    z
      .object({
        tipo: z.literal('retangulo'),
        x: coordenada,
        y: coordenada,
        largura: z.number().gt(0).max(LIMITE_DO_MAPA),
        altura: z.number().gt(0).max(LIMITE_DO_MAPA),
      })
      .strict(),
    z
      .object({
        tipo: z.literal('poligono'),
        pontos: z
          .array(esquemaPonto)
          .min(3, { error: 'Um polígono tem pelo menos 3 pontos.' })
          .max(200, { error: 'No máximo 200 pontos.' }),
      })
      .strict(),
  ],
  { error: 'Desenhe um retângulo ou um polígono.' },
);
export type FormaDoBreu = z.infer<typeof esquemaFormaDoBreu>;

/* ---------- Comandos (cliente → servidor) ---------- */

const comando = <T extends string, S extends z.ZodRawShape>(type: T, campos: S) =>
  z.object({ type: z.literal(type), ...campos }).strict();

/** Pelo menos um campo além de `type` e do id: um update vazio não faz sentido. */
const algumCampo = (chaveDoId: string) => (c: Record<string, unknown>) =>
  Object.keys(c).some((k) => k !== 'type' && k !== chaveDoId && c[k] !== undefined);
const NADA_PARA_MUDAR = { error: 'Diga o que mudar.' };

// Tokens: `x` e `y` são o centro do token, em pixels do mapa.
const tokenMove = comando('token.move', { tokenId: id, x: coordenada, y: coordenada });
const tokenDrag = comando('token.drag', { tokenId: id, x: coordenada, y: coordenada });
const tokenCreate = comando('token.create', {
  nome: nomeCurto,
  imagem: imagemDeToken.nullable().optional(),
  x: coordenada,
  y: coordenada,
  tamanho: tamanhoDeToken.optional(),
  oculto: z.boolean().optional(),
  /** O token de um personagem do caso; sem ele, é um NPC. */
  personagemId: id.nullable().optional(),
});
const tokenUpdate = comando('token.update', {
  tokenId: id,
  nome: nomeCurto.optional(),
  imagem: imagemDeToken.nullable().optional(),
  tamanho: tamanhoDeToken.optional(),
  oculto: z.boolean().optional(),
}).refine(algumCampo('tokenId'), NADA_PARA_MUDAR);
const tokenDelete = comando('token.delete', { tokenId: id });
/** "Trazer o grupo": os tokens dos personagens do grupo vão para perto deste ponto (os que faltam no mapa entram). */
const tokenGather = comando('token.gather', { x: coordenada, y: coordenada });

// Props: imagens sobre o mapa. `tamanho` em células, `rotacao` em graus.
const tamanhoDeProp = z.number().gt(0).max(20, { error: 'No máximo 20 células.' });
const rotacao = z.number().min(0).lt(360, { error: 'A rotação vai de 0 a 359 graus.' });
const propCreate = comando('prop.create', {
  imagem: imagemDeProp,
  x: coordenada,
  y: coordenada,
  tamanho: tamanhoDeProp.optional(),
  rotacao: rotacao.optional(),
});
const propUpdate = comando('prop.update', {
  propId: id,
  x: coordenada.optional(),
  y: coordenada.optional(),
  tamanho: tamanhoDeProp.optional(),
  rotacao: rotacao.optional(),
  travado: z.boolean().optional(),
  ordem: z.int().min(0).max(10_000).optional(),
}).refine(algumCampo('propId'), NADA_PARA_MUDAR);
const propDelete = comando('prop.delete', { propId: id });
/** Posição do prop durante o arrasto do mestre: não grava (como o token). */
const propDrag = comando('prop.drag', { propId: id, x: coordenada, y: coordenada });

// Breu: cobrir e revelar empilham formas; a última que contém o ponto decide.
const darknessAdd = comando('darkness.add', { forma: esquemaFormaDoBreu });
const darknessReveal = comando('darkness.reveal', { forma: esquemaFormaDoBreu });
const darknessRemove = comando('darkness.remove', {
  /** Uma forma só, ou `tudo` para limpar o breu inteiro. */
  formaId: id.optional(),
  tudo: z.literal(true).optional(),
}).refine((c) => (c.formaId === undefined) !== (c.tudo === undefined), {
  error: 'Diga qual área remover, ou remova tudo.',
});

// Névoa da Membrana: só visual, sobre o palco de todos. Não esconde nada nem barra movimento.
/** O nível vai de 0 (sem névoa) a 100 (a Membrana quase rasgando). */
export const NIVEL_MAXIMO_DA_NEVOA = 100;
const mistSet = comando('mist.set', {
  nivel: z
    .int({ error: 'O nível da névoa é um número inteiro.' })
    .min(0, { error: 'O nível da névoa vai de 0 a 100.' })
    .max(NIVEL_MAXIMO_DA_NEVOA, { error: 'O nível da névoa vai de 0 a 100.' }),
});

const mapActivate = comando('map.activate', { mapaId: id });

/** Ajuste da grade do mapa ativo: lado da célula e deslocamento, em pixels do mapa. */
export const esquemaGrade = z
  .object({
    celula: z
      .number({ error: 'O tamanho da célula precisa ser um número.' })
      .min(10, { error: 'A célula vai de 10 a 500 px.' })
      .max(500, { error: 'A célula vai de 10 a 500 px.' }),
    deslocamentoX: z.number().min(0).max(500, { error: 'O deslocamento vai de 0 a 500 px.' }),
    deslocamentoY: z.number().min(0).max(500, { error: 'O deslocamento vai de 0 a 500 px.' }),
  })
  .strict();
const mapGrid = comando('map.grid', { grade: esquemaGrade });

const roomUpdate = comando('room.update', {
  salaId: id,
  nome: nomeCurto.optional(),
  notasMestre: textoLongo.optional(),
}).refine(algumCampo('salaId'), NADA_PARA_MUDAR);

// Pistas (Fase 3).
const clueCreate = comando('clue.create', {
  titulo: nomeCurto,
  texto: textoLongo,
  notaMestre: textoLongo.optional(),
  x: coordenada,
  y: coordenada,
  visivel: z.boolean().optional(),
});
const clueUpdate = comando('clue.update', {
  pistaId: id,
  titulo: nomeCurto.optional(),
  texto: textoLongo.optional(),
  notaMestre: textoLongo.optional(),
  x: coordenada.optional(),
  y: coordenada.optional(),
  visivel: z.boolean().optional(),
  descoberta: z.boolean().optional(),
}).refine(algumCampo('pistaId'), NADA_PARA_MUDAR);
const clueDelete = comando('clue.delete', { pistaId: id });
const clueSend = comando('clue.send', { pistaId: id, personagemId: id });
const clueRevoke = comando('clue.revoke', { pistaId: id, personagemId: id });
const clueTake = comando('clue.take', { pistaId: id });
const cluePresent = comando('clue.present', { pistaId: id });

const diceRoll = comando('dice.roll', {
  /** Expressão simples, como `2d6+1` ou `d20`; o servidor confere e rola. */
  expressao: z.string().trim().min(1, { error: 'Diga o que rolar.' }).max(40),
  /** Só o mestre vê (e quem rolou). */
  secreta: z.boolean().optional(),
});

// Testes da ficha passando pela mesa: o mesmo pedido das rotas HTTP, com o personagem.
const testResolve = esquemaPedidoDeTeste.extend({
  type: z.literal('test.resolve'),
  personagemId: id,
});
const testReport = esquemaTesteInformado.extend({
  type: z.literal('test.report'),
  personagemId: id,
});

const poiInvestigate = comando('poi.investigate', { poiId: id });

const volume = z.number().min(0).max(1, { error: 'O volume vai de 0 a 1.' });
const audioPlay = comando('audio.play', { faixaId: id, volume: volume.optional() });
const audioStop = comando('audio.stop', {});
const audioVolume = comando('audio.volume', { volume });

const chatSend = comando('chat.send', {
  texto: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a mensagem.' })
    .max(2000, { error: 'No máximo 2000 caracteres.' }),
  /** Sussurro: só o destinatário (e o mestre) recebe. */
  para: id.optional(),
  /** Narração do mestre, na caixa própria. */
  narracao: z.boolean().optional(),
});

const roundEnd = comando('round.end', {});

export const esquemaComando = z.discriminatedUnion(
  'type',
  [
    tokenMove,
    tokenDrag,
    tokenCreate,
    tokenUpdate,
    tokenDelete,
    tokenGather,
    propCreate,
    propUpdate,
    propDelete,
    propDrag,
    darknessAdd,
    darknessReveal,
    darknessRemove,
    mistSet,
    mapActivate,
    mapGrid,
    roomUpdate,
    clueCreate,
    clueUpdate,
    clueDelete,
    clueSend,
    clueRevoke,
    clueTake,
    cluePresent,
    diceRoll,
    testResolve,
    testReport,
    poiInvestigate,
    audioPlay,
    audioStop,
    audioVolume,
    chatSend,
    roundEnd,
  ],
  { error: 'Comando desconhecido.' },
);

/** O que o cliente pode mandar (com os campos opcionais). Fora disso, não compila. */
export type ComandoDaMesa = z.input<typeof esquemaComando>;
/** O comando já validado, como o servidor usa. */
export type ComandoValidado = z.output<typeof esquemaComando>;
export type TipoDeComando = ComandoValidado['type'];
export const TIPOS_DE_COMANDO = esquemaComando.options.map(
  (o) => o.shape.type.value,
) as readonly TipoDeComando[];

/* ---------- Validação com motivo em português ---------- */

const ROTULOS: Record<string, string> = {
  type: 'tipo do comando',
  tokenId: 'token',
  propId: 'prop',
  formaId: 'área do breu',
  mapaId: 'mapa',
  salaId: 'sala',
  pistaId: 'pista',
  personagemId: 'personagem',
  poiId: 'ponto de interesse',
  faixaId: 'faixa',
};

function campoDe(caminho: readonly PropertyKey[]): string {
  const nome = caminho.filter((p) => typeof p === 'string').at(-1);
  if (nome === undefined) return 'comando';
  return ROTULOS[nome] ?? nome;
}

/** A mensagem que o Zod mostra quando o schema não define uma: sempre em português. */
function mensagemPadrao(problema: z.core.$ZodRawIssue): string {
  const campo = campoDe(problema.path ?? []);
  switch (problema.code) {
    case 'invalid_type':
      return problema.input === undefined
        ? `Falta o campo ${campo}.`
        : `O campo ${campo} está errado.`;
    case 'unrecognized_keys':
      return `Campo desconhecido: ${problema.keys.join(', ')}.`;
    case 'too_small':
    case 'too_big':
      return `O campo ${campo} está fora do limite.`;
    default:
      return `O campo ${campo} está errado.`;
  }
}

export type ValidacaoDeComando =
  { ok: true; comando: ComandoValidado } | { ok: false; motivo: string };

/** Confere o comando contra o contrato. Recusado, diz o primeiro problema em português. */
export function validarComando(entrada: unknown): ValidacaoDeComando {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, motivo: 'Comando inválido.' };
  }
  const resultado = esquemaComando.safeParse(entrada, { error: mensagemPadrao });
  if (resultado.success) return { ok: true, comando: resultado.data };
  return { ok: false, motivo: resultado.error.issues[0]?.message ?? 'Comando inválido.' };
}

/* ---------- Estado da mesa ---------- */

export type GradeDoMapa = z.infer<typeof esquemaGrade>;

/** Grade de um mapa recém-enviado: o mestre ajusta na mesa. */
export const GRADE_PADRAO: GradeDoMapa = { celula: 50, deslocamentoX: 0, deslocamentoY: 0 };

export interface MapaNaMesa {
  id: string;
  nome: string;
  imagem: string;
  largura: number;
  altura: number;
  grade: GradeDoMapa;
}

export interface TokenNaMesa {
  id: string;
  nome: string;
  imagem: string | null;
  /** Centro do token, em pixels do mapa. */
  x: number;
  y: number;
  tamanho: number;
  /** Oculto: só o mestre vê. */
  oculto: boolean;
  /** Sem personagem: é um NPC do mestre. */
  personagemId: string | null;
  /** O dono do personagem, que pode mover o token. Nulo nos NPCs. */
  donoId: string | null;
}

export interface PropNaMesa {
  id: string;
  imagem: string;
  x: number;
  y: number;
  tamanho: number;
  rotacao: number;
  travado: boolean;
  /** Camada: maior fica por cima. */
  ordem: number;
}

export interface AreaDoBreu {
  id: string;
  modo: 'cobrir' | 'revelar';
  forma: FormaDoBreu;
}

/** Sala do mapa (Fase 3). Nada dela vai para o jogador. */
export interface SalaNaMesa {
  id: string;
  nome: string;
  area: Ponto[];
  notasMestre: string;
}

/** Pista no mapa (Fase 3). */
export interface PistaNaMesa {
  id: string;
  titulo: string;
  texto: string;
  /** Nunca vai para o jogador. */
  notaMestre: string;
  x: number;
  y: number;
  /** Marcada como visível no mapa; oculta, o jogador nem sabe que existe. */
  visivel: boolean;
  /** Ainda não descoberta: o jogador vê só a tarja. */
  descoberta: boolean;
}

/** Quem tem cada pista (`clue_holders`). */
export interface PistaComAlguem {
  pistaId: string;
  personagemId: string;
  /** Apresentada ao grupo: todos passam a ver. */
  apresentada: boolean;
  /** ISO. */
  em: string;
}

export interface TrilhaTocando {
  faixaId: string;
  volume: number;
  /** ISO, no relógio do servidor: quem entra no meio começa do ponto certo. */
  iniciadaEm: string;
}

/** O estado completo de uma mesa, como o servidor guarda. O mestre recebe tudo. */
export interface EstadoDaMesa {
  mapa: MapaNaMesa | null;
  tokens: TokenNaMesa[];
  props: PropNaMesa[];
  breu: AreaDoBreu[];
  /** Névoa da Membrana, de 0 a 100: só visual, todos veem igual. */
  nevoa: number;
  salas: SalaNaMesa[];
  pistas: PistaNaMesa[];
  comAlguem: PistaComAlguem[];
  rodada: { numero: number };
  trilha: TrilhaTocando | null;
  /** Guia de cena e notas do escudo (Fase 3): nunca vão para o jogador. */
  guia: string;
  escudo: string;
}

export function estadoVazioDaMesa(): EstadoDaMesa {
  return {
    mapa: null,
    tokens: [],
    props: [],
    breu: [],
    nevoa: 0,
    salas: [],
    pistas: [],
    comAlguem: [],
    rodada: { numero: 1 },
    trilha: null,
    guia: '',
    escudo: '',
  };
}

/** Uma pista no mapa como o jogador recebe: sem a nota do mestre; não descoberta, só a tarja. */
export type PistaParaJogador =
  | { id: string; x: number; y: number; descoberta: false }
  | { id: string; x: number; y: number; descoberta: true; titulo: string; texto: string };

/** Uma pista na mão de alguém, com o conteúdo (sem a nota do mestre). */
export interface ItemDoInventario extends PistaComAlguem {
  titulo: string;
  texto: string;
}

/**
 * O que uma pessoa recebe da mesa. Para o mestre, é o estado inteiro; para o jogador, sem os
 * tokens que ele não vê, sem salas, guia e escudo, e com as pistas filtradas.
 */
export interface VisaoDaMesa {
  papel: Papel;
  mapa: MapaNaMesa | null;
  tokens: TokenNaMesa[];
  props: PropNaMesa[];
  breu: AreaDoBreu[];
  nevoa: number;
  pistas: (PistaNaMesa | PistaParaJogador)[];
  inventario: ItemDoInventario[];
  rodada: { numero: number };
  trilha: TrilhaTocando | null;
  /** Só o mestre. */
  salas?: SalaNaMesa[];
  guia?: string;
  escudo?: string;
}

/** Quem está na mesa agora. */
export interface PresencaNaMesa {
  id: string;
  nome: string;
  papel: Papel;
  personagemId: string | null;
}

/* ---------- Eventos (servidor → cliente) ---------- */

export type EventoDaMesaSemSeq =
  | { type: 'mesa.estado'; estado: VisaoDaMesa }
  | { type: 'presence.changed'; online: PresencaNaMesa[] }
  | { type: 'character.changed'; campanhaId: string; personagemId: string; removido: boolean }
  /** O mestre excluiu o caso: a mesa fecha para todos. */
  | EventoCasoExcluido
  | { type: 'token.moved'; tokenId: string; x: number; y: number }
  /** Posição durante o arrasto: não grava. */
  | { type: 'token.dragging'; tokenId: string; x: number; y: number }
  /** Criado, mudado ou (com `token: null`) removido; ou sumiu da vista de quem recebe. */
  | { type: 'token.changed'; tokenId: string; token: TokenNaMesa | null }
  | { type: 'prop.changed'; propId: string; prop: PropNaMesa | null }
  /** Posição do prop durante o arrasto: não grava. */
  | { type: 'prop.dragging'; propId: string; x: number; y: number }
  | { type: 'darkness.changed'; breu: AreaDoBreu[] }
  /** O mestre mudou o nível da névoa da Membrana. */
  | { type: 'mist.changed'; nivel: number }
  /** Troca de mapa: logo depois, cada um recebe um `mesa.estado` com o mapa novo inteiro. */
  | { type: 'map.activated'; mapa: MapaNaMesa | null }
  /** A grade do mapa ativo mudou. */
  | { type: 'map.changed'; mapa: MapaNaMesa }
  | { type: 'room.updated'; salaId: string; sala: SalaNaMesa | null }
  | { type: 'clue.changed'; pistaId: string; pista: PistaNaMesa | PistaParaJogador | null }
  | { type: 'clue.received'; item: ItemDoInventario }
  | { type: 'clue.revoked'; pistaId: string; personagemId: string }
  | { type: 'clue.presented'; item: ItemDoInventario }
  | {
      type: 'dice.rolled';
      autorId: string;
      expressao: string;
      dados: number[];
      total: number;
      secreta: boolean;
    }
  | { type: 'test.resolved'; registro: RegistroDeTeste }
  | { type: 'poi.infoRevealed'; poiId: string; personagemIds: string[]; texto: string }
  | { type: 'audio.changed'; trilha: TrilhaTocando | null }
  | {
      type: 'chat.message';
      id: string;
      autorId: string;
      texto: string;
      /** Sussurro: o destinatário. */
      para: string | null;
      narracao: boolean;
      /** ISO. */
      em: string;
    }
  | { type: 'round.started'; numero: number };

/** Todo evento leva o número de sequência da mesa: chegam e se aplicam nessa ordem. */
export type EventoDaMesa = EventoDaMesaSemSeq & { seq: number };
export type TipoDeEvento = EventoDaMesa['type'];

/** Vem de uma rota HTTP (DELETE /campanhas/:id) e vai para a sala antes de ela fechar. */
export interface EventoCasoExcluido {
  type: 'campaign.deleted';
  campanhaId: string;
}

/* ---------- Socket.IO ---------- */

export type RespostaDoComando = { ok: true } | { ok: false; motivo: string };

/** O que o cliente emite. Use como `Socket<EventosDoServidor, EventosDoCliente>`. */
export interface EventosDoCliente {
  cmd: (comando: ComandoDaMesa, responder: (resposta: RespostaDoComando) => void) => void;
}

/** O que o servidor emite. */
export interface EventosDoServidor {
  evt: (evento: EventoDaMesa) => void;
}

/** O que o cliente manda no handshake: `io({ auth: { campanhaId } })`. */
export interface AutenticacaoDaMesa {
  campanhaId: string;
}

/** Por que a conexão foi recusada: vem em `connect_error`, em `erro.data`. */
export interface RecusaDaConexao {
  codigo: 'NAO_AUTENTICADO' | 'CASO_NAO_ENCONTRADO' | 'ORIGEM_INVALIDA';
  mensagem: string;
}

/* ---------- Mapas do caso (rotas HTTP) ---------- */

/** O mapa enviado entra com até 20 MB. */
export const LIMITE_DO_MAPA_ENVIADO = 20 * 1024 * 1024;
/** Depois de convertido, o lado maior fica com no máximo 4096 px. */
export const LADO_MAXIMO_DO_MAPA = 4096;

/** Um mapa na lista do mestre (GET /api/campanhas/:id/mapas). */
export interface MapaDoCaso {
  id: string;
  nome: string;
  imagem: string;
  largura: number;
  altura: number;
  grade: GradeDoMapa;
  /** É o mapa que está na mesa agora. */
  ativo: boolean;
  /** ISO. */
  criadoEm: string;
}

/**
 * As imagens que a mesa recebe além do mapa: a de um token (vira 256 × 256; soltar sobre o mapa,
 * RF-24) e a de um prop (até 1024 px, com o fundo transparente; só o mestre).
 */
export const USOS_DE_IMAGEM_DA_MESA = ['token', 'prop'] as const;
export type UsoDeImagemDaMesa = (typeof USOS_DE_IMAGEM_DA_MESA)[number];

/* ---------- Registro da sessão (GET /api/campanhas/:id/registro) ---------- */

/** Personagem em uso no caso, para identificar autor, avatar e pistas na mesa. */
export interface PersonagemNaMesa {
  id: string;
  donoId: string;
  nome: string;
  perfil: PerfilOp2 | null;
}

export interface RespostaDoRegistro {
  eventos: EventoDaMesa[];
  personagens: PersonagemNaMesa[];
}
