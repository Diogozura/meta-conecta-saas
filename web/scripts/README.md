# 🚀 Setup da Conta SuperAdmin

Este script cria automaticamente a conta inicial de SuperAdmin e configura a integração com a Meta/WhatsApp Business API.

## 📋 O que o script faz

1. **Cria a conta** no Firestore (coleção `contas`)
2. **Cria o usuário** no Firebase Auth com email e senha
3. **Vincula o usuário à conta** como Proprietário (SuperAdmin)
4. **Salva os dados da Meta** (WABA ID, tokens, etc.) na subcoleção `metaAccess`

## 🔧 Como usar

### 1. Certifique-se de que o `.env.local` está configurado

Verifique se estas variáveis estão preenchidas:

```env
# Firebase
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Meta
NEXT_PUBLIC_META_APP_ID=...
META_WABA_ID=...
META_PHONE_NUMBER_ID=...
META_BUSINESS_TOKEN=...
META_WEBHOOK_VERIFY_TOKEN=...
```

### 2. Edite o arquivo `scripts/setup-admin.ts`

Modifique as configurações no final do arquivo:

```typescript
const config: SetupConfig = {
  // Dados da conta/empresa
  nomeConta: 'Sua Empresa',
  emailConta: 'contato@suaempresa.com',
  telefoneConta: '+55 11 99999-0000',
  
  // Dados do usuário SuperAdmin
  nomeAdmin: 'Seu Nome',
  emailAdmin: 'admin@suaempresa.com',
  senhaAdmin: 'SuaSenhaSegura123!', // ⚠️ MUDE ESTA SENHA!
  
  // Dados da Meta (lidos do .env.local)
  metaAppId: process.env.NEXT_PUBLIC_META_APP_ID || '',
  metaWabaId: process.env.META_WABA_ID || '',
  metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
  metaBusinessToken: process.env.META_BUSINESS_TOKEN || '',
}
```

### 3. Instale a dependência `tsx`

```bash
npm install tsx --save-dev
```

### 4. Execute o script

```bash
npm run setup-admin
```

## 📝 Exemplo de saída

```
🚀 Iniciando configuração da conta SuperAdmin...

📦 Criando conta...
✅ Conta criada com ID: abc123xyz

👤 Criando usuário no Firebase Auth...
✅ Usuário criado no Auth: uid_abc123

👥 Criando registro de usuário na conta...
✅ Usuário criado na conta: user_xyz789

🔌 Configurando integração Meta/WhatsApp...
✅ Integração Meta configurada: meta_access_001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Informações da conta:
   Conta ID: abc123xyz
   Nome: Sua Empresa
   Email: contato@suaempresa.com

👤 Credenciais de acesso:
   Email: admin@suaempresa.com
   Senha: SuaSenhaSegura123!
   Nível: Proprietário (SuperAdmin)

🔌 Integração Meta:
   WABA ID: 1283278710593625
   Phone Number ID: 1026009683939150
   Status: Ativo

🌐 Próximos passos:
   1. Acesse http://localhost:3000/login
   2. Faça login com admin@suaempresa.com
   3. Acesse o Dashboard e comece a usar!
```

## ⚠️ Importante

- **Execute apenas uma vez** para criar a conta inicial
- Se o email já existir no Firebase Auth, o script irá usar o usuário existente
- Guarde bem as credenciais de acesso (email e senha)
- **Mude a senha padrão** para uma senha segura
- O token da Meta (`META_BUSINESS_TOKEN`) expira em ~60 dias, você precisará renová-lo

## 🔐 Níveis de acesso

O usuário criado terá nível **Proprietário**, que possui:
- ✅ Acesso total à conta
- ✅ Gerenciamento de usuários
- ✅ Configuração da integração Meta
- ✅ Gerenciamento de clientes, templates e números
- ✅ Envio de mensagens e visualização de conversas

## 🔄 Executar novamente

Se precisar criar outra conta (multi-tenant), você pode:
1. Mudar os dados no `config`
2. Executar `npm run setup-admin` novamente
3. Uma nova conta será criada

## 🐛 Problemas comuns

### Erro: "Email já existe"
O script detecta isso e usa o usuário existente. Sem problemas.

### Erro: "Permission denied"
Verifique se as credenciais do Firebase Admin estão corretas no `.env.local`.

### Erro: "Invalid token"
O `META_BUSINESS_TOKEN` pode estar expirado. Gere um novo token no Meta for Developers.
