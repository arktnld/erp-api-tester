# ERP API Tester

Testa, documenta e compartilha chamadas às APIs de ERPs de provedores de internet, sem Postman
espalhado por cada máquina: as credenciais de cada empresa ficam num lugar só, o token é renovado
sozinho e o time inteiro vê o mesmo histórico.

Vem com modelos prontos de **IXC Provedor, SGP, Hubsoft, Voalle e MK Solutions** (endpoints, modos de
autenticação e campos do cliente). Na primeira entrada, um assistente cadastra o ERP, a empresa, testa
a conexão e faz a primeira chamada por CPF em uns 2 minutos. Outros ERPs entram importando Postman,
curl ou OpenAPI.

## O que tem

- **Testar API**: qualquer endpoint, com os campos do cliente de teste preenchidos sozinhos
- **Autenticação**: Basic, Bearer, API key, campos no corpo ou token obtido num endpoint (renovado sozinho); vários modos por ERP
- **Fluxos**: chamadas encadeadas, com uma resposta alimentando a próxima
- **Registros**: chamadas salvas e documentadas, com link de visualização compartilhável
- **Histórico**: toda chamada, com filtros (credenciais mascaradas)
- **Usuários**: admin, editor e leitor, com login próprio (senhas scrypt, sessões no banco)

## Stack

Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL · pnpm workspaces · Vitest. Roda numa VPS com PM2 ou em Docker.

## Instalação numa VPS (Ubuntu/Debian)

Da sua máquina, com acesso SSH ao servidor:

```bash
bash scripts/setup-server.sh usuario@servidor voce@empresa.com "Seu Nome"
```

Instala Node 22, pnpm, PM2 e PostgreSQL, cria o banco e o `.env`, faz o primeiro deploy e cria o
primeiro admin (a senha aparece uma vez no terminal). O app fica em `http://servidor:9000`.

Atualizações depois disso:

```bash
bash scripts/deploy.sh usuario@servidor   # ou SERVER=usuario@servidor em scripts/deploy.local
```

O deploy baixa o código, aplica as migrations, compila e recarrega o PM2 (4 instâncias, sem derrubar o site).

## Docker

```bash
docker compose up -d --build
docker compose exec web sh -c 'cd apps/web && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-user.mts voce@empresa.com "Seu Nome" admin'
```

## Desenvolvimento

```bash
pnpm install
echo 'DATABASE_URL="postgresql://usuario:senha@localhost:5432/erp_tester"' > apps/web/.env
ln -sf ../../apps/web/.env packages/db/.env
pnpm --filter @erp/db exec prisma migrate deploy
(cd apps/web && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env scripts/create-user.mts voce@empresa.com "Seu Nome" admin)
pnpm --filter web dev
```

A única variável obrigatória é `DATABASE_URL`.

## Estrutura

```
apps/web/          aplicação Next.js (app/, components/, lib/)
  lib/erp-templates/  modelos prontos de ERP (JSON)
packages/db/       schema e migrations do Prisma
scripts/           instalação e deploy na VPS
```

## Contribuindo

Testes: `pnpm --filter web exec vitest run`. Um modelo de ERP novo é um JSON em
`apps/web/lib/erp-templates/` mais uma linha em `index.ts`; o teste ao lado confere a estrutura.

## Licença

[MIT](LICENSE)
