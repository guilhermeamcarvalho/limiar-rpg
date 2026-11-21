// Página interna, só no `pnpm dev`: mostra todos os componentes como o artboard
// "Componentes" do canvas (design/png/Componentes.png). Serve para comparar lado a lado.
import { useState, type ReactNode } from 'react';
import {
  Avatar,
  Banner,
  Icon,
  NOMES_DOS_ICONES,
  Button,
  Card,
  Checkbox,
  Chip,
  Die,
  EmptyState,
  Field,
  Input,
  Modal,
  Note,
  ResourceBar,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Switch,
  TabPanel,
  Tabs,
  Tag,
  Textarea,
  Toast,
  useToast,
} from '../../ui/index.ts';

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <div className="sect-h">
        <h2 className="h3">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Amostras({ rotulo, cores, nota }: { rotulo: string; cores: string[]; nota: string }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="lab">{rotulo}</span>
      <div className="row" style={{ gap: 0 }}>
        {cores.map((cor) => (
          <div
            key={cor}
            title={`--${cor}`}
            style={{ flex: 1, height: 56, background: `var(--${cor})` }}
          />
        ))}
      </div>
      <span className="small muted">{nota}</span>
    </div>
  );
}

function Cores() {
  return (
    <Secao titulo="Cores">
      <div className="g4">
        <Amostras
          rotulo="Fundos"
          cores={['bg-2', 'bg', 'panel', 'panel-2', 'panel-3', 'panel-4']}
          nota="bg-2 · bg · panel · panel-2 · panel-3 · panel-4. Do mais escuro (mesa) ao mais claro (destaque)."
        />
        <Amostras
          rotulo="Ação e destaque"
          cores={['red', 'red-hi', 'red-dark', 'red-soft']}
          nota="Vermelho só para ação principal, item ativo e falha. Nunca para texto longo."
        />
        <Amostras
          rotulo="Significado"
          cores={['gold', 'green', 'blue', 'muted']}
          nota="Dourado: crítico, bônus, mestre. Verde: sucesso. Azul: PD e informação. Cinza: secundário."
        />
        <Amostras
          rotulo="Papel e tinta"
          cores={['paper', 'paper-2', 'ink-2', 'ink']}
          nota="Papel só para o que existe no mundo do jogo: pistas, notas, dossiê, diário."
        />
      </div>
    </Secao>
  );
}

function Tipografia() {
  return (
    <Secao titulo="Tipografia">
      <div className="g3">
        <Card pad className="col">
          <span className="lab">Oranienbaum · títulos</span>
          <span className="h1">O sinal</span>
          <span className="h2">Santa Ermida</span>
          <span className="h3">Estúdio B</span>
          <span className="small muted">Sempre em caixa alta. 56 / 34 / 24 px.</span>
        </Card>
        <Card pad className="col">
          <span className="lab">Mulish · interface</span>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            Texto de interface, rótulos e botões. 14–15 px no corpo.
          </p>
          <span className="lab">Rótulo de seção · 11 px · 800</span>
          <span className="small muted">Nunca abaixo de 11 px. Contraste mínimo 4,5:1.</span>
        </Card>
        <Card pad className="col">
          <span className="lab">Special Elite e Courier Prime · mundo do jogo</span>
          <p className="type" style={{ fontSize: 16 }}>
            A rádio voltou a transmitir às 3h33.
          </p>
          <Note>Nota do mestre: Anselmo nunca saiu do prédio.</Note>
          <span className="small muted">Só para narração, pistas e documentos do caso.</span>
        </Card>
      </div>
    </Secao>
  );
}

