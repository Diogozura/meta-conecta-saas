# Banco de Dados — Firebase Firestore

## Estrutura

O banco usa **Firebase Firestore** com subcoleções para organizar dados em níveis:

```
contas/
├── {contaId}
│   ├── (dados da conta: nome, email, status, etc)
│   ├── usuarios/
│   │   ├── {usuarioId}
│   │   │   └── (dados do usuário: nome, email, nível, etc)
│   ├── metaAccess/
│   │   ├── {accessId}
│   │   │   └── (wabaId, accessToken, businessId, etc)
│   └── contasVinculadas/
│       ├── {vinculacaoId}
│           └── (relação com conta filha/parceira)
```

---

## Coleções e Documentos

### 1. **contas** (Coleção raiz)

Representa cada cliente/empresa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID único (gerado pelo Firestore) |
| `nome` | `string` | Nome da empresa |
| `email` | `string` | Email de contato |
| `telefone` | `string?` | Telefone |
| `website` | `string?` | Website da empresa |
| `cnpj` | `string?` | CNPJ da empresa |
| `dataCadastro` | `Date` | Data de criação |
| `dataAtualizacao` | `Date` | Última atualização |
| `status` | `enum` | `ativo` \| `inativo` \| `suspenso` |

**Exemplo:**
```json
{
  "id": "conta_001",
  "nome": "Empresa XYZ",
  "email": "contato@xyz.com",
  "cnpj": "12.345.678/0001-99",
  "status": "ativo",
  "dataCadastro": "2024-01-15T10:30:00Z",
  "dataAtualizacao": "2024-05-26T14:20:00Z"
}
```

---

### 2. **usuarios** (Subcoleção em `contas/{contaId}/usuarios`)

Usuários com acesso à conta, cada um com um nível de permissão.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID único |
| `contaId` | `string` | Referência à conta |
| `nome` | `string` | Nome do usuário |
| `email` | `string` | Email (vinculado ao Firebase Auth) |
| `avatar` | `string?` | URL do avatar |
| `nivel` | `enum` | `proprietario` \| `admin` \| `operador` \| `visualizador` |
| `dataAcesso` | `Date?` | Último acesso |
| `dataCadastro` | `Date` | Data de criação |
| `dataAtualizacao` | `Date` | Última atualização |
| `status` | `enum` | `ativo` \| `inativo` \| `convite_pendente` |

**Níveis de acesso:**

| Nível | Permissões |
|-------|-----------|
| `proprietario` | Acesso total, pode adicionar/remover usuários, controlar integração Meta |
| `admin` | Gerencia usuários, templates, números, webhooks |
| `operador` | Envia mensagens, gerencia conversas, visualiza clientes |
| `visualizador` | Apenas visualização de dados (sem ações) |

**Exemplo:**
```json
{
  "id": "usuario_001",
  "contaId": "conta_001",
  "nome": "João Silva",
  "email": "joao@xyz.com",
  "nivel": "proprietario",
  "status": "ativo",
  "dataCadastro": "2024-01-15T10:30:00Z",
  "dataAcesso": "2024-05-26T09:15:00Z"
}
```

---

### 3. **metaAccess** (Subcoleção em `contas/{contaId}/metaAccess`)

Dados de integração com Meta/WhatsApp Business API. Geralmente há apenas um por conta (ou múltiplos se WABA múltipla).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID único |
| `contaId` | `string` | Referência à conta |
| `wabaId` | `string` | WhatsApp Business Account ID (Meta) |
| `accessToken` | `string` | Token de acesso da Meta |
| `businessId` | `string` | Business ID |
| `phoneNumberIds` | `string[]` | IDs dos números vinculados |
| `dataAtualizacao` | `Date` | Última atualização |
| `dataExpiracao` | `Date?` | Expiração do token |
| `status` | `enum` | `ativo` \| `expirado` \| `erro` |
| `webhookToken` | `string?` | Token para validar webhooks |

**Exemplo:**
```json
{
  "id": "metaAccess_001",
  "contaId": "conta_001",
  "wabaId": "123456789012345",
  "businessId": "987654321098765",
  "accessToken": "EAABcd...XyZ",
  "phoneNumberIds": ["1234567890", "1234567891"],
  "status": "ativo",
  "dataAtualizacao": "2024-05-20T08:00:00Z",
  "dataExpiracao": "2025-05-20T08:00:00Z"
}
```

---

