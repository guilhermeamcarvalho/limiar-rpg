#!/usr/bin/env bash
# Prepara um VPS novo (Ubuntu LTS ou Debian estável) para a MEMBRANA. Rode como root, uma vez,
# de dentro de um clone do repositório (passo a passo em docs/servidor.md):
#
#   bash deploy/preparar-servidor.sh --admin guilherme --dominio membrana.exemplo.com \
#     --email voce@exemplo.com
#
# O que faz (pode rodar de novo sem estragar nada):
#   1. atualiza o sistema e instala o básico (git, sqlite3, rclone, ufw, ...)
#   2. usuário administrador com sudo e a chave SSH do root; SSH só por chave, sem root
#   3. firewall liberando só 22, 80 e 443; atualizações de segurança automáticas
#   4. Node (versão do .nvmrc) e pnpm (versão do package.json)
#   5. Caddy, usuário "membrana", pastas em /srv/membrana, /etc/membrana.env e os serviços do systemd
# Não publica o app: depois dele, configure /etc/membrana.env e rode sudo membrana-deploy.
set -Eeuo pipefail

ADMIN=''
DOMINIO=''
EMAIL=''
FUSO='America/Sao_Paulo'
REPO_URL=''

uso() {
  sed -n '2,15p' "$0"
  echo
  echo "Opções: --admin USUARIO --dominio DOMINIO --email EMAIL [--fuso $FUSO] [--repo URL]"
}
while [[ $# -gt 0 ]]; do
  case $1 in
    --admin) ADMIN=$2 && shift 2 ;;
    --dominio) DOMINIO=$2 && shift 2 ;;
    --email) EMAIL=$2 && shift 2 ;;
    --fuso) FUSO=$2 && shift 2 ;;
    --repo) REPO_URL=$2 && shift 2 ;;
    -h | --help) uso && exit 0 ;;
    *) uso >&2 && exit 2 ;;
  esac
done

ETAPA='início'
passo() {
  ETAPA=$*
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}
falha() {
  printf '\n\033[31mERRO: %s\033[0m\n' "$*" >&2
  exit 1
}
trap 'falha "a etapa \"$ETAPA\" falhou. Corrija e rode de novo: o script pode ser repetido."' ERR

[[ $EUID -eq 0 ]] || falha "rode como root (ou com sudo)."
[[ -n $ADMIN && -n $DOMINIO && -n $EMAIL ]] || {
  uso >&2
  falha "faltou --admin, --dominio ou --email."
}
[[ $ADMIN =~ ^[a-z_][a-z0-9_-]*$ ]] || falha "nome de usuário inválido: $ADMIN"
[[ $DOMINIO =~ ^[a-z0-9.-]+$ ]] || falha "domínio inválido: $DOMINIO"

AQUI=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$AQUI/.." && pwd)
[[ -f $REPO/.nvmrc && -f $REPO/deploy/membrana.service ]] ||
  falha "rode de dentro de um clone do repositório (não achei .nvmrc e deploy/)."
NODE_MAIOR=$(tr -dc '0-9' < "$REPO/.nvmrc")
PNPM_VERSAO=$(sed -n 's/.*"packageManager": *"pnpm@\([^"]*\)".*/\1/p' "$REPO/package.json")
[[ -n $NODE_MAIOR && -n $PNPM_VERSAO ]] || falha "não consegui ler a versão do Node ou do pnpm."
REPO_URL=${REPO_URL:-$(git -C "$REPO" remote get-url origin)}

# shellcheck source=/dev/null
. /etc/os-release
[[ ${ID:-} == ubuntu || ${ID:-} == debian ]] ||
  echo "Aviso: testado em Ubuntu LTS e Debian; este sistema é ${PRETTY_NAME:-desconhecido}."
export DEBIAN_FRONTEND=noninteractive

passo "1. Sistema e pacotes"
apt-get update -q
apt-get -y -q upgrade
# build-essential e python3: só se o better-sqlite3 precisar compilar (sem binário pronto).
apt-get -y -q install ca-certificates curl gnupg git sqlite3 rclone ufw unattended-upgrades \
  openssh-server sudo openssl build-essential python3
timedatectl set-timezone "$FUSO" 2> /dev/null || ln -sf "/usr/share/zoneinfo/$FUSO" /etc/localtime

passo "2. Administrador ($ADMIN) e SSH"
if ! id "$ADMIN" > /dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$ADMIN"
fi
usermod -aG sudo "$ADMIN"
CASA=$(getent passwd "$ADMIN" | cut -d: -f6)
install -d -m 700 -o "$ADMIN" -g "$ADMIN" "$CASA/.ssh"
CHAVES="$CASA/.ssh/authorized_keys"
# Traz as chaves do root (é por onde você entrou) se o administrador ainda não tiver nenhuma.
if [[ ! -s $CHAVES && -s /root/.ssh/authorized_keys ]]; then
  install -m 600 -o "$ADMIN" -g "$ADMIN" /root/.ssh/authorized_keys "$CHAVES"
fi
grep -qE '^(ssh-|ecdsa-|sk-)' "$CHAVES" 2> /dev/null ||
  falha "$ADMIN não tem chave SSH em $CHAVES. Coloque a sua chave pública lá e rode de novo; sem isso, desligar a senha trancaria você fora."
