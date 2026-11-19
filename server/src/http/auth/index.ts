// Login (Discord e, na #12, e-mail), sessão e conta. Registrado com o prefixo /api.
import type { FastifyPluginAsync } from 'fastify';
import { clienteDiscordReal, rotasDoDiscord, type ClienteDiscord } from './discord.ts';
import { apagarSessao, COOKIE_DA_SESSAO, exigirLogin, limparCookie } from './sessao.ts';

export interface OpcoesDeAuth {
  /** Troca o Discord de verdade (os testes passam um falso). Sem config do Discord, fica desligado. */
  discord?: ClienteDiscord | null;
}

export const rotas: FastifyPluginAsync<OpcoesDeAuth> = (app, opcoes) => {
  const { config } = app;
  const discord =
    opcoes.discord !== undefined
      ? opcoes.discord
      : config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET
        ? clienteDiscordReal(config.DISCORD_CLIENT_ID, config.DISCORD_CLIENT_SECRET)
        : null;

  /** O que a tela de entrar deve mostrar. */
  app.get('/auth/opcoes', () => ({ discord: discord !== null }));

  rotasDoDiscord(app, config, discord);

  app.get('/me', { preHandler: exigirLogin }, (request) => ({ usuario: request.usuario }));

  app.post('/auth/sair', (request, reply) => {
    const token = request.cookies[COOKIE_DA_SESSAO];
    if (token) apagarSessao(app.db, token);
    limparCookie(reply, config);
    return reply.status(204).send();
  });

  return Promise.resolve();
};
