# Arquitetura Backend — SaaS Multiempresa de Atendimento WhatsApp com IA

Stack: **Python + FastAPI + Firebase Auth + Firestore + WhatsApp Cloud API (Meta) + LLMs (OpenAI/Claude/Gemini/OpenRouter)**

---

## 1. Visão Geral

Sistema **multi-tenant** onde cada empresa (`company`) é isolada por `company_id`. Toda coleção do Firestore que guarda dado operacional carrega `company_id`, e **nenhuma query pode ser feita sem esse filtro** — isso é garantido em código (repositórios) e reforçado por Firestore Security Rules como segunda camada de defesa.

Fluxo de alto nível:

```
Cliente WhatsApp
      │
      ▼
Meta Cloud API ──(webhook)──▶ FastAPI /webhooks/meta
      │                              │
      │                              ▼
      │                     Identifica empresa pelo phone_number_id
      │                              │
      │                              ▼
      │                     Salva mensagem (Firestore)
      │                              │
      │                              ▼
      │                     Aciona Agente de IA (Strategy/Factory)
      │                              │
      │              ┌───────────────┴───────────────┐
      │              ▼                                ▼
      │      IA resolve sozinha              IA não resolve
      │              │                                │
      │              ▼                                ▼
      │     Responde via Meta API          status = "Aguardando Atendente"
      │                                     Notifica atendentes (WebSocket)
      ▼
Atendente Humano (frontend) ──▶ FastAPI /conversations/{id}/messages ──▶ Meta API
```

---

## 2. Estrutura de Pastas (FastAPI)

```
app/
├── main.py                      # cria app, registra routers, middlewares, exception handlers
├── core/
│   ├── config.py                # settings (pydantic BaseSettings), variáveis de ambiente
│   ├── security.py               # helpers de criptografia (Fernet/KMS) para api_keys
│   └── logging.py                # configuração de logs estruturados
├── database/
│   └── firestore.py              # client Firestore singleton (Admin SDK)
├── middleware/
│   ├── auth_middleware.py        # valida Firebase ID token, injeta request.state.user
│   └── tenant_middleware.py      # resolve company_id e injeta request.state.company_id
├── auth/
│   ├── dependencies.py           # get_current_user, get_current_company (Depends)
│   └── firebase_auth.py          # wrapper do Firebase Admin Auth
├── models/                       # modelos internos (dataclasses/pydantic "domain")
│   ├── company.py
│   ├── user.py
│   ├── whatsapp_number.py
│   ├── conversation.py
│   ├── message.py
│   ├── ai_agent.py
│   └── workflow.py
├── schemas/                      # pydantic — request/response (DTOs da API)
│   ├── company_schema.py
│   ├── user_schema.py
│   ├── whatsapp_schema.py
│   ├── conversation_schema.py
│   ├── message_schema.py
│   ├── ai_agent_schema.py
│   └── workflow_schema.py
├── repositories/                 # única camada que fala com Firestore
│   ├── base_repository.py        # CRUD genérico, sempre exige company_id
│   ├── company_repository.py
│   ├── user_repository.py
│   ├── whatsapp_repository.py
│   ├── conversation_repository.py
│   ├── message_repository.py
│   ├── ai_agent_repository.py
│   └── workflow_repository.py
├── services/                     # regra de negócio, orquestra repositórios + integrações
│   ├── company_service.py
│   ├── user_service.py
│   ├── whatsapp_service.py
│   ├── conversation_service.py
│   ├── message_service.py
│   ├── ai_agent_service.py
│   ├── workflow_service.py
│   └── orchestrator_service.py   # decide IA vs humano, executa pipeline de resposta
├── integrations/
│   ├── meta/
│   │   ├── client.py              # chamadas HTTP à Graph API (enviar mensagem, templates)
│   │   └── webhook_parser.py      # normaliza payload recebido da Meta
│   └── ai/
│       ├── base_provider.py       # interface (Strategy) — generate(), stream()
│       ├── factory.py             # Factory Pattern — escolhe provider por nome
│       ├── openai_provider.py
│       ├── claude_provider.py
│       ├── gemini_provider.py
│       └── openrouter_provider.py
├── api/
│   └── routers/
│       ├── companies_router.py
│       ├── users_router.py
│       ├── whatsapp_router.py
│       ├── conversations_router.py
│       ├── messages_router.py
│       ├── ai_agents_router.py
│       ├── workflows_router.py
│       ├── auth_router.py
│       └── webhooks_router.py
└── utils/
    ├── pagination.py
    ├── validators.py              # validação de CNPJ, telefone, etc.
    └── exceptions.py              # exceções customizadas (NotFound, Forbidden, ...)
```

