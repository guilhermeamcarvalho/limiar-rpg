// Lista de blocos editáveis com cadastro em modal para painéis do Escudo (#92).
import { useState } from 'react';
import type { BlocoDoEscudo } from '@membrana/shared';
import { Button, Field, Icon, Input, Modal, Textarea } from '../../ui/index.ts';

export function BlocosEditaveis({
  blocos,
  rotuloAdicionar,
  tituloModal,
  placeholderTitulo,
  placeholderTexto,
  vazio,
  aoMudar,
}: {
  blocos: readonly BlocoDoEscudo[];
  rotuloAdicionar: string;
  tituloModal: string;
  placeholderTitulo: string;
  placeholderTexto: string;
  vazio: string;
  aoMudar: (proximos: BlocoDoEscudo[]) => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [tituloNovo, setTituloNovo] = useState('');
  const [textoNovo, setTextoNovo] = useState('');

  function adicionar() {
    const titulo = tituloNovo.trim() || `Bloco ${String(blocos.length + 1)}`;
    aoMudar([
      ...blocos,
      {
        id: `blk_${Date.now().toString(36)}`,
        titulo,
        texto: textoNovo.trim(),
      },
    ]);
    setTituloNovo('');
    setTextoNovo('');
    setModalAberto(false);
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div>
        <Button
          size="sm"
          variant="primary"
          icon={<Icon name="plus" size="sm" />}
          onClick={() => {
            setModalAberto(true);
          }}
        >
          {rotuloAdicionar}
        </Button>
      </div>

      {blocos.length === 0 ? (
        <p className="small muted">{vazio}</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {blocos.map((bloco) => {
            const aberto = abertoId === bloco.id;
            return (
              <div key={bloco.id} className="mesa-bloco card" style={{ padding: '10px 12px' }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b className="small">{bloco.titulo}</b>
                  <div className="row" style={{ gap: 4 }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Editar ${bloco.titulo}`}
                      aria-expanded={aberto}
                      onClick={() => {
                        setAbertoId(aberto ? null : bloco.id);
                      }}
                    >
                      {aberto ? 'Fechar' : 'Editar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="trash" size="sm" />}
                      aria-label={`Remover ${bloco.titulo}`}
                      onClick={() => {
                        aoMudar(blocos.filter((b) => b.id !== bloco.id));
                      }}
                    />
                  </div>
                </div>
                {!aberto && bloco.texto && (
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {bloco.texto}
                  </p>
                )}
                {aberto && (
                  <div className="col" style={{ gap: 8, marginTop: 8 }}>
                    <Field label="Título">
                      <Input
                        value={bloco.titulo}
                        onChange={(e) => {
                          const titulo = e.target.value;
                          aoMudar(blocos.map((b) => (b.id === bloco.id ? { ...b, titulo } : b)));
                        }}
                      />
                    </Field>
                    <Field label="Conteúdo">
                      <Textarea
                        rows={3}
                        value={bloco.texto}
                        onChange={(e) => {
                          const texto = e.target.value;
                          aoMudar(blocos.map((b) => (b.id === bloco.id ? { ...b, texto } : b)));
                        }}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalAberto}
        title={tituloModal}
        onClose={() => {
          setModalAberto(false);
        }}
      >
        <div className="col" style={{ gap: 10 }}>
          <Field label="Título">
            <Input
              placeholder={placeholderTitulo}
              value={tituloNovo}
              onChange={(e) => {
                setTituloNovo(e.target.value);
              }}
            />
          </Field>
          <Field label="Conteúdo">
            <Textarea
              rows={3}
              placeholder={placeholderTexto}
              value={textoNovo}
              onChange={(e) => {
                setTextoNovo(e.target.value);
              }}
            />
          </Field>
          <div className="row">
            <Button size="sm" variant="primary" onClick={adicionar}>
              {rotuloAdicionar}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