function Botoes() {
  return (
    <Secao titulo="Botões">
      <div className="g2">
        <Card pad className="col" style={{ gap: 16 }}>
          <span className="lab">Principal</span>
          <div className="row wrapx">
            <Button variant="primary" icon={<Icon name="plus" size="sm" />}>
              Abrir caso
            </Button>
            <Button variant="primary" className="is-hover">
              Hover
            </Button>
            <Button variant="primary" className="is-focus">
              Foco
            </Button>
            <Button variant="primary" loading>
              Salvando
            </Button>
            <button type="button" className="btn is-ok">
              <Icon name="check" size="sm" />
              Salvo
            </button>
            <Button variant="primary" disabled>
              Desabilitado
            </Button>
          </div>
          <span className="small muted">
            Um botão principal por área. Carregando trava o clique duplo. Sucesso volta ao normal em
            2 s.
          </span>
        </Card>
        <Card pad className="col" style={{ gap: 16 }}>
          <span className="lab">Secundário, fantasma, perigo e ícone</span>
          <div className="row wrapx">
            <Button>Abrir ficha</Button>
            <Button className="is-hover">Hover</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger" icon={<Icon name="trash" size="sm" />}>
              Remover
            </Button>
            <Button icon={<Icon name="gear" />} aria-label="Configurações" />
            <Button size="sm">Pequeno</Button>
          </div>
          <span className="small muted">
            Alvo mínimo 44 px (36 px só em barras densas do computador). Ícone sozinho sempre com
            rótulo para leitor de tela.
          </span>
        </Card>
      </div>
    </Secao>
  );
}

function Campos() {
  const [rolagem, setRolagem] = useState<'virtual' | 'fisico'>('virtual');
  const [aba, setAba] = useState<'pistas' | 'inventario' | 'chat'>('pistas');
  const [umaAcao, setUmaAcao] = useState(true);

  return (
    <Secao titulo="Campos e seletores">
      <div className="g4">
        <Field label="Nome do caso" help="Até 60 caracteres.">
          <Input defaultValue="O Sinal de Santa Ermida" />
        </Field>
        <Field label="Foco">
          <Input className="is-focus" defaultValue="Maré de Concr" />
        </Field>
        <Field label="Erro" error="Dê um nome ao sistema.">
          <Input defaultValue="" />
        </Field>
        <Field label="Desabilitado">
          <Input defaultValue="Ordem Paranormal II" disabled />
        </Field>
      </div>
      <div className="g3" style={{ marginTop: 24 }}>
        <div className="col">
          <span className="flabel">Seletor segmentado</span>
          <Segmented
            label="Como rolar os dados"
            value={rolagem}
            onChange={setRolagem}
            options={[
              { value: 'virtual', label: 'Dados virtuais', icon: <Icon name="dice" size="sm" /> },
              { value: 'fisico', label: 'Dados físicos' },
            ]}
          />
        </div>
        <div className="col">
          <span className="flabel">Abas com contador</span>
          <Tabs
            idBase="demo"
            label="Painel da mesa"
            value={aba}
            onChange={setAba}
            items={[
              { id: 'pistas', label: 'Pistas', count: 2, isNew: true },
              { id: 'inventario', label: 'Inventário', count: 5 },
              { id: 'chat', label: 'Chat' },
            ]}
          />
          <TabPanel idBase="demo" id={aba} className="small muted">
            Painel: {aba}. Setas, Home e End trocam de aba.
          </TabPanel>
        </div>
        <div className="col" style={{ gap: 0 }}>
          <span className="flabel">Alternar e marcar</span>
          <Switch checked={umaAcao} onChange={setUmaAcao} label="Uma ação por rodada" />
          <Checkbox label="Lembrar no próximo caso" defaultChecked />
        </div>
      </div>
      <div className="g4" style={{ marginTop: 24 }}>
        <Field label="Aviso" warning="Mente d10 passa do limite do nível 1.">
          <Select defaultValue="d10">
            <option value="d6">d6</option>
            <option value="d8">d8</option>
            <option value="d10">d10</option>
          </Select>
        </Field>
        <Field label="Anotação" help="Só você vê.">
          <Textarea placeholder="Escreva aqui…" />
        </Field>
        <Field label="Documento do caso">
          <Input paper defaultValue="Relatório nº 33" />
        </Field>
      </div>
    </Secao>
  );
}

