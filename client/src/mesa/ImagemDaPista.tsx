// Anexo visual de uma pista (ilustração genérica `pista:...` ou foto enviada pelo mestre):
// mostra uma prévia clicável e abre o modal em tamanho grande para leitura de documentos/fotos.
import { useState } from 'react';
import { cx, Icon, Modal } from '../ui/index.ts';
import { urlDaImagem } from './prontos.ts';
import './pista-imagem.css';

export function ImagemDaPista({
  imagem,
  titulo,
  compacta = false,
}: {
  imagem: string;
  titulo: string;
  compacta?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const src = urlDaImagem(imagem);

  return (
    <>
      <button
        type="button"
        className={cx('pista-anexo', compacta && 'compacta')}
        aria-label={`Ampliar imagem da pista ${titulo}`}
        onClick={() => {
          setAberta(true);
        }}
      >
        <img src={src} alt={titulo} loading="lazy" />
        <span className="pista-anexo-selo" aria-hidden="true">
          <Icon name="search" size="sm" />
          Ampliar
        </span>
      </button>

      <Modal
        open={aberta}
        onClose={() => {
          setAberta(false);
        }}
        title={titulo}
      >
        <img className="pista-ampliada" src={src} alt={titulo} />
      </Modal>
    </>
  );
}
