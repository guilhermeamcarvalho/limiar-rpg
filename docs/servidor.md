# Servidor

Como montar, publicar, fazer backup e acompanhar a LIMIAR em produção. Os arquivos ficam em [`deploy/`](../deploy/); este guia diz quando usar cada um.

## Decisão

Decidido em 19/11/2026 (ver "Hospedagem, deploy e backup" na [arquitetura](arquitetura-tecnica.md)): **um VPS pequeno com Ubuntu LTS**, com o app como serviço do systemd atrás do Caddy. Fica sempre no ar, custa de zero a poucos dólares por mês e é tudo nosso. Fly.io e o PC com Cloudflare Tunnel ficaram de fora: o primeiro pede volume pago para o SQLite, e o segundo só funciona com o PC ligado.

Qualquer VPS com 1 vCPU e 1 a 2 GB de RAM serve (Hetzner CX22, Oracle Cloud Free Tier, Contabo e similares). Os scripts foram testados no **Ubuntu 24.04 LTS** e devem funcionar no 26.04 LTS e no Debian estável.

## Como fica o servidor

```text
Internet ──443──▶ Caddy (HTTPS automático) ──▶ 127.0.0.1:3000 Node (limiar.service)
                                                   │
/srv/limiar/                                       ▼
  repo.git/              espelho do GitHub        SQLite + uploads
  releases/<commit>/     uma pasta por versão (as 5 mais novas)
  current ──▶ releases/<commit>   a versão no ar
  data/limiar.db         o banco (fora das versões: sobrevive aos deploys)
  data/uploads/          mapas, tokens, fotos, músicas
  backups/               cópia do banco antes de cada deploy (as 10 mais novas)
/etc/limiar.env          configuração e segredos (root:limiar, 640)
/usr/local/sbin/limiar-deploy   o comando de deploy
```

- **`limiar.service`:** roda `node src/index.ts` como o usuário `limiar`, sem shell e sem sudo, e reinicia sozinho se o processo cair. Só consegue escrever em `/srv/limiar/data`.
- **`limiar-backup.timer`:** roda o backup às 4h todo dia.
- **Caddy:** pede e renova o certificado do Let's Encrypt sozinho e repassa WebSocket (a mesa) sem configuração extra.

## 1. Antes de começar

1. **Chave SSH no seu PC**, se ainda não tiver (PowerShell):

   ```powershell
   ssh-keygen -t ed25519 -C "limiar"
   Get-Content $HOME\.ssh\id_ed25519.pub   # cole isto no painel do VPS ao criar o servidor
   ```

2. **Crie o VPS** com Ubuntu 24.04 LTS (ou mais novo) e a sua chave pública. Anote o IP.
3. **Aponte o domínio:** no painel do seu domínio, crie um registro **A** com o nome escolhido (como `limiar` ou `@`) apontando para o IP. Se o VPS tiver IPv6, crie também um **AAAA**. Confira no PowerShell; deve aparecer o IP do VPS:

   ```powershell
   Resolve-DnsName limiar.seudominio.com
   ```

   O Caddy só consegue o certificado depois que o domínio aponta para o servidor.

## 2. Preparar o servidor (#25)

Entre como root (é como o VPS vem) e rode o script de preparação:

```bash
ssh root@<ip-do-servidor>
apt-get update && apt-get install -y git
git clone https://github.com/guilhermeamcarvalho/limiar-rpg.git /root/limiar
cd /root/limiar
bash deploy/preparar-servidor.sh --admin guilherme --dominio limiar.seudominio.com --email voce@exemplo.com
```

O script pede uma senha para o usuário `guilherme`. Ela serve só para o `sudo`; o SSH continua aceitando **apenas a chave**. Ele faz, nesta ordem:

