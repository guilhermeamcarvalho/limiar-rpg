#!/usr/bin/env bash
# Migra um servidor montado quando o app se chamava LIMIAR para o nome MEMBRANA. Roda uma vez,
# como root, a partir de um clone atualizado do repositório (passo a passo em docs/servidor.md):
#
#   sudo git -C /root/limiar pull
#   sudo bash /root/limiar/deploy/migrar-para-membrana.sh
#
# O que muda: usuário limiar → membrana, /srv/limiar → /srv/membrana, limiar.db → membrana.db,
# /etc/limiar.env → /etc/membrana.env, serviços e comando de deploy, log do Caddy e a pasta do
# backup no Google Drive (limiar-backup → membrana-backup). No fim, publica a main com o nome
# novo e roda um backup. Os dados ficam; quem estava logado precisa entrar de novo (o cookie
# mudou de nome). Pode rodar de novo: o que já foi feito é pulado.
set -Eeuo pipefail

ETAPA='início'
passo() {
  ETAPA=$*
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}
falha() {
  printf '\n\033[31mERRO: %s\033[0m\n' "$*" >&2
  exit 1
}
aviso() { printf '\033[33mAviso: %s\033[0m\n' "$*"; }
trap 'falha "a etapa \"$ETAPA\" falhou. Corrija e rode de novo: o que já foi feito é pulado."' ERR

[[ $EUID -eq 0 ]] || falha "rode com sudo."
REPO=$(cd "$(dirname "$0")/.." && pwd)
[[ -f $REPO/deploy/membrana.service ]] ||
  falha "este clone ainda tem o nome antigo. Rode antes: sudo git -C $REPO pull"

VELHO=/srv/limiar
NOVO=/srv/membrana
[[ -d $VELHO || -d $NOVO ]] || falha "não achei $VELHO nem $NOVO: este servidor não foi preparado."

passo "1. Parando o serviço antigo"
systemctl disable --now limiar.service limiar-backup.timer 2> /dev/null || true
systemctl stop limiar-backup.service 2> /dev/null || true

passo "2. Cópia de segurança do banco"
if [[ -f $VELHO/data/limiar.db ]]; then
  sudo -u limiar mkdir -p "$VELHO/backups"
  copia="$VELHO/backups/antes-de-membrana-$(date +%Y%m%d-%H%M%S).db"
  # Como o dono do banco: rodando como root, o SQLite criaria arquivos -wal/-shm de root.
  sudo -u limiar sqlite3 "$VELHO/data/limiar.db" ".backup '$copia'"
  cp -- "$copia" /root/
  echo "Cópia em $copia (e em /root)"
else
  echo "Sem banco antigo: pulei."
fi

passo "3. Usuário e pastas"
if id limiar > /dev/null 2>&1 && ! id membrana > /dev/null 2>&1; then
  # O usermod recusa se houver processo do usuário rodando.
  pkill -u limiar 2> /dev/null || true
  sleep 1
  # Renomeia o usuário e move a casa dele (/srv/limiar, com tudo dentro) para /srv/membrana.
  usermod --login membrana --home "$NOVO" --move-home limiar
  groupmod --new-name membrana limiar
  echo "Usuário limiar agora é membrana; $VELHO agora é $NOVO."
else
  echo "Usuário já migrado: pulei."
fi
[[ -d $NOVO ]] || falha "$NOVO não existe depois da etapa 3."

passo "4. Banco e versão publicada"
for sufixo in '' -wal -shm; do
  if [[ -e $NOVO/data/limiar.db$sufixo ]]; then
    mv -- "$NOVO/data/limiar.db$sufixo" "$NOVO/data/membrana.db$sufixo"
  fi
done
# O link "current" guardava o caminho antigo.
if [[ -L $NOVO/current ]]; then
  alvo=$(readlink "$NOVO/current")
  ln -sfn "${alvo/#$VELHO\//$NOVO/}" "$NOVO/current"
fi
ls -ld "$NOVO"/data/membrana.db* "$NOVO/data/uploads" 2> /dev/null || true

passo "5. Configuração (/etc/membrana.env)"
if [[ -f /etc/limiar.env && ! -f /etc/membrana.env ]]; then
  sed -e "s#$VELHO/#$NOVO/#g" \
    -e 's#/data/limiar\.db#/data/membrana.db#' \
    -e 's#^\(BACKUP_REMOTO=.*\)limiar-backup$#\1membrana-backup#' \
    /etc/limiar.env > /etc/membrana.env
  rm -f /etc/limiar.env
  echo "Criado /etc/membrana.env a partir do antigo."
else
  echo "Já migrado: pulei."
