// Conversa da sessão (artboard 10, #71 e #69): quatro formatos próprios — mensagem comum,
// narração do mestre em Special Elite, sussurro tracejado em dourado e cartão compacto de
// resultado (teste de perícia ou rolagem avulsa/secreta). Suporta `/r 2d6+1` e `/rs 2d6` e rola a
// lista até o fim apenas se a pessoa não estiver lendo mensagens antigas acima.
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import {
  lerExpressaoDeDados,
  nomeDaPericia,
  ErroDeRegra,
  type ComandoDaMesa,
  type EventoDaMesa,
  type Membro,
  type Papel,
  type PersonagemNaMesa,
  type RegistroDeTeste,
  type RespostaDoComando,
  type Veredito,
} from '@membrana/shared';
import { iniciais } from '../casos/formatos.ts';
import { primeiroNome, TOM_DO_PERFIL } from '../personagens/formatos.ts';
import {
  Avatar,
  Button,
  cx,
  Die,
  Icon,
  Input,
  Select,
  textoDoVeredito,
  type TipoDeDado,
} from '../ui/index.ts';

/** Distância máxima do rodapé (em px) em que a lista ainda acompanha novas mensagens sozinha. */
export const FOLGA_DO_FIM_PX = 48;

export type EntradaInterpretada =
  { ok: true; comando: ComandoDaMesa } | { ok: false; motivo: string };

/**
 * Converte o texto digitado no campo do chat em comando da mesa: `/r 2d6+1` vira `dice.roll`,
 * `/rs 2d6` vira `dice.roll` secreta e o resto vira `chat.send`.
 */
export function interpretarEntradaDoChat(
  bruto: string,
  opcoes: { para?: string; narracao?: boolean } = {},
): EntradaInterpretada {
  const texto = bruto.trim();
  if (!texto) return { ok: false, motivo: 'Escreva a mensagem.' };

  const cmdRolagem = /^\/(rs|r|rolar)(?:\s+(.*))?$/i.exec(texto);
  if (cmdRolagem) {
    const [, prefixo = 'r', expressaoBruta = ''] = cmdRolagem;
    const expressao = expressaoBruta.trim();
    if (!expressao) {
      return { ok: false, motivo: 'Diga o que rolar depois de /r, como /r 2d6+1.' };
    }
    try {
      const lida = lerExpressaoDeDados(expressao);
      const secreta = prefixo.toLowerCase() === 'rs';
      return {
        ok: true,
        comando: {
          type: 'dice.roll',
          expressao: lida.expressao,
          ...(secreta && { secreta: true }),
        },
      };
    } catch (erro) {
      if (erro instanceof ErroDeRegra) return { ok: false, motivo: erro.message };
      throw erro;
    }
  }

  return {
    ok: true,
    comando: {
      type: 'chat.send',
      texto,
      ...(opcoes.narracao ? { narracao: true } : opcoes.para ? { para: opcoes.para } : {}),
    },
  };
}

export type ItemDoChat = Extract<
  EventoDaMesa,
  { type: 'chat.message' | 'dice.rolled' | 'test.resolved' }
>;

export function filtrarEventosDoChat(eventos: readonly EventoDaMesa[]): ItemDoChat[] {
  return eventos.filter(
    (e): e is ItemDoChat =>
      e.type === 'chat.message' || e.type === 'dice.rolled' || e.type === 'test.resolved',
  );
}

function horarioCurto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const COR_DO_VEREDITO: Record<Veredito, { classe: string; cor: string }> = {
  sucesso: { classe: '', cor: 'green' },
  critico: { classe: 'crit', cor: 'gold' },
  falha: { classe: 'ko', cor: 'red' },
  falhaCritica: { classe: 'ko', cor: 'red' },
};

const DADOS_COM_FORMA: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20]);

function tipoDeDadoVisual(expressao: string): TipoDeDado {
  const achado = /d(\d+)/i.exec(expressao);
  const faces = Number(achado?.[1] ?? 6);
  return DADOS_COM_FORMA.has(faces) ? (`d${String(faces)}` as TipoDeDado) : 'd6';
}

function CartaoDeTesteNoChat({
  registro,
  papel,
  nomesDePersonagens,
}: {
  registro: RegistroDeTeste;
  papel: Papel;
  nomesDePersonagens: Readonly<Record<string, string>>;
}) {
  const v = COR_DO_VEREDITO[registro.resultado.veredito];
  const quem =
    registro.personagemNome ??
    nomesDePersonagens[registro.personagemId] ??
    registro.autor?.nome ??
    'Personagem';
  const origem =
    registro.origem === 'fisico'
      ? ' · dados físicos'
      : papel === 'mestre'
        ? ' · dados virtuais'
        : '';

  return (
    <div className={cx('rmsg', v.classe)}>
      <div className="row between">
        <b className="small">
          {quem} · {nomeDaPericia(registro.periciaId)}
        </b>
        <span className={cx('verdict', v.cor)}>{textoDoVeredito(registro.resultado.veredito)}</span>
      </div>
      <div className="row wrapx rmsg-dados">
        {registro.resultado.dados.map((d, i) => (
          <Die key={i} type={d.tipo} value={d.valor} role={d.papel} discarded={d.descartado} />
        ))}
        <span className="small muted">
          = {registro.resultado.total} contra DT {registro.resultado.dt}
          {origem}
        </span>
      </div>
    </div>
  );
}