# sudo pede a senha do administrador: sem senha, não haveria como usar o sudo.
if passwd -S "$ADMIN" | awk '{exit !($2 == "L" || $2 == "NP")}'; then
  echo "Defina a senha de $ADMIN (é pedida pelo sudo; o login no SSH continua só por chave):"
  passwd "$ADMIN"
fi
# "00-" vem antes dos arquivos da nuvem (como 50-cloud-init.conf): no sshd, vale o primeiro.
cat > /etc/ssh/sshd_config.d/00-membrana.conf << 'FIM'
# MEMBRANA: login só por chave, nunca como root. Ver docs/servidor.md.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 30
FIM
sshd -t || falha "a configuração do SSH ficou inválida; nada foi recarregado."
systemctl reload ssh 2> /dev/null || systemctl reload sshd

passo "3. Firewall e atualizações automáticas"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy redireciona e emite o certificado)'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'FIM'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
FIM
cat > /etc/apt/apt.conf.d/52membrana-unattended << 'FIM'
// Reinicia sozinho quando uma atualização pede, às 5h (longe das sessões de jogo).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
FIM
systemctl enable --now unattended-upgrades

passo "4. Node $NODE_MAIOR e pnpm $PNPM_VERSAO"
if [[ $(node -v 2> /dev/null || true) != v$NODE_MAIOR.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_$NODE_MAIOR.x" -o /tmp/nodesource.sh
  bash /tmp/nodesource.sh
  rm -f /tmp/nodesource.sh
  apt-get -y -q install nodejs
fi
[[ $(node -v) == v$NODE_MAIOR.* ]] || falha "node -v mostra $(node -v), e o .nvmrc pede $NODE_MAIOR."
# Desde o Node 25 o corepack não vem junto: o pnpm vem do npm.
# --allow-scripts: o npm novo bloqueia o script que instala o binário do pnpm.
npm install -g --no-fund --no-audit --allow-scripts=pnpm "pnpm@$PNPM_VERSAO"

passo "5. Caddy"
if ! command -v caddy > /dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get -y -q install caddy
fi
sed -e "s/membrana\.exemplo\.com/$DOMINIO/g" -e "s/admin@$DOMINIO/$EMAIL/" \
  "$REPO/deploy/Caddyfile" > /etc/caddy/Caddyfile
# O log é do usuário caddy, que roda o serviço. O chown conserta um log criado por root
# (como faz um "caddy validate" rodado como root), e a validação já roda como caddy.
install -d -o caddy -g caddy /var/log/caddy
chown -R caddy:caddy /var/log/caddy
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy 2> /dev/null || systemctl restart caddy

passo "6. Usuário membrana, pastas e configuração"
if ! id membrana > /dev/null 2>&1; then
  useradd --system --home-dir /srv/membrana --create-home --shell /usr/sbin/nologin membrana
fi
install -d -m 750 -o membrana -g membrana /srv/membrana /srv/membrana/releases /srv/membrana/data \
  /srv/membrana/data/uploads /srv/membrana/backups
if [[ ! -d /srv/membrana/repo.git ]]; then
  sudo -u membrana -H git clone --quiet --mirror "$REPO_URL" /srv/membrana/repo.git
fi
if [[ ! -f /etc/membrana.env ]]; then
  sed -e "s#^BASE_URL=.*#BASE_URL=https://$DOMINIO#" \
    -e "s#^SESSION_SECRET=.*#SESSION_SECRET=$(openssl rand -hex 32)#" \
    "$REPO/deploy/membrana.env.example" > /etc/membrana.env
  echo "Criado /etc/membrana.env (com SESSION_SECRET novo). Revise: sudo nano /etc/membrana.env"
else
  echo "/etc/membrana.env já existe: não mexi."
fi
chown root:membrana /etc/membrana.env
chmod 640 /etc/membrana.env

passo "7. Serviços do systemd e comando de deploy"
install -m 644 "$REPO/deploy/membrana.service" /etc/systemd/system/membrana.service
install -m 644 "$REPO/deploy/backup.service" /etc/systemd/system/membrana-backup.service
install -m 644 "$REPO/deploy/backup.timer" /etc/systemd/system/membrana-backup.timer
install -m 755 "$REPO/deploy/deploy.sh" /usr/local/sbin/membrana-deploy
systemctl daemon-reload
systemctl enable membrana.service membrana-backup.timer
systemctl start membrana-backup.timer

cat << FIM

$(printf '\033[32mServidor pronto.\033[0m')
Antes de fechar esta sessão, abra OUTRO terminal no seu PC e confirme que entra assim:
  ssh $ADMIN@<ip-do-servidor>
e que "sudo -v" aceita a senha. Só depois feche a sessão do root.

Próximos passos (docs/servidor.md):
  1. sudo nano /etc/membrana.env          Discord e Sentry, se for usar
  2. configurar o rclone (backup)       sudo -u membrana -H rclone config
  3. sudo membrana-deploy                  publica a main
  4. https://$DOMINIO/health             deve responder {"ok":true,...}
FIM