1. atualiza o sistema e instala git, sqlite3, rclone, ufw e o resto;
2. cria o administrador com sudo e copia para ele a chave do root. Depois liga o SSH só por chave e sem root (`PermitRootLogin no`). Se o administrador não tiver chave, o script **para antes** de desligar a senha, para você não ficar trancado do lado de fora;
3. liga o firewall (22, 80 e 443) e as atualizações de segurança automáticas, com reinício às 5h quando uma atualização pedir;
4. instala o Node da versão do `.nvmrc` (NodeSource) e o pnpm da versão do `package.json`;
5. instala o Caddy com o seu domínio, o usuário `limiar`, as pastas, o `/etc/limiar.env` (já com um `SESSION_SECRET` novo) e os serviços do systemd.

Pode rodar de novo quando quiser: ele não estraga o que já está feito e não mexe no `/etc/limiar.env` existente.

**Antes de fechar a sessão do root**, abra outro terminal no PC e confirme que você entra como administrador:

```powershell
ssh guilherme@<ip-do-servidor>
sudo -v    # pede a senha que você acabou de definir
```

### Conferir (critérios de aceite da #25)

```bash
# Login por senha é recusado: a resposta deve ser "Permission denied (publickey)".
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password guilherme@<ip>
sudo ufw status          # só 22/tcp, 80/tcp e 443/tcp (e as mesmas em v6)
node -v                  # v26.x, a versão do .nvmrc
```

## 3. Configurar e publicar (#26 e #27)

1. **Configuração:** `sudo nano /etc/limiar.env`. O que cada variável faz está no próprio arquivo ([modelo](../deploy/limiar.env.example)). Para o login com Discord, cadastre no portal do Discord a URL de retorno `https://limiar.seudominio.com/api/auth/discord/callback`.
2. **Primeiro deploy:**

   ```bash
   sudo limiar-deploy
   ```

   Ele termina com `Publicado: 0.0.0+<commit>` e o `/health` respondendo com essa versão.

3. **Conferir:** abra `https://limiar.seudominio.com/health`. Deve responder `{"ok":true,"versao":"0.0.0+<commit>"}`, com o cadeado do navegador sem aviso.

### Conferir (critérios de aceite da #26)

```bash
curl https://limiar.seudominio.com/health                         # certificado válido, sem -k
sudo kill -9 $(systemctl show -p MainPID --value limiar)          # mata o app
sleep 5; systemctl is-active limiar; curl -s localhost:3000/health # voltou em segundos
journalctl -u limiar -n 20 --no-pager                              # os logs do app
```

## 4. Deploy do dia a dia (#27)

```bash
sudo limiar-deploy             # publica o último commit da main
sudo limiar-deploy a1b2c3d     # publica um commit, branch ou tag específico
sudo FORCAR=1 limiar-deploy    # refaz a versão que já está no ar
```

O script monta a versão nova numa pasta própria, instala, faz o build, copia o banco e roda as migrações. **Só então** troca o `current` e reinicia. Se qualquer passo antes da troca falhar (inclusive uma migração com erro), ele para e o serviço continua na versão anterior. A migração roda numa transação, então nada fica pela metade. Se depois do reinício o `/health` não responder com a versão nova em 40 s, ele volta sozinho para a versão anterior.

**Voltar para uma versão antiga à mão:** `sudo limiar-deploy <commit-antigo>`. Se a versão nova tinha migração, o banco já está migrado; em geral as migrações só acrescentam colunas e a versão antiga funciona. Se não funcionar, restaure a cópia de antes do deploy:

```bash
ls -t /srv/limiar/backups/            # antes-do-deploy-<data>-<commit>.db
sudo systemctl stop limiar
sudo -u limiar cp /srv/limiar/backups/antes-do-deploy-....db /srv/limiar/data/limiar.db
sudo rm -f /srv/limiar/data/limiar.db-wal /srv/limiar/data/limiar.db-shm
sudo systemctl start limiar
```

Quando o próprio `deploy/deploy.sh` mudar, o deploy avisa no fim e mostra o comando para atualizar o instalado.

### Deploy automático (opcional)

O workflow [`deploy.yml`](../.github/workflows/deploy.yml) publica sozinho quando o CI passa num push na `main`. Ele vem desligado. Para ligar:

1. No servidor, crie um usuário só para o deploy, que só pode rodar o `limiar-deploy`:

   ```bash
   sudo adduser --disabled-password --gecos '' deploy
   echo 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/limiar-deploy' | sudo tee /etc/sudoers.d/limiar-deploy
   sudo chmod 440 /etc/sudoers.d/limiar-deploy && sudo visudo -c
   ```

2. No PC, gere uma chave só para isso: `ssh-keygen -t ed25519 -f limiar-deploy -N '""'`. No servidor, coloque a pública em `/home/deploy/.ssh/authorized_keys` com `restrict ` no começo da linha (sem terminal e sem redirecionamentos).
3. No GitHub, em *Settings → Environments*, crie o ambiente `producao` com:
   - os segredos `DEPLOY_SSH_KEY` (a chave privada) e `DEPLOY_KNOWN_HOSTS` (a saída de `ssh-keyscan limiar.seudominio.com`);
   - as variáveis `DEPLOY_HOST` (o domínio) e `DEPLOY_USUARIO` (`deploy`).
4. Em *Settings → Variables*, crie `DEPLOY_AUTOMATICO` com o valor `true`.

## 5. Backup (#28)

Todo dia às 4h, o [`backup.sh`](../deploy/backup.sh) faz uma cópia consistente do banco (mesmo com o app gravando) e confere a integridade dela. Depois manda a cópia compactada e os uploads para o Google Drive pelo rclone e apaga as cópias com mais de 14 dias:

```text
gdrive:limiar-backup/
  banco/limiar-AAAA-MM-DD.db.gz      uma por dia, as 14 mais novas
  uploads/atual/                     espelho de data/uploads
  uploads/anteriores/AAAA-MM-DD/     o que foi apagado ou trocado naquele dia (14 dias)
```

### Ligar o rclone ao Google Drive (uma vez)

O servidor não tem navegador, então a autorização é feita no seu PC:

1. No PC: `winget install Rclone.Rclone`, reabra o terminal e rode `rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"`. O segundo argumento pede só o acesso **drive.file**, que deixa o rclone ver apenas os arquivos que ele mesmo criou. Entre na conta do Google no navegador que abrir e copie o token que aparece no terminal.
2. No servidor: `sudo -u limiar -H rclone config`, e responda:
   - `n` (novo remoto), nome **`gdrive`**, tipo **`drive`**;
   - deixe *client_id* e *client_secret* em branco, *scope* **`drive.file`**, *service_account_file* em branco;
   - *Edit advanced config?* `n`; *Use web browser to automatically authenticate?* **`n`**, e cole o token do passo 1;
   - *Configure this as a Shared Drive?* `n`; confirme com `y` e saia com `q`.
3. Teste agora, sem esperar a madrugada:

   ```bash
   sudo systemctl start limiar-backup
   journalctl -u limiar-backup -n 20 --no-pager     # termina com "Backup de <data> concluído."
   systemctl list-timers limiar-backup               # a próxima execução, às 4h
   ```

   A pasta `limiar-backup` aparece no seu Google Drive.

**Saber se o backup parou (opcional):** crie um monitor de cron no Sentry (*Crons → Add Monitor*, todo dia às 4h, tolerância de 60 min) e coloque a URL de check-in em `BACKUP_CHECKIN_URL` no `/etc/limiar.env`. O backup avisa quando começa, quando termina e quando falha; se uma noite passar sem aviso, o Sentry manda e-mail.

### Testar a restauração (todo mês)

Backup que nunca foi restaurado não é backup. No dia 1 de cada mês, o workflow [`lembrete-restauracao.yml`](../.github/workflows/lembrete-restauracao.yml) abre uma issue com este roteiro:

1. No PC, configure o rclone uma vez com o **mesmo nome de remoto** (`rclone config`: `n`, `gdrive`, `drive`, scope `drive.file`; aqui o navegador abre sozinho).
2. Na raiz do repositório, pelo **Git Bash**:

   ```bash
   deploy/restaurar.sh --listar        # as cópias que existem
   deploy/restaurar.sh                 # baixa a mais nova (ou: deploy/restaurar.sh 2026-11-19)
   ```

   Vai tudo para `data/restaurado/`, sem tocar no `data/` do dia a dia. O script confere a integridade do banco e mostra como abrir o app com ele.