function CartaoDeRolagemLivre({
  item,
  autorNome,
}: {
  item: Extract<EventoDaMesa, { type: 'dice.rolled' }>;
  autorNome: string;
}) {
  const forma = tipoDeDadoVisual(item.expressao);
  return (
    <div className={cx('rmsg', item.secreta && 'secreta')}>
      <div className="row between">
        <b className="small">
          {autorNome} · {item.expressao}
        </b>
        <span className={cx('verdict', item.secreta ? 'gold' : 'green')}>
          {item.secreta ? 'Secreta' : `Total ${String(item.total)}`}
        </span>
      </div>
      <div className="row wrapx rmsg-dados">
        {item.dados.map((valor, i) => (
          <Die key={i} type={forma} value={valor} role={item.secreta ? 'bonus' : 'pericia'} />
        ))}
        <span className="small muted">
          = {item.total}
          {item.secreta && ' · só o mestre vê'}
        </span>
      </div>
    </div>
  );
}

function autorEh(item: ItemDoChat | undefined, meuId: string): boolean {
  if (!item) return false;
  if (item.type === 'test.resolved') return item.registro.autor?.id === meuId;
  return item.autorId === meuId;
}

export interface ChatProps {
  eventos: readonly EventoDaMesa[];
  meuId: string;
  papel: Papel;
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
  meuPersonagemNome: string | null;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

export function Chat({
  eventos,
  meuId,
  papel,
  membros,
  personagens,
  meuPersonagemNome,
  enviar,
}: ChatProps) {
  const idCampo = useId();
  const [texto, setTexto] = useState('');
  const [para, setPara] = useState('');
  const [narracao, setNarracao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const listaRef = useRef<HTMLDivElement | null>(null);
  const pertoDoFimRef = useRef(true);
  const [lendoAcima, setLendoAcima] = useState(false);
  const [seqNoFim, setSeqNoFim] = useState(0);

  const itens = filtrarEventosDoChat(eventos);
  const ultimo = itens.at(-1);
  const ultimoSeq = ultimo?.seq ?? 0;

  const nomesDeUsuarios = Object.fromEntries(membros.map((m) => [m.id, m.nome]));
  const papeisDeUsuarios = Object.fromEntries(membros.map((m) => [m.id, m.papel]));
  const personagemDoUsuario = Object.fromEntries(personagens.map((p) => [p.donoId, p]));
  const nomesDePersonagens = Object.fromEntries(personagens.map((p) => [p.id, p.nome]));

  function autorDe(userId: string): {
    nome: string;
    iniciais: string;
    tom: 'red' | 'blue' | 'green' | 'gold' | 'none';
  } {
    const papelDoAutor = papeisDeUsuarios[userId];
    const pers = personagemDoUsuario[userId];
    if (papelDoAutor === 'mestre') {
      const nome = nomesDeUsuarios[userId] ?? 'Mestre';
      return { nome, iniciais: iniciais(nome) || 'M', tom: 'gold' };
    }
    if (pers) {
      const nome = primeiroNome(pers.nome) || pers.nome;
      return {
        nome,
        iniciais: iniciais(pers.nome) || '?',
        tom: pers.perfil ? TOM_DO_PERFIL[pers.perfil] : 'red',
      };
    }
    const nome = nomesDeUsuarios[userId] ?? 'Alguém';
    return { nome, iniciais: iniciais(nome) || '?', tom: 'none' };
  }

  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    if (pertoDoFimRef.current || autorEh(ultimo, meuId)) {
      el.scrollTop = el.scrollHeight;
      pertoDoFimRef.current = true;
    }
  }, [ultimoSeq, ultimo, meuId]);

  function aoRolarLista() {
    const el = listaRef.current;
    if (!el) return;
    const noFim = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLGA_DO_FIM_PX;
    pertoDoFimRef.current = noFim;
    setLendoAcima(!noFim);
    if (noFim) setSeqNoFim(ultimoSeq);
  }

  function irParaOFim() {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    pertoDoFimRef.current = true;
    setLendoAcima(false);
    setSeqNoFim(ultimoSeq);
  }

