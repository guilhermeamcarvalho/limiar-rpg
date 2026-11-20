// Erro de uma parte da página. Só o bloco que falhou mostra o aviso; o resto continua de pé.
import { ErroDaApi } from '../auth/api.ts';
import { Banner } from './Display.tsx';
import { Button } from './Button.tsx';

/** Vale tentar de novo: sem rede, servidor fora, tempo esgotado ou limite de tentativas. */
export function valeTentarDeNovo(erro: unknown): boolean {
  if (!(erro instanceof ErroDaApi)) return true;
  return erro.status >= 500 || erro.status === 408 || erro.status === 429;
}

/** A segunda frase do aviso: o que o servidor disse ou o que a pessoa pode esperar. */
function detalhe(erro: unknown): string {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 401) return 'Sua sessão terminou. Entre de novo.';
    if (!valeTentarDeNovo(erro)) return erro.message;
  }
  return 'O resto da página funciona.';
}

export interface ErrorBlockProps {
  /** O que não carregou, dito de forma específica: "A agenda não carregou." */
  titulo: string;
  /** O erro recebido; decide o detalhe e se aparece "Tentar de novo". */
  erro?: unknown;
  /** Refaz só a requisição que falhou. */
  onRetry?: () => void;
}

export function ErrorBlock({ titulo, erro, onRetry }: ErrorBlockProps) {
  const repetir = onRetry && valeTentarDeNovo(erro);
  return (
    <Banner
      tone="err"
      action={
        repetir && (
          <Button size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        )
      }
    >
      <span className="small">
        <b>{titulo}</b> {detalhe(erro)}
      </span>
    </Banner>
  );
}
