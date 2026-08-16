# ⚠️ CONFIGURAÇÃO URGENTE: Variáveis de Ambiente no Vercel

## 🔴 PROBLEMA ATUAL

O webhook está falhando com erro:
```
Error: The default Firebase app does not exist. Make sure you call initializeApp() before using any of the Firebase services.
```

**Causa:** Faltam as variáveis de ambiente do Firebase Admin no Vercel.

---

## 📋 PASSO A PASSO

### 1️⃣ Acessar Configurações do Vercel

1. Acesse: https://vercel.com/dashboard
2. Clique no projeto: **meta-conecta-saas**
3. Vá em: **Settings** → **Environment Variables**

### 2️⃣ Adicionar as 3 Variáveis

Clique em **Add New** e adicione cada uma das variáveis abaixo:

---

#### **Variável 1: FIREBASE_PROJECT_ID**

```
Name: FIREBASE_PROJECT_ID
Value: <seu-project-id>
```

✅ **Environments:** Marque todas (Production, Preview, Development)

---

#### **Variável 2: FIREBASE_CLIENT_EMAIL**

```
Name: FIREBASE_CLIENT_EMAIL
Value: <client-email-da-service-account>
```

✅ **Environments:** Marque todas (Production, Preview, Development)

---

#### **Variável 3: FIREBASE_PRIVATE_KEY** ⚠️ ATENÇÃO!

```
Name: FIREBASE_PRIVATE_KEY
```

**Value:** Copie o conteúdo do seu `.env.local` **EXATAMENTE** como está (COM as aspas duplas e os `\n` literais):

```
"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

⚠️ **IMPORTANTE:** 
- DEVE começar com `"-----BEGIN` (com aspas duplas)
- DEVE terminar com `-----\n"` (com `\n` e aspas duplas)
- MANTER os `\n` literais (NÃO substituir por quebras de linha)
- Se copiar do .env.local, copie as linhas 76-77 **incluindo as aspas**

✅ **Environments:** Marque todas (Production, Preview, Development)

---

### 3️⃣ Salvar e Aguardar Deploy

1. Clique em **Save** após adicionar cada variável
2. Vercel fará **redeploy automático** (aguarde 1-2 minutos)
3. Acesse os logs em: **Deployments** → Última build → **Logs**

---

## 🧪 TESTE APÓS DEPLOY

### 1. Enviar mensagem de teste pelo WhatsApp

Envie qualquer mensagem para o número: **+1 (026) 009-6839150**

### 2. Verificar logs do Vercel

Acesse: **Deployments** → **Latest** → **Logs**

**Logs esperados (SUCESSO):**
```
✅ Firebase Admin inicializado com sucesso
🔍 Buscando conta pelo WABA ID: 1283278710593625
📊 Total de contas: 1
  Conta awMBZRwHwYDUM0zeraH3: 1 metaAccess com WABA 1283278710593625
✅ Encontrado! WABA: 1283278710593625 Conta: awMBZRwHwYDUM0zeraH3
[Webhook] Mensagem recebida: { from: '551199...', text: 'teste' }
📝 Salvando mensagem no Firebase: { id: 'wamid...', contaId: 'awMBZRwHwYDUM0zeraH3' }
✅ Mensagem salva com sucesso: wamid...
```

**Logs de erro (se ainda falhar):**
```
❌ Firebase Admin não inicializado! Verifique as variáveis de ambiente
❌ WABA não encontrado: 1283278710593625
❌ Erro ao salvar mensagem no Firebase
```

### 3. Verificar Firebase Console

1. Acesse: https://console.firebase.google.com/
2. Projeto: **zybot**
3. Firestore Database: **zybot-data**
4. Collection: **mensagens**
5. Deve aparecer um documento com ID `wamid...`

---

## 🆘 TROUBLESHOOTING

### Erro: "The default Firebase app does not exist"
✅ **Solução:** Adicionar as 3 variáveis de ambiente conforme acima

### Erro: "error:1E08010C:DECODER routines::unsupported"
✅ **Solução:** Verificar se FIREBASE_PRIVATE_KEY tem aspas duplas e `\n` literais

### Mensagem não salva no Firebase
✅ **Solução:** Verificar se WABA ID está correto (1283278710593625) no metaAccess

### Webhook retorna 500
✅ **Solução:** Verificar logs do Vercel para erro específico

---

## 📞 CONTATO

Se após seguir todos os passos ainda houver problemas, compartilhe:
1. Screenshot das variáveis de ambiente no Vercel (sem mostrar valores)
2. Logs completos do webhook no Vercel
3. Screenshot do documento metaAccess no Firebase