  async function submeter(e: SyntheticEvent) {
    e.preventDefault();
    if (enviando) return;
    const interpretado = interpretarEntradaDoChat(texto, {
      ...(para && { para }),
      ...(papel === 'mestre' && narracao && { narracao: true }),
    });
    if (!interpretado.ok) {
      setErro(interpretado.motivo);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const r = await enviar(interpretado.comando);
      if (!r.ok) {
        setErro(r.motivo);
        return;
      }
      setTexto('');
    } finally {
      setEnviando(false);
    }
  }

  const destinatarios = membros.filter((m) => m.id !== meuId);
  const temNovasAbaixo = lendoAcima && ultimoSeq > seqNoFim;
  const quemFala =
    papel === 'mestre'
      ? narracao
        ? 'Narre a cena…'
        : 'Fale com a mesa… (/r para rolar)'
      : meuPersonagemNome
        ? `Fale como ${primeiroNome(meuPersonagemNome) || meuPersonagemNome}… (/r para rolar)`
        : 'Mensagem… (/r para rolar)';

  return (
    <div className="chat-coluna">
      <div
        ref={listaRef}
        className="chat-lista"
        role="log"
        aria-live="polite"
        aria-label="Mensagens do chat"
        onScroll={aoRolarLista}
      >
        {itens.length === 0 ? (
          <p className="small muted chat-vazio">
            Nenhuma mensagem ainda. Escreva abaixo ou use <code>/r 2d6</code> para rolar dados.
          </p>
        ) : (
          itens.map((item) => {
            if (item.type === 'test.resolved') {
              return (
                <CartaoDeTesteNoChat
                  key={item.seq}
                  registro={item.registro}
                  papel={papel}
                  nomesDePersonagens={nomesDePersonagens}
                />
              );
            }
            if (item.type === 'dice.rolled') {
              return (
                <CartaoDeRolagemLivre
                  key={item.seq}
                  item={item}
                  autorNome={autorDe(item.autorId).nome}
                />
              );
            }
            if (item.narracao) {
              return (
                <div key={item.seq} className="narr">
                  {item.texto}
                </div>
              );
            }
            const autor = autorDe(item.autorId);
            if (item.para !== null) {
              const dest = autorDe(item.para).nome;
              const rotulo =
                item.para === meuId
                  ? `${autor.nome} · só para você`
                  : item.autorId === meuId
                    ? `Você para ${dest} · sussurro`
                    : `${autor.nome} para ${dest} · sussurro`;
              return (
                <div key={item.seq} className="msg sussurro">
                  <Avatar initials={autor.iniciais} name={autor.nome} tone={autor.tom} size="sm" />
                  <div className="msg-corpo">
                    <b className="gold">{rotulo}</b>{' '}
                    <span className="small muted">{horarioCurto(item.em)}</span>
                    <p>{item.texto}</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={item.seq} className="msg">
                <Avatar initials={autor.iniciais} name={autor.nome} tone={autor.tom} size="sm" />
                <div className="msg-corpo">
                  <b>{autor.nome}</b> <span className="small muted">{horarioCurto(item.em)}</span>
                  <p>{item.texto}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {temNovasAbaixo && (
        <button type="button" className="chat-novas small" onClick={irParaOFim}>
          Novas mensagens abaixo
        </button>
      )}

      <form className="chat-form" onSubmit={(e) => void submeter(e)} noValidate>
        {(papel === 'mestre' || destinatarios.length > 0) && (
          <div className="row chat-modos">
            {papel === 'mestre' && (
              <button
                type="button"
                className={cx('chip chat-modo', narracao && 'on')}
                aria-pressed={narracao}
                onClick={() => {
                  setNarracao((n) => {
                    const novo = !n;
                    if (novo) setPara('');
                    return novo;
                  });
                }}
              >
                Narrar
              </button>
            )}
            {destinatarios.length > 0 && !narracao && (
              <Select
                aria-label="Destinatário"
                className="chat-destino"
                value={para}
                onChange={(e) => {
                  setPara(e.target.value);
                }}
              >
                <option value="">Para todos</option>
                {destinatarios.map((m) => (
                  <option key={m.id} value={m.id}>
                    Sussurrar para {m.nome}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        {erro && (
          <p className="err chat-erro" role="alert">
            <Icon name="alert" size="sm" />
            <span>{erro}</span>
          </p>
        )}

        <div className="row chat-envio">
          <label htmlFor={idCampo} className="sr-only">
            Mensagem
          </label>
          <Input
            id={idCampo}
            value={texto}
            maxLength={2000}
            placeholder={quemFala}
            onChange={(e) => {
              setTexto(e.target.value);
              if (erro) setErro(null);
            }}
          />
          <Button
            type="submit"
            variant="primary"
            icon={<Icon name="send" />}
            aria-label="Enviar"
            disabled={enviando}
          />
        </div>
      </form>
    </div>
  );
}
