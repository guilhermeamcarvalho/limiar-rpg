/// <reference types="vite/client" />

// Variáveis que o build lê (deploy/deploy.sh). Todas opcionais: sem elas, o app roda igual.
interface ImportMetaEnv {
  /** DSN público do projeto do navegador no Sentry. */
  readonly VITE_SENTRY_DSN?: string;
  /** O commit publicado, para o erro dizer em que versão aconteceu. */
  readonly VITE_MEMBRANA_VERSAO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