function Etiquetas() {
  return (
    <Secao titulo="Etiquetas, avatares e dados">
      <div className="g3">
        <Card pad className="col">
          <span className="lab">Etiquetas</span>
          <div className="row wrapx">
            <Tag tone="red">Executor</Tag>
            <Tag tone="blue">Analista</Tag>
            <Tag tone="green">Vigilante</Tag>
            <Tag tone="gold">Mestre</Tag>
            <Tag>Ordem Paranormal II</Tag>
            <Tag tone="ink">Em curso</Tag>
          </div>
          <div className="row wrapx">
            <Chip status="online">Online</Chip>
            <Chip status="away">Ausente</Chip>
            <Chip status="off">Fora</Chip>
          </div>
        </Card>
        <Card pad className="col">
          <span className="lab">Avatares · cor do perfil</span>
          <div className="row">
            <Avatar initials="DR" name="Davi Rocha" />
            <Avatar initials="MQ" name="Marta Queiroz" tone="blue" />
            <Avatar initials="IN" name="Iara Nunes" tone="green" />
            <Avatar initials="HD" name="Helena Dias, mestre" tone="gold" />
            <Avatar initials="?" name="Vaga livre" tone="none" />
          </div>
          <span className="small muted">
            O anel diz o perfil; a pessoa sempre aparece também pelo nome.
          </span>
        </Card>
        <Card pad className="col">
          <span className="lab">Dados · a forma diz o tipo</span>
          <div className="row wrapx" style={{ gap: 14 }}>
            <Die size="lg" type="d4" value={4} />
            <Die size="lg" type="d6" value={6} />
            <Die size="lg" type="d8" value={8} />
            <Die size="lg" type="d10" value={10} />
            <Die size="lg" type="d12" value={12} />
            <Die size="lg" type="d20" value={20} />
          </div>
          <div className="row" style={{ gap: 14 }}>
            <Die size="lg" type="d8" value={7} />
            <Die size="lg" type="d10" value={9} role="pericia" />
            <Die size="lg" type="d4" value={3} role="bonus" />
            <Die size="lg" type="d6" value={1} discarded />
          </div>
          <span className="small muted">
            Vermelho: atributo. Branco: perícia. Dourado: bônus. Apagado: descartado da soma.
          </span>
        </Card>
      </div>
    </Secao>
  );
}

function Recursos() {
  return (
    <Secao titulo="Recursos">
      <Card pad className="col" style={{ gap: 14, maxWidth: 600 }}>
        <ResourceBar kind="pv" value={9} max={12} />
        <ResourceBar kind="pd" value={10} max={12} />
        <ResourceBar kind="impeto" value={2} max={3} />
        <ResourceBar kind="pv" value={31} max={40} />
        <span className="small muted">
          Até 20 caixas por linha; acima disso a barra vira medidor contínuo com o número ao lado.
        </span>
      </Card>
    </Secao>
  );
}