**Responsabilidade de cada camada:**

| Camada | Responsabilidade |
|---|---|
| `api/routers` | Define rotas HTTP, valida schema de entrada/saída, chama `services`. Não tem regra de negócio. |
| `services` | Regra de negócio pura. Orquestra um ou mais `repositories` e `integrations`. Não conhece Firestore diretamente. |
| `repositories` | Único ponto de acesso ao Firestore. Sempre recebe `company_id` como parâmetro obrigatório. |
| `middleware` | Autenticação (Firebase) e resolução de tenant, executados antes de qualquer rota. |
| `integrations` | Adaptadores para serviços externos (Meta, LLMs). Isolam o resto do sistema de detalhes de cada provedor. |
| `models` / `schemas` | `models` = representação interna do domínio; `schemas` = contrato público da API (pydantic). |
| `core` | Configuração, segurança, logging — transversal a toda a aplicação. |

---

## 3. Modelagem no Firestore

### Estratégia: coleção raiz por tipo + `company_id` embutido (não subcoleção aninhada em `companies`)

Duas abordagens são possíveis. Recomendo a **coleção raiz com `company_id` como campo indexado**, em vez de aninhar tudo dentro de `companies/{id}/...`, pelos seguintes motivos:

- Facilita **collection group queries** quando necessário (ex: buscar todas as conversas "Aguardando Atendente" de um atendente específico, algo raro entre tenants mas útil para relatórios internos do SaaS).
- Evita profundidade excessiva de paths.
- Índices compostos com `company_id` como primeiro campo replicam o isolamento com a mesma eficiência de uma subcoleção.

Uso de **subcoleção** apenas para `messages`, que pertencem 1:N fortemente a uma `conversation` e são acessadas quase sempre no contexto de uma conversa já carregada — isso reduz o tamanho de índice e mantém a leitura naturalmente escopada.

> **Divergência deliberada — módulo admin de `companies`:** o CRM administrativo
> de empresas (`companies_router`, sob `require_platform_admin`) embute
> `whatsapp[]`, `metaConnection`, `ai`, `plan` e `usage` diretamente no
> documento `companies/{id}`, em vez de seguir a recomendação de coleções
> raiz separadas (`whatsapp_numbers`, `ai_agents`) descrita mais abaixo. Isso
> é intencional: é uma camada leve de cadastro/gestão de conta, não o
> pipeline operacional de mensagens (que ainda não existe em código). Quando
> `whatsapp_numbers`/`ai_agents` forem implementados para o pipeline real de
> atendimento, será necessário decidir como sincronizar (ou substituir) os
> dados embutidos aqui — ponto de reconciliação futuro, não um esquecimento.

```
companies/{companyId}
  id, name, cnpj, sector, primaryEmail, status, createdAt, updatedAt

users/{userId}
  companyId, name, email, role, accessLevel, sector, status, createdAt

whatsapp_numbers/{numberId}
  companyId, number, displayName, phoneNumberId, businessAccountId,
  accessTokenEncrypted, webhookVerifyToken, connectionStatus, connectedAt

conversations/{conversationId}
  companyId, phoneId, customerPhone, customerName, status,
  assignedAgentUserId, workflowId, aiAgentId, lastMessage, updatedAt
    messages/{messageId}          ← subcoleção
      companyId, conversationId, author, type, content, createdAt, status

ai_agents/{agentId}
  companyId, name, provider, model, apiKeyEncrypted, temperature, prompt, active

workflows/{workflowId}
  companyId, name, description, active
```

### Exemplos completos de documentos JSON

**`companies/{companyId}`** — shape atual do módulo admin (ver divergência acima):
```json
{
  "id": "cmp_9f2a",
  "companyName": "Loja Exemplo Ltda",
  "cnpj": "12345678000190",
  "client": { "name": "Maria Souza", "email": "maria@lojaexemplo.com" },
  "sector": "Varejo",
  "whatsapp": [
    { "id": "wa_1", "number": "+5511999998888", "label": "Principal", "active": true }
  ],
  "metaConnection": {
    "status": "inactive",
    "phoneNumberId": "",
    "businessAccountId": "",
    "lastSync": null
  },
  "tags": ["Premium"],
  "ai": { "enabled": true, "assistantId": "", "model": "gpt-5.5", "prompt": "", "temperature": 0.7 },
  "plan": { "name": "Pro", "expiresAt": null, "messagesLimit": 50000 },
  "usage": { "messagesThisMonth": 0, "tokensThisMonth": 0, "lastMessageAt": null },
  "status": "active",
  "createdAt": "2026-07-01T12:00:00Z",
  "updatedAt": "2026-07-05T09:30:00Z",
  "createdBy": "admin"
}
```
(`metaConnection.accessToken`, quando presente, é gravado criptografado — Fernet via
`core/security.py` — e nunca é lido de volta pela API.)

