# Autenticação — Firebase

## Visão geral

A autenticação usa **Firebase Auth** no client e **Firebase Admin SDK** no servidor. O fluxo é:

1. Usuário faz login na página `/login` (email/senha ou Google)
2. Firebase Client SDK autentica e retorna um **ID Token**
3. O client chama a Server Action `setSession(idToken)`
4. O servidor verifica o token via **Firebase Admin** e cria um **session cookie** seguro (`httpOnly`)
5. O middleware verifica a presença do cookie em cada requisição

---

## Rotas protegidas

O middleware (`src/middleware.ts`) protege todas as rotas **exceto**:

| Rota                        | Status   |
|-----------------------------|----------|
| `/`                         | Pública  |
| `/login`                    | Pública  |
| `/politica-de-privacidade`  | Pública  |
| `/termos-de-uso`            | Pública  |
| `/dashboard/*`              | Protegida |
| Demais rotas                | Protegida |

---

## Variáveis de ambiente

Copie o arquivo `.env.local.example` para `.env.local` e preencha os valores.

### Firebase Client SDK

Variáveis com prefixo `NEXT_PUBLIC_` são seguras para expor no browser.

| Variável                              | Onde encontrar |
|---------------------------------------|---------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY`        | Firebase Console → Configurações do Projeto → Seus apps → Configuração do SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`    | Mesmo lugar acima |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`     | Mesmo lugar acima |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Mesmo lugar acima |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Mesmo lugar acima |
| `NEXT_PUBLIC_FIREBASE_APP_ID`         | Mesmo lugar acima |

**Como acessar no Firebase Console:**
> Firebase Console → (seu projeto) → ⚙️ Configurações do projeto → aba **Geral** → rolar até "Seus apps" → selecionar o app Web → "Configuração do SDK"

### Firebase Admin SDK

Variáveis **privadas** — nunca devem aparecer no client ou ser commitadas.

| Variável                  | Onde encontrar |
|---------------------------|---------------|
| `FIREBASE_PROJECT_ID`     | Firebase Console → Configurações do Projeto → aba **Contas de serviço** |
| `FIREBASE_CLIENT_EMAIL`   | Mesmo lugar acima |
| `FIREBASE_PRIVATE_KEY`    | Mesmo lugar acima |

**Como gerar a chave de serviço:**
> Firebase Console → (seu projeto) → ⚙️ Configurações do projeto → aba **Contas de serviço** → clique em **"Gerar nova chave privada"** → baixe o arquivo JSON

Do arquivo JSON, extraia:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (o valor inteiro, incluindo `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`)

> **Atenção:** A `FIREBASE_PRIVATE_KEY` contém quebras de linha (`\n`). Ao adicioná-la no `.env.local`, coloque o valor entre aspas duplas: `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXX...\n-----END PRIVATE KEY-----\n"`

---

## Habilitar provedores no Firebase Console

Para que email/senha e Google funcionem:

1. Acesse: Firebase Console → (seu projeto) → **Authentication** → aba **Sign-in method**
2. Habilite **Email/senha**
3. Habilite **Google** e configure o email de suporte

---

## Estrutura dos arquivos

```
src/
  lib/
    firebase.ts          # Inicialização do Firebase Client SDK (browser)
    firebase-admin.ts    # Inicialização do Firebase Admin SDK (servidor)
    auth.ts              # Server Actions: setSession, getSession, logout
  middleware.ts          # Proteção de rotas por cookie de sessão
  app/
    login/
      layout.tsx         # Metadata da página de login
      page.tsx           # Formulário de login (client component)
```

---

## Verificar sessão em Server Components

Para obter os dados do usuário autenticado em um Server Component ou Server Action:

```ts
import { getSession } from '@/lib/auth'

const session = await getSession()
if (!session) {
  // usuário não autenticado
}

console.log(session.uid)   // Firebase UID
console.log(session.email) // email do usuário
```

---

## Logout

O dashboard já possui o botão de logout que chama a Server Action `logout()` de `@/lib/auth`, que apaga o cookie e redireciona para `/login`.
