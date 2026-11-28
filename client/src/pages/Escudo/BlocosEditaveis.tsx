// Lista de blocos editáveis com cadastro em modal para painéis do Escudo (#92).
import { useState } from 'react';
import { DADOS, type BlocoDoEscudo, type Dado, type FichaDeAmeaca } from '@membrana/shared';
import { Button, Checkbox, Field, Icon, Input, Modal, Select, Textarea } from '../../ui/index.ts';

const PRESETS_PATAMAR: Record<'capanga' | 'tenente' | 'chefe', FichaDeAmeaca> = {
  capanga: {
    patamar: 'capanga',
    fisico: 'd6',
    mente: 'd4',
    emocao: 'd4',
    acrobacia: 'd6',
    luta: 'd6',
    pontaria: 'd6',
    percepcao: 'd6',
    furtividade: 'd4',
    vigor: 'd6',
    disciplina: 'd4',
    pvMax: 10,
    pdMax: 8,
    rd: 0,
    ataques: '',
  },
  tenente: {
    patamar: 'tenente',
    fisico: 'd8',
    mente: 'd6',
    emocao: 'd6',
    acrobacia: 'd8',
    luta: 'd8',
    pontaria: 'd8',
    percepcao: 'd8',
    furtividade: 'd6',
    vigor: 'd8',
    disciplina: 'd6',
    pvMax: 24,
    pdMax: 16,
    rd: 1,
    ataques: '',
  },
  chefe: {
    patamar: 'chefe',
    fisico: 'd10',
    mente: 'd8',
    emocao: 'd8',
    acrobacia: 'd10',
    luta: 'd10',
    pontaria: 'd10',
    percepcao: 'd10',
    furtividade: 'd8',
    vigor: 'd10',
    disciplina: 'd8',
    pvMax: 45,
    pdMax: 24,
    rd: 2,
    ataques: '',
  },
};

