// As barras que aparecem sobre o item selecionado no mapa.
// Token (RF-18): o mestre e o dono trocam o tamanho e a imagem; só o mestre oculta e remove.
// Prop (RF-21, artboard 11): girar, duplicar, travar, trazer à frente e remover; só o mestre.
import { useRef, type CSSProperties } from 'react';
import {
  PROPS_PRONTOS,
  type ComandoDaMesa,
  type MapaNaMesa,
  type PropNaMesa,
  type RespostaDoComando,
  type TokenNaMesa,
} from '@membrana/shared';
import { cx, Icon, useToast } from '../ui/index.ts';
import { enviarImagemDaMesa } from './imagens.ts';
import { dentroDoMapa, girar, proximaOrdem } from './interacao.ts';

type Enviar = (comando: ComandoDaMesa) => Promise<RespostaDoComando>;

function useResposta() {
  const avisos = useToast();
  return (r: RespostaDoComando) => {
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu', text: r.motivo });
    return r.ok;
  };
}

function Botao({
  rotulo,
  icone,
  ligado,
  aoClicar,
}: {
  rotulo: string;
  icone: Parameters<typeof Icon>[0]['name'];
  ligado?: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('tbtn', ligado && 'on')}
      aria-label={rotulo}
      title={rotulo}
      {...(ligado !== undefined && { 'aria-pressed': ligado })}
      onClick={aoClicar}
    >
      <Icon name={icone} size="sm" />
    </button>
  );
}

export function BarraDoToken({
  token,
  mestre,
  campanhaId,
  enviar,
  estilo,
}: {
  token: TokenNaMesa;
  mestre: boolean;
  campanhaId: string;
  enviar: Enviar;
  estilo: CSSProperties;
}) {
  const avisos = useToast();
  const ok = useResposta();
  const arquivo = useRef<HTMLInputElement>(null);
  const mudar = (
    campos: Omit<Extract<ComandoDaMesa, { type: 'token.update' }>, 'type' | 'tokenId'>,
  ) => void enviar({ type: 'token.update', tokenId: token.id, ...campos }).then(ok);

  return (
    <div className="barra-do-item" role="toolbar" aria-label={`Token ${token.nome}`} style={estilo}>
      <span className="small barra-nome">{token.nome}</span>
      {[1, 2, 3].map((tamanho) => (
        <button
          key={tamanho}
          type="button"
          className={cx('tbtn', token.tamanho === tamanho && 'on')}
          aria-pressed={token.tamanho === tamanho}
          aria-label={`Tamanho ${String(tamanho)} por ${String(tamanho)}`}
          title={`${String(tamanho)}×${String(tamanho)}`}
          onClick={() => {
            if (token.tamanho !== tamanho) mudar({ tamanho });
          }}
        >
          {tamanho}×
        </button>
      ))}
      <input
        ref={arquivo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        aria-label="Nova imagem do token"
        onChange={(e) => {
          const escolhido = e.target.files?.[0];
          e.target.value = '';
          if (!escolhido) return;
          void enviarImagemDaMesa(campanhaId, escolhido, 'token').then((r) => {
            if (r.ok) mudar({ imagem: r.nome });
            else avisos.show({ type: 'err', title: r.titulo, text: r.texto });
          });
        }}
      />
      <Botao rotulo="Trocar imagem" icone="image" aoClicar={() => arquivo.current?.click()} />
      {mestre && (
        <>
          <Botao
            rotulo={token.oculto ? 'Revelar para os jogadores' : 'Ocultar dos jogadores'}
            icone={token.oculto ? 'eyeoff' : 'eye'}
            ligado={token.oculto}
            aoClicar={() => {
              mudar({ oculto: !token.oculto });
            }}
          />
          <Botao
            rotulo="Remover"
            icone="trash"
            aoClicar={() => void enviar({ type: 'token.delete', tokenId: token.id }).then(ok)}
          />
        </>
      )}
    </div>
  );
}

/** "Caixote" para um prop pronto; "Imagem" para um enviado. */
export const nomeDoProp = (prop: PropNaMesa) =>
  PROPS_PRONTOS.find((p) => p.id === prop.imagem)?.nome ?? 'Imagem';

export function BarraDoProp({
  prop,
  props,
  mapa,
  enviar,
  estilo,
  aoRemover,
}: {
  prop: PropNaMesa;
  props: PropNaMesa[];
  mapa: MapaNaMesa;
  enviar: Enviar;
  estilo: CSSProperties;
  aoRemover: () => void;
}) {
  const ok = useResposta();
  const mudar = (
    campos: Omit<Extract<ComandoDaMesa, { type: 'prop.update' }>, 'type' | 'propId'>,
  ) => void enviar({ type: 'prop.update', propId: prop.id, ...campos }).then(ok);
  const celula = mapa.grade.celula;

  return (
    <div className="barra-do-item" role="toolbar" aria-label="Prop selecionado" style={estilo}>
      <span className="small barra-nome">{nomeDoProp(prop)}</span>
      <Botao
        rotulo="Girar 45 graus"
        icone="refresh"
        aoClicar={() => {
          mudar({ rotacao: girar(prop.rotacao) });
        }}
      />
      <Botao
        rotulo="Duplicar"
        icone="copy"
        aoClicar={() => {
          const ao = dentroDoMapa({ x: prop.x + celula, y: prop.y + celula }, mapa);
          void enviar({
            type: 'prop.create',
            imagem: prop.imagem,
            ...ao,
            tamanho: prop.tamanho,
            rotacao: prop.rotacao,
          }).then(ok);
        }}
      />
      <Botao
        rotulo={prop.travado ? 'Destravar' : 'Travar'}
        icone="lock"
        ligado={prop.travado}
        aoClicar={() => {
          mudar({ travado: !prop.travado });
        }}
      />
      <Botao
        rotulo="Trazer à frente"
        icone="layers"
        aoClicar={() => {
          mudar({ ordem: proximaOrdem(props) });
        }}
      />
      <Botao
        rotulo="Remover"
        icone="trash"
        aoClicar={() =>
          void enviar({ type: 'prop.delete', propId: prop.id }).then((r) => {
            if (ok(r)) aoRemover();
          })
        }
      />
    </div>
  );
}
