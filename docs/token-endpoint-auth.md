# Token via Endpoint — Design

## Problema

Alguns ERPs (ex: MKSolutions) exigem autenticação dinâmica: um token obtido via requisição que expira e precisa ser renovado. O sistema atual só suporta tokens estáticos.

## Solução

Novo tipo de autenticação `token_endpoint` na empresa. As credenciais ficam na empresa (não no cliente de teste). O token é obtido sob demanda e cacheado no banco.

---

## Configuração da Empresa

Novo `authType`: `token_endpoint`

`authConfig` armazena:
```json
{
  "tokenEndpointId": 28,
  "tokenPath": "token",
  "params": {
    "TOKEN": "5bc4a210d5c1573d1f3d...",
    "SENHA": "36228d39223340"
  },
  "cachedToken": "abc123...",
  "cachedAt": 1740000000000
}
```

**UI na empresa — aba autenticação:**
```
Tipo  ● Token via endpoint
      ○ Bearer estático
      ○ API Key
      ○ Basic

Endpoint de token  [Pegar Token ▾]
Caminho do token   [token        ]
                   ex: token, data.access_token

Parâmetros  (detectados automaticamente do body do endpoint)
  TOKEN     [5bc4a210d5c1573d1f3d...]
  SENHA     [36228d39223340       ]

Token atual   5bc4a210...   obtido há 5 min
                            [Renovar agora]
```

- Os **parâmetros são dinâmicos**: detectados dos `{PLACEHOLDERS}` do body template do endpoint selecionado
- Trocar o endpoint atualiza os campos automaticamente
- Genérico para qualquer ERP

---

## Tela de Teste

Status do token exibido no painel de seletores, abaixo da empresa:

```
Empresa
> Multcon
🔑 sem token   [Obter token]

Empresa
> Multcon
🟢 token válido (obtido há 5 min)
```

---

## Fluxo de Execução

```
1. Usuário clica [Obter token] ou [Executar] (com token ausente)
         │
         ▼
2. Sistema chama o endpoint de token com as credenciais da empresa
         │
    ┌────┴────┐
  falha      sucesso
    │          │
    ▼          ▼
  Mostra     Extrai token via tokenPath
  erro no    Salva cachedToken + cachedAt no authConfig
  painel     Executa a requisição principal
```

Se o token falhar, a requisição principal **não é executada** — o erro do endpoint de auth é mostrado no painel de resposta.

---

## Mudanças Necessárias

### Banco de dados
- Nenhuma mudança de schema — `authConfig` já é JSON livre

### Backend (`route.ts`)
- Detectar `authType === 'token_endpoint'`
- Se `cachedToken` ausente: chamar endpoint de token antes da requisição principal
- Extrair token via `tokenPath` (dot notation: `token`, `data.access_token`)
- Salvar `cachedToken` + `cachedAt` de volta no banco
- Usar token como `Authorization: Bearer {cachedToken}`

### Frontend — empresa
- Novo tipo de auth na UI
- Dropdown para selecionar endpoint de token
- Campo `tokenPath`
- Campos de parâmetros gerados dinamicamente a partir dos placeholders do endpoint
- Exibir token atual + botão "Renovar agora"

### Frontend — tela de teste
- No painel de seletores, abaixo da empresa selecionada:
  - Se `authType === 'token_endpoint'` e sem token → `🔑 sem token [Obter token]`
  - Se com token → `🟢 token válido (obtido há X min)`
- Botão "Obter token" chama `/api/execute` com o endpoint de token

---

## Notas

- Sem gerenciamento de expiração — usuário renova quando necessário (ou ao receber 401)
- Credenciais ficam na empresa, não no cliente de teste
- Funciona para qualquer ERP que use token via endpoint
