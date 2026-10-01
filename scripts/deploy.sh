#!/bin/bash
# Deploy da aplicação — roda a cada atualização.
# Uso: bash scripts/deploy.sh usuario@servidor
#   ou crie scripts/deploy.local (fora do git) com SERVER=usuario@servidor
#   APP_DIR (padrão /opt/erp-api-tester-next) e BRANCH (padrão master) também podem vir dele.

set -e

[ -f "$(dirname "$0")/deploy.local" ] && source "$(dirname "$0")/deploy.local"
SERVER="${1:-$SERVER}"
APP_DIR="${APP_DIR:-/opt/erp-api-tester-next}"
BRANCH="${BRANCH:-master}"
if [ -z "$SERVER" ]; then echo "uso: bash scripts/deploy.sh usuario@servidor (ou SERVER=... em scripts/deploy.local)"; exit 1; fi

PM2_APP="erp-api"

echo "==> Deploy iniciado em $SERVER"

ssh "$SERVER" bash -s << REMOTE
set -e

export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && source "\$NVM_DIR/nvm.sh"

cd $APP_DIR

echo "--- Baixando últimas alterações ---"
git pull origin $BRANCH

echo "--- Instalando dependências ---"
pnpm install --frozen-lockfile

echo "--- Rodando migrations do banco ---"
pnpm --filter @erp/db exec prisma migrate deploy

echo "--- Gerando Prisma Client ---"
pnpm --filter @erp/db exec prisma generate

echo "--- Build da aplicação ---"
pnpm --filter web build

echo "--- Recarregando PM2 (cluster, sem downtime) ---"
if pm2 describe $PM2_APP 2>/dev/null | grep -q "exec mode.*cluster"; then
  pm2 reload ecosystem.config.cjs --update-env
else
  # primeira vez em cluster: o processo antigo (fork) precisa sair antes
  pm2 delete $PM2_APP 2>/dev/null || true
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo ""
echo "==> Deploy concluído! App rodando em http://${SERVER#*@}:9000"
REMOTE