function Icones() {
  return (
    <Secao titulo="Ícones">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
          gap: 16,
        }}
      >
        {NOMES_DOS_ICONES.map((nome) => (
          <div key={nome} className="col" style={{ alignItems: 'center', gap: 6 }}>
            <Icon name={nome} size="lg" />
            <span className="small muted">{nome}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>
        Traço de 2 px, herda a cor do texto. Decorativo por padrão; só leva rótulo quando nenhum
        texto ao lado diz o que ele significa.
      </p>
    </Secao>
  );
}

function Avisos() {
  return (
    <Secao titulo="Avisos e estados">
      <div className="g4">
        <Toast type="ok" title="Ficha salva" text="Davi agora tem 12 PV." />
        <Toast type="warn" title="Fora da regra" text="Mente d10 passa do limite do nível 1." />
        <Toast
          type="err"
          title="Não deu para salvar"
          text="Sem conexão. Tentaremos de novo em 5 s."
        />
        <Toast title="Rodada 4" text="É a vez de Marta." />
      </div>
      <div className="g3" style={{ marginTop: 24 }}>
        <EmptyState
          icon={<Icon name="users" size="xl" />}
          title="Nenhum sobrevivente"
          action={
            <Button variant="primary" size="sm" icon={<Icon name="plus" size="sm" />}>
              Criar personagem
            </Button>
          }
        >
          Crie um personagem para entrar num caso.
        </EmptyState>
        <Card pad className="col" aria-busy="true">
          <span className="lab">Carregando</span>
          <Skeleton variant="h" width="60%" />
          <Skeleton />
          <Skeleton width="80%" />
          <Skeleton width="45%" />
          <span className="small muted">
            Esqueleto no formato do conteúdo; nunca tela em branco.
          </span>
        </Card>
        <div className="col" style={{ gap: 10 }}>
          <Banner
            tone="err"
            icon={<Icon name="wifioff" />}
            action={<Button size="sm">Tentar agora</Button>}
          >
            Conexão perdida. Suas ações ficam guardadas.
          </Banner>
          <Banner tone="warn">Mapa acima de 20 MB. Reduza para 4096 px.</Banner>
          <Banner tone="ok">Convite aceito. Bem-vinda à mesa, Marta.</Banner>
        </div>
      </div>
    </Secao>
  );
}

function Interativos() {
  const avisos = useToast();
  const [modal, setModal] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    setSalvo(false);
    setSalvando(true);
    setTimeout(() => {
      setSalvando(false);
      setSalvo(true);
    }, 1200);
  }

  return (
    <Secao titulo="Experimente">
      <div className="row wrapx">
        <Button variant="primary" loading={salvando} success={salvo} onClick={salvar}>
          Salvar ficha
        </Button>
        <Button
          onClick={() => {
            setModal(true);
          }}
        >
          Abrir modal
        </Button>
        <Button
          onClick={() => {
            setGaveta(true);
          }}
        >
          Abrir gaveta
        </Button>
        <Button
          onClick={() =>
            avisos.show({ type: 'ok', title: 'Ficha salva', text: 'Davi agora tem 12 PV.' })
          }
        >
          Aviso de sucesso
        </Button>
        <Button
          onClick={() =>
            avisos.show({ type: 'err', title: 'Não deu para salvar', text: 'Sem conexão.' })
          }
        >
          Aviso de erro
        </Button>
      </div>
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
        }}
        title="Teste de Percepção"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setModal(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModal(false);
              }}
            >
              Rolar
            </Button>
          </>
        }
      >
        <Field label="Dificuldade" help="Tab dá a volta aqui dentro; Esc fecha.">
          <Input defaultValue="10" inputMode="numeric" />
        </Field>
      </Modal>
      <Sheet
        open={gaveta}
        onClose={() => {
          setGaveta(false);
        }}
        title="Pistas"
      >
        <Note>Um bilhete rasgado: “Estúdio B, 3h33”.</Note>
        <Button wide variant="primary">
          Mostrar à mesa
        </Button>
      </Sheet>
    </Secao>
  );
}

export default function Componentes() {
  return (
    <main
      className="wrap"
      style={{
        paddingTop: 48,
        paddingBottom: 64,
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
      }}
    >
      <section className="col" style={{ gap: 8 }}>
        <span className="eyebrow">MEMBRANA · componentes</span>
        <h1 className="h1">Tokens, componentes e estados</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          Todas as telas usam só o que está aqui. Cor nova entra primeiro como token. Cada
          componente mostra os estados que a implementação precisa cobrir: padrão, hover, foco,
          carregando, sucesso, erro e desabilitado.
        </p>
      </section>
      <Cores />
      <Tipografia />
      <Botoes />
      <Campos />
      <Etiquetas />
      <Recursos />
      <Icones />
      <Avisos />
      <Interativos />
    </main>
  );
}