fi
[[ -f /etc/membrana.env ]] || falha "não existe /etc/membrana.env."
chown root:membrana /etc/membrana.env
chmod 640 /etc/membrana.env
grep -E '^(DATABASE_PATH|UPLOADS_DIR|BACKUP_REMOTO)=' /etc/membrana.env

passo "6. Serviços e comando de deploy"
rm -f /etc/systemd/system/limiar.service /etc/systemd/system/limiar-backup.service \
  /etc/systemd/system/limiar-backup.timer /usr/local/sbin/limiar-deploy
install -m 644 "$REPO/deploy/membrana.service" /etc/systemd/system/membrana.service
install -m 644 "$REPO/deploy/backup.service" /etc/systemd/system/membrana-backup.service
install -m 644 "$REPO/deploy/backup.timer" /etc/systemd/system/membrana-backup.timer
install -m 755 "$REPO/deploy/deploy.sh" /usr/local/sbin/membrana-deploy
# Nomes dos arquivos de configuração que o preparar-servidor.sh criou.
[[ -f /etc/ssh/sshd_config.d/00-limiar.conf ]] &&
  mv /etc/ssh/sshd_config.d/00-limiar.conf /etc/ssh/sshd_config.d/00-membrana.conf
[[ -f /etc/apt/apt.conf.d/52limiar-unattended ]] &&
  mv /etc/apt/apt.conf.d/52limiar-unattended /etc/apt/apt.conf.d/52membrana-unattended
# Usuário de deploy automático, se foi configurado.
if [[ -f /etc/sudoers.d/limiar-deploy ]]; then
  sed 's#/usr/local/sbin/limiar-deploy#/usr/local/sbin/membrana-deploy#' \
    /etc/sudoers.d/limiar-deploy > /etc/sudoers.d/membrana-deploy
  chmod 440 /etc/sudoers.d/membrana-deploy
  visudo -cf /etc/sudoers.d/membrana-deploy
  rm -f /etc/sudoers.d/limiar-deploy
fi
sshd -t
systemctl daemon-reload
systemctl enable membrana.service membrana-backup.timer

passo "7. Caddy"
if grep -q '/var/log/caddy/limiar.log' /etc/caddy/Caddyfile; then
  sed -i 's#/var/log/caddy/limiar\.log#/var/log/caddy/membrana.log#' /etc/caddy/Caddyfile
  chown -R caddy:caddy /var/log/caddy
  sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  systemctl reload caddy
else
  echo "Já migrado: pulei."
fi

passo "8. Pasta do backup no Google Drive"
REMOTO=$({ grep -E '^BACKUP_REMOTO=' /etc/membrana.env || true; } | tail -n 1 | cut -d= -f2-)
migrar_remoto() {
  local antigo=${REMOTO%membrana-backup}limiar-backup
  if [[ $REMOTO != *membrana-backup ]]; then
    echo "BACKUP_REMOTO ($REMOTO) não segue o nome padrão: deixei como está."
    return 0
  fi
  if ! sudo -u membrana -H rclone lsf --max-depth 1 "$antigo" > /dev/null 2>&1; then
    echo "Não há $antigo (ou o rclone não está configurado): pulei."
    return 0
  fi
  if sudo -u membrana -H rclone lsf --max-depth 1 "$REMOTO" 2> /dev/null | grep -q .; then
    aviso "$antigo e $REMOTO existem os dois. Junte à mão; o backup novo usa $REMOTO."
    return 0
  fi
  sudo -u membrana -H rclone moveto "$antigo" "$REMOTO"
  local nome
  for nome in $(sudo -u membrana -H rclone lsf --files-only "$REMOTO/banco" | grep -E '^limiar-'); do
    sudo -u membrana -H rclone moveto "$REMOTO/banco/$nome" "$REMOTO/banco/${nome/#limiar-/membrana-}"
  done
  echo "Pasta renomeada para $REMOTO, com as cópias antigas renomeadas."
}
migrar_remoto || aviso "não consegui renomear a pasta do backup; os backups novos vão para $REMOTO."

passo "9. Publicando com o nome novo"
FORCAR=1 /usr/local/sbin/membrana-deploy

passo "10. Testando o backup"
if systemctl start membrana-backup; then
  sudo journalctl -u membrana-backup -n 3 --no-pager -o cat
else
  aviso "o backup falhou. Veja: sudo journalctl -u membrana-backup -n 30 --no-pager"
fi

printf '\n\033[32mMigração concluída.\033[0m\n'
cat << FIM
- O app agora é o serviço "membrana": sudo systemctl status membrana
- Para publicar: sudo membrana-deploy
- Quem estava logado precisa entrar de novo (o cookie de login mudou de nome).
- A cópia do banco de antes da migração está em /root/antes-de-membrana-*.db.
FIM