function CamposDeFicha({
  ficha,
  aoMudar,
}: {
  ficha: FichaDeAmeaca;
  aoMudar: (proxima: FichaDeAmeaca) => void;
}) {
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row wrapx" style={{ gap: 6 }}>
        {(['capanga', 'tenente', 'chefe'] as const).map((pat) => (
          <Button
            key={pat}
            size="sm"
            variant={ficha.patamar === pat ? 'primary' : 'secondary'}
            onClick={() => {
              aoMudar({ ...PRESETS_PATAMAR[pat], ataques: ficha.ataques ?? '' });
            }}
          >
            {pat === 'capanga' ? 'Capanga' : pat === 'tenente' ? 'Tenente' : 'Chefe'}
          </Button>
        ))}
      </div>

      <div className="g3">
        {(
          [
            ['fisico', 'Físico'],
            ['mente', 'Mente'],
            ['emocao', 'Emoção'],
            ['acrobacia', 'Acrobacia (Inic.)'],
            ['luta', 'Luta'],
            ['pontaria', 'Pontaria'],
            ['percepcao', 'Percepção'],
            ['furtividade', 'Furtividade'],
            ['vigor', 'Vigor'],
            ['disciplina', 'Disciplina'],
          ] as const
        ).map(([campo, rotulo]) => (
          <Field key={campo} label={rotulo}>
            <Select
              value={ficha[campo] ?? 'd4'}
              onChange={(e) => {
                aoMudar({ ...ficha, [campo]: e.target.value as Dado });
              }}
            >
              {DADOS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>

      <div className="g3">
        <Field label="PV máximo">
          <Input
            type="number"
            min={1}
            max={999}
            value={ficha.pvMax}
            onChange={(e) => {
              aoMudar({ ...ficha, pvMax: Math.max(1, Number(e.target.value) || 1) });
            }}
          />
        </Field>
        <Field label="PD máximo">
          <Input
            type="number"
            min={0}
            max={999}
            value={ficha.pdMax}
            onChange={(e) => {
              aoMudar({ ...ficha, pdMax: Math.max(0, Number(e.target.value) || 0) });
            }}
          />
        </Field>
        <Field label="RD (Proteção)">
          <Input
            type="number"
            min={0}
            max={99}
            value={ficha.rd ?? 0}
            onChange={(e) => {
              aoMudar({ ...ficha, rd: Math.max(0, Number(e.target.value) || 0) });
            }}
          />
        </Field>
      </div>

      <Field label="Ataques e habilidades">
        <Textarea
          rows={2}
          placeholder="Ex.: Garras (Luta · dano 6), Grito estático (Disciplina DT 10)…"
          value={ficha.ataques ?? ''}
          onChange={(e) => {
            aoMudar({ ...ficha, ataques: e.target.value });
          }}
        />
      </Field>
    </div>
  );
}

export function BlocosEditaveis({
  blocos,
  rotuloAdicionar,
  tituloModal,
  placeholderTitulo,
  placeholderTexto,
  vazio,
  comFicha = false,
  aoMudar,
}: {
  blocos: readonly BlocoDoEscudo[];
  rotuloAdicionar: string;
  tituloModal: string;
  placeholderTitulo: string;
  placeholderTexto: string;
  vazio: string;
  comFicha?: boolean;
  aoMudar: (proximos: BlocoDoEscudo[]) => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [tituloNovo, setTituloNovo] = useState('');
  const [textoNovo, setTextoNovo] = useState('');
  const [incluirFichaNova, setIncluirFichaNova] = useState(true);
  const [fichaNova, setFichaNova] = useState<FichaDeAmeaca>({ ...PRESETS_PATAMAR.capanga });
  const [editandoFichaId, setEditandoFichaId] = useState<string | null>(null);
  const [fichaDraft, setFichaDraft] = useState<FichaDeAmeaca>(PRESETS_PATAMAR.capanga);

  function abrirFicha(bloco: BlocoDoEscudo) {
    setFichaDraft(bloco.ficha ?? { ...PRESETS_PATAMAR.capanga });
    setEditandoFichaId(bloco.id);
  }

  function salvarFicha() {
    if (!editandoFichaId) return;
    aoMudar(blocos.map((b) => (b.id === editandoFichaId ? { ...b, ficha: fichaDraft } : b)));
    setEditandoFichaId(null);
  }

  function removerFicha() {
    if (!editandoFichaId) return;
    aoMudar(blocos.map((b) => (b.id === editandoFichaId ? { ...b, ficha: null } : b)));
    setEditandoFichaId(null);
  }

  function adicionar() {
    const titulo = tituloNovo.trim() || `Bloco ${String(blocos.length + 1)}`;
    aoMudar([
      ...blocos,
      {
        id: `blk_${Date.now().toString(36)}`,
        titulo,
        texto: textoNovo.trim(),
        ...(comFicha && incluirFichaNova && { ficha: fichaNova }),
      },
    ]);
    setTituloNovo('');
    setTextoNovo('');
    setFichaNova({ ...PRESETS_PATAMAR.capanga });
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
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <b className="small">{bloco.titulo}</b>
                    {comFicha && bloco.ficha && !aberto && (
                      <span className="small gold">
                        Ficha: FÍS {bloco.ficha.fisico} · ACR {bloco.ficha.acrobacia} · PV{' '}
                        {bloco.ficha.pvMax}
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {comFicha && (
                      <Button
                        size="sm"
                        variant={bloco.ficha ? 'ghost' : 'secondary'}
                        onClick={() => {
                          abrirFicha(bloco);
                        }}
                      >
                        {bloco.ficha ? 'Ficha' : 'Montar ficha'}
                      </Button>
                    )}
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
                      className="btn-excluir"
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
                    {comFicha && (
                      <div className="row between wrapx" style={{ gap: 8 }}>
                        <span className="small muted">
                          {bloco.ficha
                            ? `Ficha: FÍS ${bloco.ficha.fisico} · ACR ${bloco.ficha.acrobacia} · PV ${String(bloco.ficha.pvMax)}`
                            : 'Sem ficha montada (não entra no combate)'}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Icon name="edit" size="sm" />}
                          onClick={() => {
                            abrirFicha(bloco);
                          }}
                        >
                          {bloco.ficha ? 'Editar ficha' : 'Montar ficha'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {comFicha && (
        <Modal
          open={editandoFichaId !== null}
          title={`Ficha: ${blocos.find((b) => b.id === editandoFichaId)?.titulo ?? 'Ameaça'}`}
          onClose={() => {
            setEditandoFichaId(null);
          }}
        >
          <div className="col" style={{ gap: 12 }}>
            <CamposDeFicha ficha={fichaDraft} aoMudar={setFichaDraft} />

            <div className="row between wrapx" style={{ gap: 8 }}>
              {blocos.find((b) => b.id === editandoFichaId)?.ficha ? (
                <Button size="sm" variant="ghost" onClick={removerFicha}>
                  Remover ficha
                </Button>
              ) : (
                <span />
              )}
              <div className="row" style={{ gap: 8 }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditandoFichaId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button variant="primary" onClick={salvarFicha}>
                  Salvar ficha
                </Button>
              </div>
            </div>
          </div>
        </Modal>
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
              rows={2}
              placeholder={placeholderTexto}
              value={textoNovo}
              onChange={(e) => {
                setTextoNovo(e.target.value);
              }}
            />
          </Field>
          {comFicha && (
            <>
              <Checkbox
                label="Montar ficha de combate (entra na iniciativa)"
                checked={incluirFichaNova}
                onChange={(e) => {
                  setIncluirFichaNova(e.target.checked);
                }}
              />
              {incluirFichaNova && <CamposDeFicha ficha={fichaNova} aoMudar={setFichaNova} />}
            </>
          )}
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