**`users/{userId}`**
```json
{
  "id": "usr_31bc",
  "companyId": "cmp_9f2a",
  "uid": "firebase-uid-abc123",
  "name": "Maria Souza",
  "email": "maria@lojaexemplo.com",
  "role": "Supervisor",
  "accessLevel": "supervisor",
  "sector": "Atendimento",
  "status": "ativo",
  "createdAt": "2026-07-01T12:05:00Z"
}
```

**`whatsapp_numbers/{numberId}`**
```json
{
  "id": "wa_7788",
  "companyId": "cmp_9f2a",
  "number": "+5511999998888",
  "displayName": "Atendimento Loja Exemplo",
  "phoneNumberId": "109876543210987",
  "businessAccountId": "123456789012345",
  "accessTokenEncrypted": "ENC[...]",
  "connectionStatus": "conectado",
  "connectedAt": "2026-07-02T10:00:00Z"
}
```

**`conversations/{conversationId}`**
```json
{
  "id": "cnv_a1b2",
  "companyId": "cmp_9f2a",
  "phoneId": "wa_7788",
  "customerPhone": "+5511988887777",
  "customerName": "João Cliente",
  "status": "IA",
  "assignedAgentUserId": null,
  "workflowId": "wf_vendas",
  "aiAgentId": "agent_001",
  "lastMessage": "Olá, gostaria de saber o preço do produto X",
  "updatedAt": "2026-07-07T14:22:00Z"
}
```

**`conversations/{conversationId}/messages/{messageId}`**
```json
{
  "id": "msg_001",
  "companyId": "cmp_9f2a",
  "conversationId": "cnv_a1b2",
  "author": "cliente",
  "type": "text",
  "content": "Olá, gostaria de saber o preço do produto X",
  "createdAt": "2026-07-07T14:22:00Z",
  "status": "recebida"
}
```

**`ai_agents/{agentId}`**
```json
{
  "id": "agent_001",
  "companyId": "cmp_9f2a",
  "name": "Agente Vendas",
  "provider": "openai",
  "model": "gpt-4.1",
  "apiKeyEncrypted": "ENC[...]",
  "temperature": 0.7,
  "prompt": "Você é um atendente da Loja Exemplo. Seja cordial e objetivo...",
  "active": true
}
```

**`workflows/{workflowId}`**
```json
{
  "id": "wf_vendas",
  "companyId": "cmp_9f2a",
  "name": "Vendas",
  "description": "Fluxo para dúvidas sobre produtos e fechamento de pedidos",
  "active": true
}
```

### Índices compostos necessários
- `conversations`: (`companyId` ASC, `status` ASC, `updatedAt` DESC)
- `conversations`: (`companyId` ASC, `assignedAgentUserId` ASC, `status` ASC)
- `users`: (`companyId` ASC, `status` ASC)
- `whatsapp_numbers`: (`phoneNumberId` ASC) — usado **sem** `companyId` apenas na rota de webhook, para descobrir a empresa a partir do número (único ponto do sistema onde a busca não parte de um `companyId` já conhecido).

---

## 4. Segurança Multi-Tenant

### Fluxo de autenticação e resolução de tenant

```
1. Frontend envia Firebase ID Token no header: Authorization: Bearer <token>
2. auth_middleware valida o token via Firebase Admin SDK → obtém uid
3. tenant_middleware busca users onde uid == uid (única query permitida sem company_id
   pré-conhecido, pois é assim que ele é descoberto)
4. company_id é injetado em request.state.company_id
5. Todo endpoint usa Depends(get_current_company) para obter esse valor
6. Toda chamada a repository recebe company_id explicitamente
7. base_repository.py NUNCA executa uma query sem .where("companyId", "==", company_id)
```

### Camadas de defesa (defesa em profundidade)

