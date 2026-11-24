// Ferramenta "Props" do mestre (RF-20): os props prontos (por categoria e com busca) e o envio de uma imagem própria
// (PNG até 1024 px, com fundo transparente). O prop novo aparece no meio da tela; clicar nele no
// mapa mostra a barra para girar, duplicar, travar, trazer à frente e remover.
import { useRef, type RefObject } from 'react';
import {
  CATEGORIAS_DE_PROPS,
  PROPS_PRONTOS,
  type ComandoDaMesa,
  type RespostaDoComando,
  type VisaoDaMesa,
} from '@membrana/shared';
import { Button, Icon, useEnvio, useToast } from '../../ui/index.ts';
import type { Ponto } from '../camera.ts';
import { enviarImagemDaMesa } from '../imagens.ts';
import { pontoLivre } from '../interacao.ts';
import { SeletorDePronto } from './SeletorDePronto.tsx';

interface Props {
  campanhaId: string;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  centroRef: RefObject<Ponto | null>;
  visao: VisaoDaMesa;
}

export function NovoProp({ campanhaId, enviar, centroRef, visao }: Props) {
  const avisos = useToast();
  const arquivo = useRef<HTMLInputElement>(null);

  async function por(imagem: string, tamanho: number) {
    const r = await enviar({
      type: 'prop.create',
      imagem,
      ...(visao.mapa
        ? pontoLivre(centroRef.current ?? { x: 0, y: 0 }, visao.props, visao.mapa)
        : (centroRef.current ?? { x: 0, y: 0 })),
      tamanho,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para pôr o prop', text: r.motivo });
  }

  const envio = useEnvio(async (escolhido: File) => {
    const r = await enviarImagemDaMesa(campanhaId, escolhido, 'prop');
    if (!r.ok) {
      avisos.show({ type: 'err', title: r.titulo, text: r.texto });
      return;
    }
    await por(r.nome, 1);
  });

  return (
    <div className="col" style={{ gap: 18 }}>
      <SeletorDePronto
        itens={PROPS_PRONTOS}
        categorias={CATEGORIAS_DE_PROPS}
        rotulo="Props prontos"
        verbo="Pôr"
        aoEscolher={(id) => {
          const pronto = PROPS_PRONTOS.find((p) => p.id === id);
          if (pronto) void por(pronto.id, pronto.tamanho);
        }}
      />

      <div className="col" style={{ gap: 6 }}>
        <input
          ref={arquivo}
          type="file"
          accept="image/png,image/webp,image/avif,image/jpeg"
          hidden
          aria-label="Imagem do prop"
          onChange={(e) => {
            const escolhido = e.target.files?.[0];
            e.target.value = '';
            if (escolhido) void envio.enviar(escolhido);
          }}
        />
        <Button
          icon={<Icon name="upload" size="sm" />}
          loading={envio.enviando}
          onClick={() => arquivo.current?.click()}
        >
          Enviar imagem
        </Button>
        <p className="small muted">
          PNG até 5 MB, de preferência com fundo transparente. Fica com até 1024 px.
        </p>
      </div>

      <p className="small muted">
        Clique num prop no mapa para girar, duplicar, travar, trazer à frente ou remover. Arraste
        pelos cantos para mudar o tamanho e girar.
      </p>
    </div>
  );
}
