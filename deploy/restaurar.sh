#!/usr/bin/env bash
# Baixa um backup do Google Drive e prepara para abrir o app com ele, na sua máquina.
# Roda no Git Bash (Windows), Linux ou macOS, da raiz do repositório. Precisa do rclone
# configurado com o mesmo remoto do servidor (veja docs/servidor.md, "Testar a restauração").
#
#   deploy/restaurar.sh                    o backup mais novo
#   deploy/restaurar.sh 2026-11-19         o backup de um dia
#   deploy/restaurar.sh --listar           só mostra os backups que existem
#   deploy/restaurar.sh --sem-uploads      só o banco (mais rápido)
#
# Vai para data/restaurado/ (banco e uploads), sem tocar no data/ do dia a dia. Se a pasta já
# existir, pergunta antes de apagar. Variáveis: LIMIAR_BACKUP_REMOTO (padrão gdrive:limiar-backup)
# e LIMIAR_RESTAURAR_EM (padrão data/restaurado).
set -Eeuo pipefail

REMOTO=${LIMIAR_BACKUP_REMOTO:-gdrive:limiar-backup}
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
DESTINO=${LIMIAR_RESTAURAR_EM:-$RAIZ/data/restaurado}

dia=''
listar=0
uploads=1
for arg in "$@"; do
  case $arg in
    --listar) listar=1 ;;
    --sem-uploads) uploads=0 ;;
    -h | --help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) dia=$arg ;;
    *)
      echo "Não entendi \"$arg\". Use: deploy/restaurar.sh [AAAA-MM-DD] [--listar] [--sem-uploads]" >&2
      exit 2
      ;;
  esac
done

command -v rclone > /dev/null || {
  echo "Precisa do rclone: no Windows, winget install Rclone.Rclone (e reabra o terminal)." >&2
  exit 1
}

backups=$(rclone lsf --files-only "$REMOTO/banco" | grep -E '^limiar-[0-9-]+\.db\.gz$' | sort || true)
[[ -n $backups ]] || {
  echo "Nenhum backup em $REMOTO/banco." >&2
  exit 1
}

if [[ $listar == 1 ]]; then
  echo "Backups em $REMOTO/banco:"
  # shellcheck disable=SC2001 # várias linhas: o sed é mais claro
  sed 's/^limiar-\(.*\)\.db\.gz$/  \1/' <<< "$backups"
  exit 0
fi

if [[ -n $dia ]]; then
  arquivo="limiar-$dia.db.gz"
  grep -qx "$arquivo" <<< "$backups" || {
    echo "Não há backup de $dia. Veja os que existem com: deploy/restaurar.sh --listar" >&2
    exit 1
  }
else
  arquivo=$(tail -n 1 <<< "$backups")
  dia=${arquivo#limiar-}
  dia=${dia%.db.gz}
fi

if [[ -e $DESTINO ]]; then
  read -r -p "$DESTINO já existe. Apagar e restaurar de novo? [s/N] " resposta
  [[ $resposta == [sS] ]] || exit 0
  rm -rf -- "$DESTINO"
fi
mkdir -p "$DESTINO"

echo "Baixando o banco de $dia"
rclone copyto "$REMOTO/banco/$arquivo" "$DESTINO/limiar.db.gz"
gzip -d "$DESTINO/limiar.db.gz"

if command -v sqlite3 > /dev/null; then
  integridade=$(sqlite3 "$DESTINO/limiar.db" 'PRAGMA integrity_check;')
  [[ $integridade == ok ]] || {
    echo "ERRO: o banco baixado não passou na verificação: $integridade" >&2
    exit 1
  }
  echo "Banco íntegro: $(sqlite3 "$DESTINO/limiar.db" 'select count(*) from campaigns;') casos, $(sqlite3 "$DESTINO/limiar.db" 'select count(*) from users;') contas."
else
  echo "(sqlite3 não instalado: pulei a verificação de integridade.)"
fi

if [[ $uploads == 1 ]]; then
  echo "Baixando os uploads (o estado atual; arquivos apagados ficam em uploads/anteriores)"
  rclone copy "$REMOTO/uploads/atual" "$DESTINO/uploads" 2> /dev/null ||
    echo "(Sem uploads no backup.)"
fi

# Caminhos no formato que o Node entende também no Windows (C:/...).
caminho() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
banco=$(caminho "$DESTINO/limiar.db")
pasta=$(caminho "$DESTINO/uploads")

cat << FIM

Backup de $dia restaurado em $DESTINO.
Para abrir o app com ele (o pnpm dev normal continua usando data/limiar.db):

  PowerShell:
    \$env:DATABASE_PATH="$banco"; \$env:UPLOADS_DIR="$pasta"; pnpm.cmd db:migrate; pnpm.cmd dev

  Bash:
    DATABASE_PATH="$banco" UPLOADS_DIR="$pasta" pnpm db:migrate
    DATABASE_PATH="$banco" UPLOADS_DIR="$pasta" pnpm dev

Entre com uma conta do servidor e confira se os casos de ontem estão lá.
FIM