1. **Nível de código (principal):** `base_repository.py` expõe apenas métodos que exigem `company_id` como primeiro argumento — não existe método "buscar tudo" sem filtro. Isso é reforçado com testes automatizados (todo teste de repositório verifica que dados de outra empresa nunca retornam).
2. **Nível de Firestore Security Rules (defesa adicional, caso algum client SDK acesse Firestore diretamente, o que **não deve** ocorrer neste desenho — tudo passa pelo FastAPI):
   ```
   match /conversations/{id} {
     allow read, write: if request.auth != null &&
       resource.data.companyId == getUserCompanyId(request.auth.uid);
   }
   ```
3. **Nível de autorização por papel:** `accessLevel` (Administrador/Supervisor/Atendente) controla quais rotas cada usuário pode chamar, via `Depends(require_role(["administrador", "supervisor"]))`.
4. **Nunca confiar em `company_id` vindo do corpo da requisição** — ele sempre vem do token/middleware, nunca do payload enviado pelo cliente.

### Criptografia de credenciais
`access_token` do WhatsApp e `api_key` dos agentes de IA são armazenados criptografados (Fernet simétrico com chave em variável de ambiente/Secret Manager, ou KMS do provedor de nuvem). Nunca retornados em claro nas respostas da API — apenas um indicador `hasToken: true/false`.

---

## 5. Padrões de Projeto Aplicados

| Padrão | Onde | Por quê |
|---|---|---|
| **Repository Pattern** | `repositories/` | Isola acesso a dados; troca de banco não afeta `services`. |
| **Service Layer** | `services/` | Concentra regra de negócio, testável sem depender de Firestore/HTTP. |
| **Dependency Injection** | `Depends()` do FastAPI | Injeta usuário atual, empresa atual, repositórios e serviços. |
| **Factory Pattern** | `integrations/ai/factory.py` | Cria a instância correta de provider de IA a partir do campo `provider`. |
| **Strategy Pattern** | `integrations/ai/base_provider.py` + implementações | Cada provider implementa a mesma interface (`generate`, `stream`), intercambiáveis em runtime. |

### Exemplo conceitual — Factory + Strategy para IA

```python
# integrations/ai/base_provider.py
class AIProvider(ABC):
    @abstractmethod
    async def generate(self, messages: list[dict], temperature: float) -> str: ...

# integrations/ai/factory.py
class AIProviderFactory:
    _providers = {
        "openai": OpenAIProvider,
        "claude": ClaudeProvider,
        "gemini": GeminiProvider,
        "openrouter": OpenRouterProvider,
    }

    @classmethod
    def create(cls, provider_name: str, api_key: str, model: str) -> AIProvider:
        provider_cls = cls._providers.get(provider_name)
        if not provider_cls:
            raise UnsupportedProviderError(provider_name)
        return provider_cls(api_key=api_key, model=model)
```

Adicionar um novo provedor = criar uma nova classe + registrar no dicionário. Nenhum outro ponto do sistema precisa mudar.

---

## 6. Endpoints REST

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/session` | Troca ID Token do Firebase por sessão validada; retorna dados do usuário + empresa. |
| GET | `/auth/me` | Retorna usuário autenticado e empresa resolvida. |

### Empresas (`/companies`) — acesso restrito (admin do SaaS)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/companies` | Cria empresa. |
| GET | `/companies/{id}` | Detalhe da empresa (só a própria, exceto super-admin). |
| PUT | `/companies/{id}` | Atualiza dados cadastrais. |
| PATCH | `/companies/{id}/status` | Ativa/inativa. |
| DELETE | `/companies/{id}` | Remove (soft delete recomendado). |

### Usuários (`/users`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/users` | Cria usuário vinculado à empresa do solicitante. |
| GET | `/users` | Lista usuários da empresa (paginado). |
| GET | `/users/{id}` | Detalhe. |
| PUT | `/users/{id}` | Atualiza. |
| PATCH | `/users/{id}/status` | Ativa/inativa. |
| DELETE | `/users/{id}` | Remove. |

### Números WhatsApp (`/whatsapp-numbers`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/whatsapp-numbers` | Registra/conecta novo número. |
| GET | `/whatsapp-numbers` | Lista números da empresa. |
| GET | `/whatsapp-numbers/{id}` | Detalhe. |
| PUT | `/whatsapp-numbers/{id}` | Atualiza config. |
| DELETE | `/whatsapp-numbers/{id}` | Desconecta. |

