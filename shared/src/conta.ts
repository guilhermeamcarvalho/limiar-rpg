// O que o cadastro e a entrada por e-mail aceitam. O servidor valida com estes schemas.
import { z } from 'zod';
import { MAX_SENHA, MIN_SENHA } from './senha.ts';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Digite um e-mail válido, como nome@exemplo.com.' }));

export const esquemaCadastro = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Diga como você quer aparecer na mesa.' })
    .max(60, { error: 'Use até 60 caracteres.' }),
  email,
  senha: z
    .string()
    .min(MIN_SENHA, { error: `Use pelo menos ${String(MIN_SENHA)} caracteres.` })
    .max(MAX_SENHA, { error: `Use até ${String(MAX_SENHA)} caracteres.` }),
  aceite: z.literal(true, { error: 'É preciso aceitar como a LIMIAR guarda seus dados.' }),
  manter: z.boolean().default(true),
});

export const esquemaEntrar = z.object({
  email,
  // Na entrada não se valida tamanho: senha errada é só "não confere".
  senha: z.string().min(1, { error: 'Digite sua senha.' }).max(MAX_SENHA),
  manter: z.boolean().default(false),
});

export type DadosDeCadastro = z.input<typeof esquemaCadastro>;
export type DadosDeEntrada = z.input<typeof esquemaEntrar>;
