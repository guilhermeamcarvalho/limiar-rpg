#!/usr/bin/env bash
# Publica uma versão nova da LIMIAR no servidor. Instalado como /usr/local/sbin/limiar-deploy.
#
#   sudo limiar-deploy           publica o último commit da main
#   sudo limiar-deploy <commit>  publica um commit (ou branch, ou tag) específico
#
# Cada versão vive na própria pasta (/srv/limiar/releases/<commit>) e "current" aponta para a
# publicada. A ordem garante que o serviço no ar só muda se tudo der certo:
#   1. busca o código e monta a pasta nova     4. backup rápido do banco
#   2. instala as dependências                 5. migrações (numa transação: erro não deixa nada)
#   3. build do client                         6. troca o "current", reinicia e confere o /health
# Qualquer falha de 1 a 5 para o script com o serviço antigo intacto. Se o /health não responder
# com a versão nova, o "current" volta para a versão anterior e o serviço é reiniciado nela.
# Os `bash -c '...'` recebem os valores como $1, $2... de propósito (sem risco com aspas).
# shellcheck disable=SC2016
set -Eeuo pipefail

RAIZ=${LIMIAR_RAIZ:-/srv/limiar}
USUARIO=${LIMIAR_USUARIO:-limiar}
SERVICO=${LIMIAR_SERVICO:-limiar}
AMBIENTE=${LIMIAR_AMBIENTE:-/etc/limiar.env}
MANTER_VERSOES=5
MANTER_BACKUPS=10
ESPERA_HEALTH_S=40

REF=${1:-main}

ETAPA='início'
passo() {
  ETAPA=$*
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}
falha() {
  printf '\n\033[31mERRO: %s\033[0m\n' "$*" >&2
  exit 1
}
# Comandos do app rodam como o usuário do serviço, com o HOME dele (cache do pnpm, rclone).
como_app() { sudo -u "$USUARIO" -H -- env CI=true "$@"; }
# Lê uma variável do arquivo de ambiente sem executá-lo.
ler_var() { { grep -E "^$1=" "$AMBIENTE" || true; } | tail -n 1 | cut -d= -f2-; }

trap 'falha "a etapa \"$ETAPA\" falhou. Nada foi trocado: o serviço continua na versão anterior."' ERR

[[ $EUID -eq 0 ]] || falha "rode com sudo: sudo limiar-deploy"
[[ -r $AMBIENTE ]] || falha "não encontrei $AMBIENTE (veja docs/servidor.md)"
[[ -d $RAIZ/repo.git ]] || falha "não encontrei $RAIZ/repo.git (veja docs/servidor.md)"

# Um deploy por vez.
exec 9> /run/lock/limiar-deploy.lock
flock -n 9 || falha "já tem um deploy rodando"

PORTA=$(ler_var PORT)
PORTA=${PORTA:-3000}
BANCO=$(ler_var DATABASE_PATH)
[[ -n $BANCO ]] || falha "DATABASE_PATH não está em $AMBIENTE"

passo "Buscando $REF"
como_app git -C "$RAIZ/repo.git" fetch --quiet --prune --tags origin '+refs/heads/*:refs/heads/*'
SHA=$(como_app git -C "$RAIZ/repo.git" rev-parse --verify --quiet "$REF^{commit}") ||
  falha "não achei \"$REF\" no repositório"