### Conversas (`/conversations`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/conversations` | Lista com filtro por `status`, `assignedAgentUserId`. |
| GET | `/conversations/{id}` | Detalhe. |
| PATCH | `/conversations/{id}/assign` | Atribui a um atendente. |
| PATCH | `/conversations/{id}/status` | Muda status (ex: Finalizado). |
| PATCH | `/conversations/{id}/workflow` | Define/corrige workflow manualmente. |

### Mensagens (`/conversations/{id}/messages`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/conversations/{id}/messages` | Histórico paginado. |
| POST | `/conversations/{id}/messages` | Atendente humano envia mensagem (dispara envio via Meta API). |

### Agentes de IA (`/ai-agents`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/ai-agents` | Cria agente (valida provider suportado). |
| GET | `/ai-agents` | Lista agentes da empresa. |
| GET | `/ai-agents/{id}` | Detalhe (sem expor api_key). |
| PUT | `/ai-agents/{id}` | Atualiza prompt/modelo/temperatura. |
| PATCH | `/ai-agents/{id}/toggle` | Ativa/desativa. |
| DELETE | `/ai-agents/{id}` | Remove. |

### Workflows (`/workflows`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/workflows` | Cria. |
| GET | `/workflows` | Lista. |
| PUT | `/workflows/{id}` | Atualiza. |
| DELETE | `/workflows/{id}` | Remove. |

### Webhooks Meta (`/webhooks/meta`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/webhooks/meta` | Verificação do webhook (hub.challenge). |
| POST | `/webhooks/meta` | Recebe mensagens/status; identifica empresa por `phone_number_id`; dispara pipeline de atendimento. **Sem autenticação Firebase** — validado por assinatura da Meta (`X-Hub-Signature-256`). |

---

## 7. Fluxos Completos

**Cadastro de empresa** → super-admin cria em `/companies` → cria automaticamente o primeiro usuário Administrador vinculado (via Firebase Auth + `users`).

**Cadastro de usuário** → Admin/Supervisor cria usuário → sistema cria conta no Firebase Auth (ou vincula uid existente) → grava documento em `users` com `companyId` herdado do solicitante.

**Login** → Frontend autentica no Firebase (client SDK) → envia ID Token para `/auth/session` → backend valida token, busca `users` por `uid`, retorna `companyId` + perfil.

**Conectar WhatsApp** → Admin fornece dados do Business Account (via fluxo OAuth/Embedded Signup da Meta, já presente no seu frontend) → backend salva `phoneNumberId`, `accessToken` (criptografado) em `whatsapp_numbers`, registra webhook.

**Receber mensagem da Meta** → POST `/webhooks/meta` → `webhook_parser` normaliza payload → busca `whatsapp_numbers` por `phoneNumberId` → obtém `companyId` → `conversation_service` busca ou cria conversa → `message_service` grava mensagem.

**Executar IA** → `orchestrator_service` monta histórico da conversa → `workflow_service` decide/confirma workflow via IA → `ai_agent_service` usa `AIProviderFactory` para chamar o LLM configurado → IA retorna resposta + sinalização de "resolvido" ou "não resolvido".

**Enviar resposta** → se IA resolveu, `meta/client.py` envia a resposta ao cliente via Graph API e grava mensagem `autor: ia`.

**Transferir para humano** → se IA não resolve, `conversation.status = "Aguardando Atendente"`, evento é emitido (WebSocket/Firestore listener) para o frontend notificar atendentes disponíveis do setor/workflow correspondente.

**Encerrar conversa** → atendente chama `PATCH /conversations/{id}/status` com `Finalizado`; sistema registra métricas (tempo de atendimento, quem finalizou).

---

## 8. Próximos Passos Sugeridos para o Desenvolvimento

1. **Setup do projeto**: `main.py`, `core/config.py`, conexão com Firestore, Firebase Admin SDK.
2. **Auth + tenant middleware**: base de tudo, deve estar pronto e testado antes do resto.
3. **CRUD de Empresas e Usuários**: primeiro módulo funcional de ponta a ponta (router → service → repository).
4. **Números WhatsApp + Webhook**: receber e validar mensagens da Meta.
5. **Conversas e Mensagens**: modelagem e endpoints de leitura/escrita.
6. **Integração de IA (Factory/Strategy)**: começar com um provider (ex: OpenAI) e depois expandir.
7. **Orchestrator + Workflows**: lógica de decisão IA vs. humano.
8. **Testes automatizados** de isolamento multi-tenant (garantir que empresa A nunca vê dado de empresa B).

---

*Documento gerado como base de arquitetura — pronto para servirmos de referência enquanto implementamos o código, módulo por módulo.*
