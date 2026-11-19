import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/dist/', 'coverage/', 'data/', 'design/', 'docs/'],
  },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Arquivos de configuração na raiz não estão em nenhum tsconfig dos pacotes.
        projectService: { allowDefaultProject: ['*.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Arquivos .js (como este) não têm tipos: só as regras que não dependem deles.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Desliga as regras de formatação que brigariam com o Prettier; fica sempre por último.
  prettier,
);