3. Abra o app com o banco restaurado (no PowerShell, os comandos que o script mostrou), entre com a sua conta e confira se os casos de ontem estão lá.
4. Apague `data/restaurado/` e feche a issue.

**Restaurar em produção** (perda de dados de verdade):

```bash
# Baixa como o usuário limiar, que tem o rclone configurado (troque a data se precisar).
sudo -u limiar -H env LIMIAR_RESTAURAR_EM=/srv/limiar/restaurado \
  /srv/limiar/current/deploy/restaurar.sh 2026-11-19
sudo systemctl stop limiar
sudo -u limiar cp /srv/limiar/restaurado/limiar.db /srv/limiar/data/limiar.db
sudo rm -f /srv/limiar/data/limiar.db-wal /srv/limiar/data/limiar.db-shm
sudo -u limiar cp -r /srv/limiar/restaurado/uploads/. /srv/limiar/data/uploads/
sudo FORCAR=1 limiar-deploy       # roda as migrações no banco restaurado e sobe o app
sudo rm -rf /srv/limiar/restaurado
```

## 6. Erros e queda (#29)

### Sentry

1. Crie uma conta gratuita em sentry.io e **dois projetos**: um *Node.js* (`limiar-server`) e um *React* (`limiar-client`).
2. No `/etc/limiar.env`, preencha `SENTRY_DSN` com o DSN do projeto Node e `SENTRY_DSN_CLIENT` com o do React. O do client entra no build, então rode `sudo FORCAR=1 limiar-deploy` depois de mudar.
3. Teste com um erro forçado. No servidor:

   ```bash
   sudo -u limiar -H bash -c 'set -a; . /etc/limiar.env; . /srv/limiar/current/VERSAO.env; cd /srv/limiar/current/server && node src/scripts/testar-sentry.ts'
   ```

   No navegador, abra `https://limiar.seudominio.com/?testar-sentry=1`. Os dois erros aparecem no Sentry com a versão (`limiar@0.0.0+<commit>`). O Sentry manda e-mail a cada erro novo por padrão.

**O que não vai para o Sentry:** nome, e-mail ou id de quem usa; cookies e cabeçalhos (só o navegador, o `User-Agent`); corpo das requisições; a query das URLs; os códigos de convite (`/c/ERMIDA-3H33` vira `/c/:codigo`); o que a pessoa digita e o console do navegador. Isso fica em `server/src/observabilidade.ts` e `client/src/observabilidade.ts`, com testes.

### Monitor de disponibilidade

1. Crie uma conta gratuita no [UptimeRobot](https://uptimerobot.com).
2. *New monitor*: tipo **HTTP(s) – Keyword**, URL `https://limiar.seudominio.com/health`, palavra-chave `"ok":true`, intervalo **5 minutos**, alerta por **e-mail**.
3. Teste: `sudo systemctl stop limiar`, espere o e-mail (em até 5 minutos) e depois `sudo systemctl start limiar`. Chega outro e-mail avisando que voltou.

## Comandos do dia a dia

| Para | Comando |
| --- | --- |
| Ver os logs do app ao vivo | `journalctl -u limiar -f` |
| Estado do app | `systemctl status limiar` |
| Reiniciar o app | `sudo systemctl restart limiar` |
| Versão no ar | `curl -s localhost:3000/health` |
| Logs do backup | `journalctl -u limiar-backup -n 30 --no-pager` |
| Próximo backup | `systemctl list-timers limiar-backup` |
| Logs do Caddy | `journalctl -u caddy -n 30 --no-pager` e `/var/log/caddy/limiar.log` |
| Recarregar o Caddy | `sudo systemctl reload caddy` |
| Espaço em disco | `df -h /srv` |
