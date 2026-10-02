<div align="center">

<img alt="ERP Tester" src="docs/screenshots/logo-banner.png" width="600">

### Teste, documente e compartilhe as APIs dos seus sistemas, em equipe

REST, SOAP e GraphQL. Credenciais de cada empresa num lugar só, token renovado sozinho
e o time inteiro vendo o mesmo histórico. Roda no seu servidor.

[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-4183c4?style=flat-square)](LICENSE)
[![gitleaks](https://img.shields.io/github/actions/workflow/status/arktnld/erp-api-tester/gitleaks.yml?branch=master&label=gitleaks&style=flat-square)](https://github.com/arktnld/erp-api-tester/actions/workflows/gitleaks.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-pronto-2496ed?style=flat-square&logo=docker&logoColor=white)
[![PRs bem-vindos](https://img.shields.io/badge/PRs-bem--vindos-2ea44f?style=flat-square)](#contribuindo)

[Instalação](#instalação-numa-vps-ubuntudebian) · [Docker](#docker) · [Desenvolvimento](#desenvolvimento) · [REST, SOAP e GraphQL](#rest-soap-e-graphql) · [Contribuindo](#contribuindo)

<br>

<img src="docs/screenshots/hero.png" alt="Tela Testar API: consulta GraphQL e a resposta" width="100%">

</div>

## Por que existe

Quem integra com ERPs e outros sistemas vive com coleções do Postman espalhadas por cada máquina, tokens
vencendo no meio do teste e credenciais coladas em conversa. O ERP Tester junta isso num lugar: cada empresa
(cliente, ambiente ou filial) guarda as próprias credenciais, mascaradas no histórico; o token é obtido e
renovado sozinho; e qualquer pessoa do time repete a chamada que outra fez.

## Primeira chamada em 2 minutos

Na primeira entrada, um assistente pergunta o tipo da API (REST, SOAP ou GraphQL), o endereço e a
autenticação, faz uma chamada de verdade e explica em português o que deu errado, se der.

<img src="docs/screenshots/setup.png" alt="Assistente de primeira configuração" width="100%">

## O que tem

<table>
  <tr>
    <td width="50%" valign="top">
      <b>Testar API</b><br>
      Qualquer endpoint, com os campos do cliente de teste preenchidos sozinhos, resposta em JSON navegável, headers e linha do tempo.
    </td>
    <td width="50%" valign="top">
      <b>Histórico</b><br>
      Toda chamada guardada, com filtros por empresa, endpoint, cliente, status e usuário. Credenciais mascaradas.
    </td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/test-api.png" alt="Testar API"></td>
    <td><img src="docs/screenshots/history.png" alt="Histórico de requisições"></td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <b>ERPs e endpoints</b><br>
      Endpoints agrupados por assunto, campos do cliente com preenchimento automático e vários modos de autenticação por ERP. Importa Postman, curl ou OpenAPI.
    </td>
    <td width="50%" valign="top">
      <b>Início</b><br>
      Visão geral, últimas requisições com "Repetir" em um clique e as empresas cadastradas.
    </td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/erp.png" alt="Página de um ERP com endpoints agrupados"></td>
    <td><img src="docs/screenshots/home.png" alt="Tela inicial"></td>
  </tr>
</table>

E também:

- **Autenticação**: Basic, Bearer, API key, campos no corpo ou token obtido num endpoint (renovado sozinho)
- **Fluxos**: chamadas encadeadas, com uma resposta alimentando a próxima
- **Registros**: chamadas salvas e documentadas, com link de visualização compartilhável
- **Usuários**: admin, editor e leitor, com login próprio (senhas scrypt, sessões no banco, bloqueio após tentativas erradas)
- **Segurança**: chamadas só para a URL da empresa, bloqueio de IPs internos (SSRF), credenciais nunca vão para o navegador de quem não pode vê-las

## REST, SOAP e GraphQL

Como no [Bruno](https://github.com/usebruno/bruno), SOAP e GraphQL são chamadas HTTP: o que muda é o corpo e o `Content-Type`.

| Tipo | Como fica no ERP Tester |
|---|---|
| REST / JSON | Qualquer método, `{placeholders}` no caminho e no corpo, resposta JSON navegável |
| SOAP / XML | POST com o envelope XML (`text/xml` ou `application/soap+xml`), resposta XML formatada |
| GraphQL | POST com `{"query": ..., "variables": ...}` num único endpoint |

<img src="docs/screenshots/soap.png" alt="Chamada SOAP com envelope XML e a resposta" width="100%">

Os endpoints entram um a um ou importados de uma coleção Postman, OpenAPI ou curl.

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
apps/web/             aplicação Next.js (app/, components/, lib/)
packages/db/          schema e migrations do Prisma
scripts/              instalação e deploy na VPS
docs/screenshots/     imagens deste README
```

## Contribuindo

Issues e pull requests são bem-vindos.

- Testes: `pnpm --filter web exec vitest run`
- Nunca coloque credenciais, nomes de clientes ou IPs reais em código, testes ou capturas de tela. O gitleaks barra segredos em todo push.

## Licença

[MIT](LICENSE) © arktnld