### 4. **contasVinculadas** (Subcoleção em `contas/{contaId}/contasVinculadas`)

Relações entre contas. Permite modelar hierarquias (contas "pai" que controlam contas "filhas").

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID único |
| `contaId` | `string` | Conta "pai" |
| `contaVinculadaId` | `string` | Conta "filha" ou parceira |
| `nivel` | `enum` | `controlada` \| `parceiro` \| `reseller` |
| `dataCadastro` | `Date` | Data de criação |
| `dataAtualizacao` | `Date` | Última atualização |
| `status` | `enum` | `ativo` \| `inativo` |

**Níveis de vinculação:**

| Nível | Significado |
|-------|-----------|
| `controlada` | Conta pai controla totalmente a filha (faturamento, dados, tudo) |
| `parceiro` | Acesso limitado (apenas relatórios, sem controle total) |
| `reseller` | Conta parceira pode criar suas próprias subcontas |

**Exemplo:**
```json
{
  "id": "vinculo_001",
  "contaId": "conta_001",           // conta pai
  "contaVinculadaId": "conta_002",  // conta filha
  "nivel": "controlada",
  "status": "ativo",
  "dataCadastro": "2024-03-10T14:00:00Z"
}
```

---

## Como Usar

### Imports

```ts
import { 
  criarConta, 
  obterConta, 
  atualizarConta,
  criarUsuario,
  listarUsuarios,
  obterMetaAccess,
  criarContaVinculada,
  listarContasVinculadas
} from '@/lib/firestore'
import { Conta, Usuario, NivelUsuario } from '@/types/database'
```

### Exemplos

#### Criar uma nova conta

```ts
async function cadastrarNovaEmpresa(formData: FormData) {
  const conta = await criarConta({
    nome: formData.get('nome') as string,
    email: formData.get('email') as string,
    telefone: formData.get('telefone') as string,
    cnpj: formData.get('cnpj') as string,
    status: 'ativo',
  })
  return conta.id
}
```

#### Criar um usuário para uma conta

```ts
async function convidarUsuario(contaId: string, email: string) {
  const usuario = await criarUsuario(contaId, {
    contaId,
    nome: 'Nome do Usuário',
    email,
    nivel: NivelUsuario.OPERADOR,
    status: 'convite_pendente',
    dataCadastro: new Date(),
    dataAtualizacao: new Date(),
  })
  // TODO: Enviar email de convite com link
  return usuario.id
}
```

#### Listar todos os usuários de uma conta

```ts
async function listarTodosUsuarios(contaId: string) {
  const usuarios = await listarUsuarios(contaId)
  return usuarios
}
```

#### Obter dados de integração Meta

```ts
async function obterWABA(contaId: string) {
  const metaAccess = await obterMetaAccess(contaId)
  if (!metaAccess) {
    throw new Error('Conta não possui integração Meta')
  }
  return {
    wabaId: metaAccess.wabaId,
    phoneNumbers: metaAccess.phoneNumberIds,
  }
}
```

#### Vincular contas (conta pai e filha)

```ts
async function criarRevendedor(contaPai: string, contaFilha: string) {
  await criarContaVinculada(contaPai, {
    contaId: contaPai,
    contaVinculadaId: contaFilha,
    nivel: 'reseller',
    status: 'ativo',
    dataCadastro: new Date(),
    dataAtualizacao: new Date(),
  })
}
```

---

## Segurança — Firestore Rules

Configure as Firestore Security Rules no Console do Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Contas: usuários podem ler/escrever apenas se têm acesso
    match /contas/{contaId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/contas/$(contaId)/usuarios).data.usuarioIds;

      // Subcoleções
      match /usuarios/{userId} {
        allow read: if request.auth != null;
        allow create, update, delete: if request.auth != null;
      }

      match /metaAccess/{accessId} {
        allow read: if request.auth != null;
        allow create, update, delete: if request.auth != null;
      }

      match /contasVinculadas/{vinculoId} {
        allow read: if request.auth != null;
        allow create, update, delete: if request.auth != null;
      }
    }
  }
}
```

---

## Checklist de Setup

- [ ] Criar coleção `contas` no Firestore Console
- [ ] Executar `npm install firebase-admin` (já feito)
- [ ] Configurar variáveis de ambiente (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- [ ] Implementar Firestore Security Rules
- [ ] Testar funções de CRUD com dados de teste
- [ ] Criar páginas de "Nova Conta", "Gerenciar Usuários", "Conectar WABA"
