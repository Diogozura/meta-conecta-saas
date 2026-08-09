# WhatsApp SaaS Backend

Backend multi-tenant de atendimento via WhatsApp com IA. Ver
`arquitetura-backend-whatsapp-saas.md` para o desenho completo da arquitetura.

## Setup local

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edite .env com suas credenciais reais
```

### Credenciais do Firebase

1. No Console do Firebase → Configurações do projeto → Contas de serviço → "Gerar nova chave privada".
2. Salve o JSON em `secrets/firebase-service-account.json` (pasta já ignorada no `.gitignore`).
3. Aponte `GOOGLE_APPLICATION_CREDENTIALS` no `.env` para esse caminho.

### Gerar a chave de criptografia

```bash
python -c "from app.core.security import generate_encryption_key; print(generate_encryption_key())"
```

Cole o resultado em `ENCRYPTION_KEY` no `.env`.

## Rodar o servidor

```bash
uvicorn app.main:app --reload --port 8000
```

Verificação: `GET http://localhost:8000/health`

## Autenticação

Todo endpoint protegido espera o header:

```
Authorization: Bearer <firebase_id_token>
```

O token é o mesmo obtido no frontend após `signInWithEmailAndPassword` /
`signInWithPopup` (`await credential.user.getIdToken()`), sem necessidade
de sessão/cookie próprio — o backend é stateless e valida o token do
Firebase a cada requisição.

Fluxo interno (`app/auth/dependencies.py`):

1. `get_current_user` valida o token (`app/auth/firebase_auth.py`).
2. Busca o documento em `users` pelo `firebaseUid` (única query do sistema
   sem `company_id` — é assim que ele é descoberto).
3. Retorna um `AuthenticatedUser` com `company_id` resolvido.
4. `get_current_company` e `require_role([...])` derivam desse mesmo fluxo.

Teste rápido depois de subir o servidor:

```bash
curl -X POST http://localhost:8000/api/v1/auth/session \
  -H "Authorization: Bearer <seu_id_token_do_firebase>"
```

Para isso funcionar, precisa existir um documento em `users` no Firestore
com `firebaseUid` igual ao `uid` do token e `status: "ativo"`.

## Empresas e Usuários

### Criar uma empresa (feito pela equipe da plataforma, não por um tenant)

```bash
curl -X POST http://localhost:8000/api/v1/companies \
  -H "X-Platform-Admin-Key: <PLATFORM_ADMIN_API_KEY do .env>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Loja Exemplo Ltda",
    "cnpj": "00.000.000/0001-91",
    "sector": "Varejo",
    "primary_email": "contato@lojaexemplo.com",
    "admin_name": "Maria Souza",
    "admin_email": "maria@lojaexemplo.com"
  }'
```

Isso cria a empresa **e** o primeiro usuário Administrador (conta no
Firebase Auth + documento em `users`), e retorna um `admin_invite_link`
— um link de definição de senha gerado pelo Firebase, que deve ser
enviado ao administrador (por e-mail, por exemplo) para ele definir a
senha e fazer o primeiro login.

### Convidar um novo usuário (feito por um Administrador ou Supervisor já logado)

```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer <id_token_do_admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Atendente",
    "email": "joao@lojaexemplo.com",
    "role": "Atendente de Vendas",
    "access_level": "atendente"
  }'
```

Mesma lógica: cria a conta no Firebase Auth e retorna um `invite_link`.
O `company_id` nunca é enviado no corpo — vem sempre do token do usuário
autenticado que está convidando.

## Estado atual do projeto

- [x] Setup base (config, logging, Firestore/Firebase Admin, tratamento de exceções, `main.py`)
- [x] Auth + middleware de tenant (isolamento multiempresa)
- [x] CRUD de Empresas e Usuários
- [ ] Números WhatsApp + Webhook da Meta
- [ ] Conversas e Mensagens
- [ ] Integração de IA (Factory/Strategy)
- [ ] Orchestrator + Workflows
- [ ] Testes de isolamento multi-tenant

## Estrutura de pastas

Ver seção 2 do documento de arquitetura para a explicação completa de cada
pasta (`api`, `services`, `repositories`, `middleware`, `integrations`, etc.).
