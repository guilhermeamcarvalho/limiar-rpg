// Configuração de um sistema de jogo, guardada em game_systems.config.
// Ordem Paranormal II tem regras em código (shared/regras/op2); RPG inventado é só configuração.
// Referência: docs/regras-do-jogo.md.
import { z } from 'zod';

export const DADOS = ['d4', 'd6', 'd8', 'd10', 'd12'] as const;
export const esquemaDado = z.enum(DADOS);

const idCurto = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, { error: 'use minúsculas, números e hífen, como "fisico"' });

const esquemaAtributo = z.object({ id: idCurto, nome: z.string().min(1) });

/** Recurso como PV e PD: base mais o valor máximo dos dados de alguns atributos. */
const esquemaRecurso = z.object({
  nome: z.string().min(1),
  base: z.int().min(0),
  somaMaximoDe: z.array(idCurto),
});

function semRepetir(lista: { id: string }[]) {
  return new Set(lista.map((item) => item.id)).size === lista.length;
}

export const esquemaConfigOp2 = z
  .object({
    versao: z.literal(1),
    dados: z.array(esquemaDado).min(1),
    atributos: z.array(esquemaAtributo).min(1),
    pericias: z.array(esquemaAtributo.extend({ atributo: idCurto })).min(1),
    recursos: z.object({ pv: esquemaRecurso, pd: esquemaRecurso }),
    dtPadrao: z.int().min(1),
  })
  .superRefine((config, ctx) => {
    const atributos = new Set(config.atributos.map((a) => a.id));
    if (!semRepetir(config.atributos))
      ctx.addIssue({ code: 'custom', path: ['atributos'], message: 'atributo repetido' });
    if (!semRepetir(config.pericias))
      ctx.addIssue({ code: 'custom', path: ['pericias'], message: 'perícia repetida' });
    config.pericias.forEach((pericia, i) => {
      if (!atributos.has(pericia.atributo))
        ctx.addIssue({
          code: 'custom',
          path: ['pericias', i, 'atributo'],
          message: `"${pericia.nome}" aponta para o atributo "${pericia.atributo}", que não existe`,
        });
    });
    for (const nome of ['pv', 'pd'] as const) {
      for (const id of config.recursos[nome].somaMaximoDe) {
        if (!atributos.has(id))
          ctx.addIssue({
            code: 'custom',
            path: ['recursos', nome, 'somaMaximoDe'],
            message: `atributo "${id}" não existe`,
          });
      }
    }
  });

/** RPG inventado: os quatro campos que o mestre preenche ao criar o caso. */
export const esquemaConfigInventado = z.object({
  versao: z.literal(1),
  dadoPrincipal: z.enum(['1d20', '2d6', '1d100', 'parada-d6']),
  atributos: z.array(z.string().min(1)).min(1),
  regrasDaCasa: z.string(),
});

export type ConfigOp2 = z.infer<typeof esquemaConfigOp2>;
export type ConfigInventado = z.infer<typeof esquemaConfigInventado>;
export type ConfigDeSistema = ConfigOp2 | ConfigInventado;

/** Valida o config conforme o tipo do sistema. */
export function esquemaDoConfig(tipo: 'op2' | 'inventado') {
  return tipo === 'op2' ? esquemaConfigOp2 : esquemaConfigInventado;
}

/* ---------- Ordem Paranormal II ---------- */

export const ID_OP2 = 'sys_op2';

const pericia = (nome: string, atributo: string) => ({
  id: nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase(),
  nome,
  atributo,
});

export const CONFIG_OP2: ConfigOp2 = {
  versao: 1,
  dados: [...DADOS],
  atributos: [
    { id: 'fisico', nome: 'Físico' },
    { id: 'mente', nome: 'Mente' },
    { id: 'emocao', nome: 'Emoção' },
  ],
  pericias: [
    ...['Acrobacia', 'Atletismo', 'Crime', 'Furtividade', 'Luta', 'Pontaria', 'Vigor'].map((p) =>
      pericia(p, 'fisico'),
    ),
    ...[
      'Aptidão',
      'Máquinas',
      'Medicina',
      'Ocultismo',
      'Percepção',
      'Pesquisa',
      'Sobrevivência',
      'Tecnologia',
    ].map((p) => pericia(p, 'mente')),
    ...['Disciplina', 'Enganação', 'Intimidação', 'Intuição', 'Persuasão'].map((p) =>
      pericia(p, 'emocao'),
    ),
  ],
  recursos: {
    pv: { nome: 'PV', base: 4, somaMaximoDe: ['fisico'] },
    pd: { nome: 'PD', base: 0, somaMaximoDe: ['mente', 'emocao'] },
  },
  dtPadrao: 7,
};
