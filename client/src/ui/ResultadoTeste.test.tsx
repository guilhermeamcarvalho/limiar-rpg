import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResultadoTeste } from './ResultadoTeste.tsx';

afterEach(cleanup);

describe('ResultadoTeste', () => {
  it('mostra os dados com o papel, o total, a DT, o veredito e a nota', () => {
    render(
      <ResultadoTeste
        titulo="Máquinas · Mente · agora"
        origem="virtual"
        dados={[
          { tipo: 'd6', valor: 5, papel: 'atributo', rotulo: 'Mente', descartado: false },
          { tipo: 'd10', valor: 9, papel: 'pericia', rotulo: 'Máquinas', descartado: false },
          { tipo: 'd4', valor: 1, papel: 'bonus', rotulo: 'Ímpeto', descartado: true },
        ]}
        total={14}
        dt={7}
        veredito="sucesso"
        nota="Ímpeto gasto: +d4."
      />,
    );
    const cartao = screen.getByRole('region', { name: 'Resultado do teste' });
    expect(cartao.className).toContain('ok');
    expect(screen.getByText('Dados virtuais')).toBeDefined();
    expect(screen.getByRole('img', { name: 'd10 de perícia: 9' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'd4 de bônus: 1, descartado' })).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('Sucesso · DT 7')).toBeDefined();
    expect(screen.getByText('Ímpeto gasto: +d4.')).toBeDefined();
  });

  it('crítico é dourado; falha crítica é vermelha; dados físicos e apagado', () => {
    const { rerender } = render(
      <ResultadoTeste titulo="t" origem="fisico" dados={[]} total={20} dt={7} veredito="critico" />,
    );
    expect(screen.getByRole('region').className).toContain('crit');
    expect(screen.getByText('Dados físicos')).toBeDefined();

    rerender(
      <ResultadoTeste
        titulo="t"
        origem="virtual"
        dados={[]}
        total={2}
        dt={7}
        veredito="falhaCritica"
        apagado
      />,
    );
    expect(screen.getByRole('region').className).toContain('ko');
    expect(screen.getByRole('region').className).toContain('apagado');
    expect(screen.getByText('Falha crítica · DT 7')).toBeDefined();
  });
});
