#!/usr/bin/env bash
# Backup diário da MEMBRANA para fora do servidor (Google Drive, pelo rclone). Roda às 4h pelo
# timer membrana-backup.timer, como o usuário do serviço. Para rodar na hora:
#   sudo systemctl start membrana-backup && sudo journalctl -u membrana-backup -n 30 --no-pager
#
# O que fica no remoto (BACKUP_REMOTO, como gdrive:membrana-backup):
#   banco/membrana-AAAA-MM-DD.db.gz        cópia consistente do SQLite, uma por dia, as 14 últimas
#   uploads/atual/                       espelho de data/uploads
#   uploads/anteriores/AAAA-MM-DD/       o que foi apagado ou trocado naquele dia (14 dias)
# Assim, qualquer um dos últimos 14 dias pode ser restaurado (deploy/restaurar.sh).
set -Eeuo pipefail

AMBIENTE=${MEMBRANA_AMBIENTE:-/etc/membrana.env}
MANTER=14

ler_var() { { grep -E "^$1=" "$AMBIENTE" || true; } | tail -n 1 | cut -d= -f2-; }

BANCO=${DATABASE_PATH:-$(ler_var DATABASE_PATH)}
UPLOADS=${UPLOADS_DIR:-$(ler_var UPLOADS_DIR)}
REMOTO=${BACKUP_REMOTO:-$(ler_var BACKUP_REMOTO)}
CHECKIN=${BACKUP_CHECKIN_URL:-$(ler_var BACKUP_CHECKIN_URL)}
DIA=$(date +%F)

# Avisa o monitor de cron, se houver: "in_progress", "ok" ou "error". Nunca derruba o backup.
avisar() {
  [[ -n $CHECKIN ]] || return 0
  local sep='?'
  [[ $CHECKIN == *\?* ]] && sep='&'
  curl -fsS --max-time 10 -o /dev/null "$CHECKIN${sep}status=$1" || echo "(aviso ao monitor falhou)"
}
falhou() {
  echo "ERRO: o backup falhou na linha $1." >&2
  avisar error
  exit 1
}
trap 'falhou $LINENO' ERR

[[ -n $BANCO && -f $BANCO ]] || {
  echo "ERRO: banco não encontrado (DATABASE_PATH=$BANCO)" >&2
  avisar error
  exit 1
}
[[ -n $REMOTO ]] || {
  echo "ERRO: BACKUP_REMOTO não está definido em $AMBIENTE" >&2
  avisar error
  exit 1
}

avisar in_progress
TEMP=$(mktemp -d)
trap 'rm -rf -- "$TEMP"' EXIT

echo "Copiando o banco ($BANCO)"
# .backup faz uma cópia consistente mesmo com o app gravando (modo WAL).
sqlite3 "$BANCO" ".backup '$TEMP/membrana-$DIA.db'"
integridade=$(sqlite3 "$TEMP/membrana-$DIA.db" 'PRAGMA integrity_check;')
if [[ $integridade != ok ]]; then
  echo "ERRO: a cópia do banco não passou na verificação: $integridade" >&2
  falhou $LINENO
fi
gzip -9 "$TEMP/membrana-$DIA.db"
rclone copyto "$TEMP/membrana-$DIA.db.gz" "$REMOTO/banco/membrana-$DIA.db.gz"
echo "Banco enviado: $REMOTO/banco/membrana-$DIA.db.gz ($(du -h "$TEMP/membrana-$DIA.db.gz" | cut -f1))"

if [[ -d $UPLOADS ]]; then
  echo "Sincronizando os uploads ($UPLOADS)"
  rclone sync "$UPLOADS" "$REMOTO/uploads/atual" --backup-dir "$REMOTO/uploads/anteriores/$DIA"
else
  echo "Sem pasta de uploads ($UPLOADS): nada a enviar."
fi

echo "Mantendo as $MANTER cópias mais novas"
# Os nomes têm a data, então a ordem alfabética é a ordem do tempo. "|| true": lista vazia
# (nada a apagar) é o caso normal, não um erro.
copias=$(rclone lsf --files-only "$REMOTO/banco" | grep -E '^membrana-[0-9-]+\.db\.gz$' | sort || true)
for antigo in $(head -n -"$MANTER" <<< "$copias"); do
  rclone deletefile "$REMOTO/banco/$antigo"
  echo "  apagado banco/$antigo"
done
pastas=$(rclone lsf --dirs-only "$REMOTO/uploads/anteriores" 2> /dev/null | sort || true)
for antiga in $(head -n -"$MANTER" <<< "$pastas"); do
  rclone purge "$REMOTO/uploads/anteriores/${antiga%/}"
  echo "  apagado uploads/anteriores/$antiga"
done

avisar ok
echo "Backup de $DIA concluído."
