// Estrutura de todas as páginas fora da mesa: cabeçalho global, conteúdo e, no celular, a barra
// de baixo. O caso vem da URL (/campanhas/:id/...); o personagem, do próprio caso.
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import type { CampanhaDetalhe } from '@membrana/shared';
import { pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import { PAPEL, iniciais } from '../casos/formatos.ts';
import { useConvitesPendentes } from '../convites/pendentes.ts';
import {
  Button,
  Card,
  Icon,
  Marca,
  Modal,
  Skeleton,
  Tag,
  useCarga,
  type NomeDoIcone,
} from '../ui/index.ts';
import { ContextoDoCelular, NADA_PROPRIO, type CelularProprio } from './celular.tsx';
import './app.css';

interface ItemDoMenu {
  para: string;
  rotulo: string;
  icone: NomeDoIcone;
}

const MENU: ItemDoMenu[] = [
  { para: '/', rotulo: 'Central', icone: 'home' },
  { para: '/casos', rotulo: 'Casos', icone: 'folder' },
  { para: '/personagens', rotulo: 'Personagens', icone: 'users' },
  { para: '/arquivo', rotulo: 'Arquivo', icone: 'book' },
];

const BARRA_DO_CELULAR: ItemDoMenu[] = [
  ...MENU,
  { para: '/perfil', rotulo: 'Perfil', icone: 'user' },
];

/** Nome da página no cabeçalho do celular. */
function tituloDaRota(caminho: string): string {
  if (caminho === '/casos/novo') return 'Novo caso';
  if (caminho.startsWith('/casos')) return 'Casos';
  const item = BARRA_DO_CELULAR.find((i) => i.para !== '/' && caminho.startsWith(i.para));
  return item?.rotulo ?? 'Central';
}

/** O caso aberto na URL, para o cabeçalho dizer onde a pessoa está. */
function useCasoDaUrl() {
  const dentro = useMatch('/campanhas/:id/*');
  const id = dentro?.params.id ?? null;
  return useCarga(id && `/api/campanhas/${id}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${id ?? ''}`, { signal }).then(
      (r) => r.campanha,
    ),
  );
}

function ContextoDoCaso({ caso }: { caso: CampanhaDetalhe }) {
  const papel = PAPEL[caso.papel];
  return (
    <span className="ctx">
      Caso <b>{caso.nome}</b>
      <Tag tone={papel.tom}>{papel.voce}</Tag>
    </span>
  );
}

function Notificacoes() {
  const pendentes = useConvitesPendentes();
  const [aberta, setAberta] = useState(false);
  const novas = pendentes.length;
  return (
    <span className="com-badge">
      <Button
        variant="ghost"
        icon={<Icon name="bell" />}
        aria-label={
          novas > 0
            ? `Notificações, ${String(novas)} ${novas === 1 ? 'nova' : 'novas'}`
            : 'Notificações'
        }
        aria-haspopup="dialog"
        onClick={() => {
          setAberta(true);
        }}
      />
      {novas > 0 && <span className="badge" aria-hidden="true" />}
      <Modal
        open={aberta}
        onClose={() => {
          setAberta(false);
        }}
        title="Notificações"
      >
        {novas > 0 ? (
          <div className="col">
            <p>
              {novas === 1
                ? 'Um convite espera a sua resposta.'
                : `${String(novas)} convites esperam a sua resposta.`}
            </p>
            <div>
              <Link
                className="btn red sm"
                to="/#convites"
                onClick={() => {
                  setAberta(false);
                }}
              >
                Ver convites
              </Link>
            </div>
          </div>
        ) : (
          <p className="muted">Nada novo por aqui.</p>
        )}
      </Modal>
    </span>
  );
}

/** Enquanto o código da página chega: o esqueleto, nunca uma tela em branco. */
export function CarregandoPagina() {
  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 64 }} aria-busy="true">
      <span className="sr-only">Carregando a página…</span>
      <Card pad className="col">
        <Skeleton variant="h" width="40%" />
        <Skeleton />
        <Skeleton width="70%" />
      </Card>
    </div>
  );
}

export function AppLayout() {
  const { sessao } = useMe();
  const local = useLocation();
  const caso = useCasoDaUrl();
  const casoAberto = caso.carga.estado === 'pronto' ? caso.carga.dados : null;
  const nome = sessao.estado === 'logado' ? sessao.usuario.nome : '';
  // Criação e Ficha trazem o próprio cabeçalho e a própria barra no celular (celular.tsx).
  const [proprio, setProprio] = useState<CelularProprio>(NADA_PROPRIO);

  return (
    <div className="app">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="top">
        <Marca />
        {casoAberto && <ContextoDoCaso caso={casoAberto} />}
        <nav className="nav" aria-label="Principal">
          {MENU.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.para === '/'}
              className={({ isActive }) => (isActive ? 'on' : '')}
            >
              <Icon name={item.icone} />
              {item.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="end">
          <Link className="btn sm top-codigo" to="/convite">
            <Icon name="key" size="sm" />
            <span className="top-rotulo">Entrar com código</span>
          </Link>
          <Notificacoes />
          <Link className="av sm" to="/perfil" aria-label={`Perfil de ${nome}`} title={nome}>
            {iniciais(nome)}
          </Link>
        </div>
      </header>

      {!proprio.topo && (
        <header className="m-top">
          <Marca compacta />
          <div className="t">
            <b>{casoAberto?.nome ?? tituloDaRota(local.pathname)}</b>
          </div>
          <Notificacoes />
        </header>
      )}

      <main id="conteudo" className="app-conteudo" tabIndex={-1}>
        <Suspense fallback={<CarregandoPagina />}>
          <ContextoDoCelular value={setProprio}>
            <Outlet />
          </ContextoDoCelular>
        </Suspense>
      </main>

      {!proprio.barra && <BarraDoCelular />}
    </div>
  );
}

function BarraDoCelular() {
  return (
    <nav className="m-tabbar" aria-label="Principal">
      {BARRA_DO_CELULAR.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          end={item.para === '/'}
          className={({ isActive }) => (isActive ? 'on' : '')}
        >
          <Icon name={item.icone} />
          {item.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
