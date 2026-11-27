// Ciclo de vida das pistas (#87, #88, #89; RF-40 a RF-45):
// - mestre cria, edita, remove, envia e recolhe pistas (`clue.create/update/delete/send/revoke`)
// - jogador a até 1 célula guarda pista visível do mapa (`clue.take`)
// - jogador que tem a pista apresenta ao grupo sem perdê-la (`clue.present`)
import {
  pertoDaPista,
  podeConduzirMesa,
  sobBreu,
  type EventoDaMesaSemSeq,
  type ItemDoInventario,
  type PistaComAlguem,
  type PistaNaMesa,
} from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) {
    throw new Recusa('Só o mestre mexe nas pistas.');
  }
}

function dentroDoMapa(x: number, y: number, largura: number, altura: number) {
  return {
    x: Math.min(largura, Math.max(0, x)),
    y: Math.min(altura, Math.max(0, y)),
  };
}

function itemDe(
  posse: PistaComAlguem,
  titulo: string,
  texto: string,
  imagem: string | null,
): ItemDoInventario {
  return {
    pistaId: posse.pistaId,
    personagemId: posse.personagemId,
    apresentada: posse.apresentada,
    em: posse.em,
    titulo,
    texto,
    imagem,
  };
}

export const tratadoresDePistas: Tratadores = {
  'clue.create'(ctx, { titulo, texto, imagem, tamanho, notaMestre, x, y, visivel, descoberta }) {
    exigirMestre(ctx);
    const mapa = exigirMapa(ctx);
    const pos = dentroDoMapa(x, y, mapa.largura, mapa.altura);
    const pista: PistaNaMesa = {
      id: novoId('pst'),
      titulo,
      texto,
      imagem: imagem ?? null,
      tamanho: tamanho ?? 1,
      notaMestre: notaMestre ?? '',
      x: pos.x,
      y: pos.y,
      visivel: visivel ?? false,
      descoberta: descoberta ?? false,
    };
    ctx.estado.pistas.push(pista);
    return [{ type: 'clue.changed', pistaId: pista.id, pista }];
  },

  'clue.update'(
    ctx,
    { pistaId, titulo, texto, imagem, tamanho, notaMestre, x, y, visivel, descoberta },
  ) {
    exigirMestre(ctx);
    const mapa = exigirMapa(ctx);
    const pista = ctx.estado.pistas.find((p) => p.id === pistaId);
    if (!pista) throw new Recusa('Essa pista não existe neste mapa.');

    const conteudoMudou =
      (titulo !== undefined && titulo !== pista.titulo) ||
      (texto !== undefined && texto !== pista.texto) ||
      (imagem !== undefined && imagem !== (pista.imagem ?? null));
    if (titulo !== undefined) pista.titulo = titulo;
    if (texto !== undefined) pista.texto = texto;
    if (imagem !== undefined) pista.imagem = imagem;
    if (tamanho !== undefined) pista.tamanho = tamanho;
    if (notaMestre !== undefined) pista.notaMestre = notaMestre;
    if (x !== undefined || y !== undefined) {
      const pos = dentroDoMapa(x ?? pista.x, y ?? pista.y, mapa.largura, mapa.altura);
      pista.x = pos.x;
      pista.y = pos.y;
    }
    if (visivel !== undefined) pista.visivel = visivel;
    if (descoberta !== undefined) pista.descoberta = descoberta;

    const eventos: EventoDaMesaSemSeq[] = [{ type: 'clue.changed', pistaId: pista.id, pista }];
    if (conteudoMudou) {
      const img = pista.imagem ?? null;
      for (const posse of ctx.estado.comAlguem) {
        if (posse.pistaId !== pista.id) continue;
        posse.titulo = pista.titulo;
        posse.texto = pista.texto;
        posse.imagem = img;
        eventos.push({
          type: 'clue.received',
          item: itemDe(posse, pista.titulo, pista.texto, img),
        });
      }
    }
    return eventos;
  },

  'clue.delete'(ctx, { pistaId }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const indice = ctx.estado.pistas.findIndex((p) => p.id === pistaId);
    if (indice === -1) throw new Recusa('Essa pista não existe neste mapa.');
    ctx.estado.pistas.splice(indice, 1);

    const eventos: EventoDaMesaSemSeq[] = [{ type: 'clue.changed', pistaId, pista: null }];
    const restantes: PistaComAlguem[] = [];
    for (const posse of ctx.estado.comAlguem) {
      if (posse.pistaId === pistaId) {
        eventos.push({ type: 'clue.revoked', pistaId, personagemId: posse.personagemId });
      } else {
        restantes.push(posse);
      }
    }
    ctx.estado.comAlguem = restantes;
    return eventos;
  },

  'clue.send'(ctx, { pistaId, personagemId }) {
    exigirMestre(ctx);
    const pista = ctx.estado.pistas.find((p) => p.id === pistaId);
    if (!pista) throw new Recusa('Essa pista não existe neste mapa.');
    if (!ctx.personagem(personagemId)) {
      throw new Recusa('Esse personagem não está neste caso.');
    }
    if (
      ctx.estado.comAlguem.some((c) => c.pistaId === pistaId && c.personagemId === personagemId)
    ) {
      return [];
    }
    const img = pista.imagem ?? null;
    const posse: PistaComAlguem = {
      pistaId,
      personagemId,
      apresentada: false,
      em: new Date().toISOString(),
      titulo: pista.titulo,
      texto: pista.texto,
      imagem: img,
    };
    ctx.estado.comAlguem.push(posse);
    return [{ type: 'clue.received', item: itemDe(posse, pista.titulo, pista.texto, img) }];
  },

  'clue.revoke'(ctx, { pistaId, personagemId }) {
    exigirMestre(ctx);
    const indice = ctx.estado.comAlguem.findIndex(
      (c) => c.pistaId === pistaId && c.personagemId === personagemId,
    );
    if (indice === -1) throw new Recusa('Esse personagem não está com esta pista.');
    ctx.estado.comAlguem.splice(indice, 1);
    return [{ type: 'clue.revoked', pistaId, personagemId }];
  },

  'clue.take'(ctx, { pistaId }) {
    if (podeConduzirMesa(ctx.quem, ctx.campanha)) {
      throw new Recusa('Só jogadores guardam pistas do mapa; envie pelo painel da pista.');
    }
    const mapa = exigirMapa(ctx);
    const pista = ctx.estado.pistas.find((p) => p.id === pistaId);
    if (!pista || !pista.visivel || sobBreu(ctx.estado.breu, pista)) {
      throw new Recusa('Essa pista não está visível neste mapa.');
    }

    const token = ctx.estado.tokens.find((t) => t.donoId === ctx.quem.id);
    if (!token) {
      throw new Recusa('Coloque seu token no mapa antes de pegar uma pista.');
    }
    const personagemId =
      token.personagemId ?? ctx.grupo().find((p) => p.donoId === ctx.quem.id)?.personagemId ?? null;
    if (!personagemId) {
      throw new Recusa('Escolha um personagem neste caso para guardar pistas.');
    }
    if (!pertoDaPista(token, pista, mapa.grade.celula)) {
      throw new Recusa(
        'Seu token está longe demais: chegue a até 1 célula da pista para guardá-la.',
      );
    }

    pista.visivel = false;
    pista.descoberta = true;

    const img = pista.imagem ?? null;
    let posse = ctx.estado.comAlguem.find(
      (c) => c.pistaId === pista.id && c.personagemId === personagemId,
    );
    if (!posse) {
      posse = {
        pistaId: pista.id,
        personagemId,
        apresentada: false,
        em: new Date().toISOString(),
        titulo: pista.titulo,
        texto: pista.texto,
        imagem: img,
      };
      ctx.estado.comAlguem.push(posse);
    } else {
      posse.titulo = pista.titulo;
      posse.texto = pista.texto;
      posse.imagem = img;
    }

    return [
      { type: 'clue.changed', pistaId: pista.id, pista },
      { type: 'clue.received', item: itemDe(posse, pista.titulo, pista.texto, img) },
    ];
  },

  'clue.present'(ctx, { pistaId }) {
    const ativoId = ctx.grupo().find((p) => p.donoId === ctx.quem.id)?.personagemId ?? null;
    const candidatos = ctx.estado.comAlguem.filter(
      (c) => c.pistaId === pistaId && ctx.personagem(c.personagemId)?.donoId === ctx.quem.id,
    );
    const posse =
      (ativoId ? candidatos.find((c) => c.personagemId === ativoId) : undefined) ?? candidatos[0];
    if (!posse) {
      throw new Recusa('Você não tem esta pista para apresentar ao grupo.');
    }
    if (posse.apresentada) {
      throw new Recusa('Esta pista já foi apresentada ao grupo.');
    }

    const pista = ctx.estado.pistas.find((p) => p.id === pistaId);
    const titulo = pista?.titulo ?? posse.titulo ?? 'Pista';
    const texto = pista?.texto ?? posse.texto ?? '';
    const imagem = pista !== undefined ? (pista.imagem ?? null) : (posse.imagem ?? null);
    posse.apresentada = true;
    posse.em = new Date().toISOString();
    posse.titulo = titulo;
    posse.texto = texto;
    posse.imagem = imagem;

    return [{ type: 'clue.presented', item: itemDe(posse, titulo, texto, imagem) }];
  },
};
