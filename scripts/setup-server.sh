#!/bin/bash
# Instalação numa VPS nova (Ubuntu/Debian) — roda UMA vez.
# Uso: bash scripts/setup-server.sh usuario@servidor email-do-admin "Nome do admin"
#
# Instala Node 22, pnpm, PM2 e PostgreSQL; cria banco e .env; faz o primeiro deploy
# (migrations, build, PM2 em cluster) e cria o primeiro admin, mostrando a senha uma vez.
# Opcional: REPO (padrão: este repositório no GitHub), APP_DIR, BRANCH.

set -e

SERVER="$1"
ADMIN_EMAIL="$2"
ADMIN_NAME="${3:-Admin}"
if [ -z "$SERVER" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "uso: bash scripts/setup-server.sh usuario@servidor email-do-admin \"Nome do admin\""
  exit 1
fi
REPO="${REPO:-https://github.com/arktnld/erp-api-tester.git}"
APP_DIR="${APP_DIR:-/opt/erp-api-tester-next}"
BRANCH="${BRANCH:-master}"
DB_NAME="erp_api"
DB_USER="erp_user"
DB_PASS="$(openssl rand -hex 24)"

echo "==> Preparando $SERVER..."
ssh "$SERVER" bash -s <<REMOTE
set -e

echo "--- Pacotes do sistema ---"
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates postgresql

echo "--- Node.js 22, pnpm e PM2 ---"
if ! command -v node >/dev/null || [ "\$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pnpm@10 pm2

echo "--- PostgreSQL ---"
sudo systemctl enable --now postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "usuário $DB_USER já existe (senha mantida)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "banco $DB_NAME já existe"

echo "--- Código ---"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo git clone --branch $BRANCH $REPO $APP_DIR
  sudo chown -R \$(whoami):\$(whoami) $APP_DIR
fi

echo "--- .env (app e migrations leem o mesmo arquivo) ---"
if [ ! -f "$APP_DIR/apps/web/.env" ]; then
  umask 077
  printf 'DATABASE_URL="postgresql://%s:%s@localhost:5432/%s"\n' "$DB_USER" "$DB_PASS" "$DB_NAME" > "$APP_DIR/apps/web/.env"
fi
ln -sf ../../apps/web/.env "$APP_DIR/packages/db/.env"

echo "--- PM2 volta sozinho quando o servidor reinicia ---"
sudo env PATH=\$PATH pm2 startup systemd -u \$(whoami) --hp \$HOME >/dev/null
REMOTE

echo "==> Primeiro deploy (migrations, build, PM2)..."
SERVER="$SERVER" APP_DIR="$APP_DIR" BRANCH="$BRANCH" bash "$(dirname "$0")/deploy.sh" "$SERVER"

echo "==> Primeiro admin ($ADMIN_EMAIL)..."
ssh "$SERVER" "cd $APP_DIR/apps/web && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env scripts/create-user.mts '$ADMIN_EMAIL' '$ADMIN_NAME' admin"

echo ""
echo "==> Pronto: http://${SERVER#*@}:9000"
echo "    Entre com o e-mail e a senha acima e troque a senha em Configurações → Minha conta."
