# ⚡ Setup Rápido - Conta SuperAdmin

## 🎯 Forma Mais Fácil (Recomendado)

### 1. Certifique-se que o `.env.local` está preenchido

Os dados da Meta já estão no seu `.env.local`:
- ✅ `META_WABA_ID`
- ✅ `META_PHONE_NUMBER_ID`
- ✅ `META_BUSINESS_TOKEN`
- ✅ `META_WEBHOOK_VERIFY_TOKEN`

### 2. Execute 3 comandos:

```bash
# 1. Instalar dependência
npm install

# 2. Rodar o setup (versão rápida)
npm run setup-admin-quick

# 3. Iniciar o servidor
npm run dev
```

### 3. Pronto! Acesse:

```
URL: http://localhost:3000/login
Email: admin@zybot.com.br
Senha: Admin@123456
```

⚠️ **IMPORTANTE:** Mude a senha após o primeiro login!

---

## 📊 O que foi criado no Firebase?

### Coleção `contas`
```
contas/
  {contaId}/
    nome: "Zybot"
    email: "admin@zybot.com.br"
    status: "ativo"
```

### Subcoleção `usuarios`
```
contas/{contaId}/usuarios/
  {usuarioId}/
    nome: "Administrador"
    email: "admin@zybot.com.br"
    nivel: "proprietario"
    status: "ativo"
```

### Subcoleção `metaAccess`
```
contas/{contaId}/metaAccess/
  {metaAccessId}/
    wabaId: "1283278710593625"
    phoneNumberIds: ["1026009683939150"]
    accessToken: "EAAerrW..."
    status: "ativo"
```

### Firebase Auth
```
Usuário criado com:
  email: admin@zybot.com.br
  password: Admin@123456
  emailVerified: true
```

---

## 🔄 Versão Personalizável

Se quiser customizar os dados (nome da empresa, email, senha, etc.):

```bash
# Edite o arquivo primeiro
code scripts/setup-admin.ts

# Execute a versão customizável
npm run setup-admin
```

Edite a seção `config` no final do arquivo:
```typescript
const config: SetupConfig = {
  nomeConta: 'Sua Empresa',
  emailAdmin: 'seu@email.com',
  senhaAdmin: 'SuaSenhaSegura123!',
  // ... etc
}
```

---

## 🐛 Solução de Problemas

### "tsx não encontrado"
```bash
npm install tsx --save-dev
```

### "Email já existe"
Sem problema! O script reutiliza o usuário existente.

### "Permission denied"
Verifique as credenciais Firebase no `.env.local`:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### "META_BUSINESS_TOKEN expirado"
1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Vá em seu App → WhatsApp → Getting Started
3. Copie um novo token temporário
4. Atualize no `.env.local`
5. Execute o script novamente

---

## ✅ Após o Setup

1. **Login**: `http://localhost:3000/login`
2. **Mude a senha** em Settings/Perfil
3. **Adicione usuários** em Dashboard → Usuários
4. **Adicione clientes** em Dashboard → Clientes
5. **Teste envio** em Dashboard → Conversas