CURTO=${SHA:0:7}
VERSAO_DO_PACOTE=$(como_app git -C "$RAIZ/repo.git" show "$SHA:server/package.json" |
  sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' | head -n 1)
VERSAO="${VERSAO_DO_PACOTE:-0.0.0}+$CURTO"
NOVA="$RAIZ/releases/$SHA"
ANTERIOR=$(readlink -f "$RAIZ/current" || true)

if [[ $ANTERIOR == "$NOVA" && ${FORCAR:-0} != 1 ]]; then
  echo "A versão $VERSAO já está publicada. Para refazer: sudo FORCAR=1 limiar-deploy $REF"
  exit 0
fi
echo "Publicando $VERSAO ($(como_app git -C "$RAIZ/repo.git" log -1 --format=%s "$SHA"))"

passo "Montando $NOVA"
# Sobra de uma tentativa que falhou: começa do zero. Nunca apaga a versão no ar.
if [[ -e $NOVA && $NOVA != "$ANTERIOR" ]]; then rm -rf -- "$NOVA"; fi
como_app mkdir -p "$NOVA"
como_app bash -c 'git -C "$1" archive "$2" | tar -x -C "$3"' _ "$RAIZ/repo.git" "$SHA" "$NOVA"
como_app bash -c 'printf "LIMIAR_VERSAO=%s\n" "$1" > "$2/VERSAO.env"' _ "$VERSAO" "$NOVA"

passo "Instalando dependências"
como_app bash -c 'cd "$1" && pnpm install --frozen-lockfile --prefer-offline' _ "$NOVA"

passo "Build"
como_app env VITE_LIMIAR_VERSAO="$VERSAO" VITE_SENTRY_DSN="$(ler_var SENTRY_DSN_CLIENT)" \
  bash -c 'cd "$1" && pnpm build' _ "$NOVA"

passo "Backup rápido do banco"
if [[ -f $BANCO ]]; then
  como_app mkdir -p "$RAIZ/backups"
  COPIA="$RAIZ/backups/antes-do-deploy-$(date +%Y%m%d-%H%M%S)-$CURTO.db"
  como_app sqlite3 "$BANCO" ".backup '$COPIA'"
  echo "Cópia em $COPIA"
  # Fica com as $MANTER_BACKUPS mais novas.
  find "$RAIZ/backups" -maxdepth 1 -name 'antes-do-deploy-*.db' -printf '%T@ %p\n' |
    sort -rn | tail -n +$((MANTER_BACKUPS + 1)) | cut -d' ' -f2- | xargs -r rm -f --
else
  echo "Ainda não há banco em $BANCO: primeira publicação."
fi

passo "Migrações"
como_app env DATABASE_PATH="$BANCO" bash -c 'cd "$1" && pnpm db:migrate' _ "$NOVA"

# Daqui em diante, o serviço muda. Erros são tratados à mão, com volta à versão anterior.
trap - ERR

# Espera o /health responder com a versão pedida. Devolve 0 se respondeu.
esperar_health() {
  local versao=$1
  for ((i = 0; i < ESPERA_HEALTH_S; i++)); do
    resposta=$(curl -fsS --max-time 2 "http://127.0.0.1:$PORTA/health" 2> /dev/null || true)
    if [[ -z $versao || $resposta == *"\"versao\":\"$versao\""* ]]; then
      [[ -n $resposta ]] && return 0
    fi
    sleep 1
  done
  return 1
}

voltar() {
  printf '\n\033[31m%s\033[0m\n' "$1" >&2
  echo "Veja o que aconteceu: journalctl -u $SERVICO -n 50 --no-pager" >&2
  if [[ -z $ANTERIOR || ! -d $ANTERIOR ]]; then
    echo "Não há versão anterior para voltar: o serviço está fora do ar." >&2
    exit 1
  fi
  echo "Voltando para a versão anterior ($(basename "$ANTERIOR" | cut -c1-7))..." >&2
  ln -sfn "$ANTERIOR" "$RAIZ/current.tmp" && mv -Tf "$RAIZ/current.tmp" "$RAIZ/current"
  # A versão quebrada reiniciou várias vezes enquanto o deploy esperava, e o systemd pode ter
  # desistido (limite de reinícios). Sem zerar o contador, o restart seria recusado.
  systemctl reset-failed "$SERVICO" || true
  systemctl restart "$SERVICO" || true
  if esperar_health ''; then
    echo "A versão anterior voltou ao ar: $resposta" >&2
    echo "As migrações desta versão já foram aplicadas. Se algo estranhar, restaure a cópia" >&2
    echo "do banco em $RAIZ/backups (veja docs/servidor.md)." >&2
  else
    echo "ATENÇÃO: nem a versão anterior respondeu. O site está fora do ar." >&2
  fi
  exit 1
}

passo "Trocando para $VERSAO e reiniciando"
ln -sfn "$NOVA" "$RAIZ/current.tmp" && mv -Tf "$RAIZ/current.tmp" "$RAIZ/current"
systemctl reset-failed "$SERVICO" || true
systemctl restart "$SERVICO" || voltar "O serviço não reiniciou."

passo "Conferindo /health"
esperar_health "$VERSAO" ||
  voltar "O /health não respondeu com a versão $VERSAO em ${ESPERA_HEALTH_S}s."
echo "$resposta"

passo "Limpando versões antigas"
# Fica com as $MANTER_VERSOES mais novas, nunca apagando a publicada nem a anterior.
find "$RAIZ/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn |
  tail -n +$((MANTER_VERSOES + 1)) | cut -d' ' -f2- |
  while read -r pasta; do
    if [[ $pasta != "$NOVA" && $pasta != "$ANTERIOR" ]]; then rm -rf -- "$pasta"; fi
  done

# O próprio script instalado é uma cópia: avisa se a versão nova trouxe mudanças nele.
if ! cmp -s "$0" "$NOVA/deploy/deploy.sh"; then
  printf '\nAviso: deploy/deploy.sh mudou nesta versão. Atualize o instalado com:\n'
  printf '  sudo install -m 755 %s /usr/local/sbin/limiar-deploy\n' "$NOVA/deploy/deploy.sh"
fi

printf '\n\033[32mPublicado: %s\033[0m\n' "$VERSAO"
