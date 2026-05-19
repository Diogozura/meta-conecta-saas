# Guia: Como encontrar as variáveis de ambiente do Meta

Este documento detalha o passo a passo para encontrar as variáveis necessárias para a integração com a API do WhatsApp e Embedded Signup.

## 1. META_WABA_ID (WhatsApp Business Account ID)

Para enviar templates e gerenciar a conta, você precisa do ID da Conta do WhatsApp Business.

**Passo a passo:**
1. Acesse o **Meta for Developers**: [developers.facebook.com/apps](https://developers.facebook.com/apps).
2. Selecione o seu aplicativo (ex: `agente-zap`).
3. No menu lateral esquerdo, vá em **WhatsApp** > **Configuração da API** (ou *API Setup*).
4. Localize o bloco de envio de mensagens de teste.
5. Copie o valor que aparece em **Identificador da conta do WhatsApp Business** (WhatsApp Business Account ID). 
6. Cole esse valor na variável `META_WABA_ID`.

---

## 2. NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID

Esse ID informa ao front-end qual configuração de cadastro utilizar quando o usuário abre o pop-up de signup.

**Passo a passo:**
1. Ainda no **Meta for Developers**, com seu app selecionado.
2. No menu lateral esquerdo, logo abaixo de *WhatsApp*, clique na opção **Configurador de cadastro incorporado** (ou *Embedded Signup* / *Configurações do cliente OAuth*).
3. Se você ainda não criou uma configuração, siga as instruções na tela para criar (selecionando as opções padrão de WhatsApp).
4. Ao final da criação, o painel irá gerar um **ID de Configuração** (*Configuration ID*).
5. Copie esse ID e cole na variável `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`.

---

## 3. META_BUSINESS_TOKEN (Token Permanente)

Na tela de "Configuração da API" o Meta fornece um token, mas **ATENÇÃO: ele é temporário e expira em 24h**. Para o sistema rodar sem interrupções em produção, você precisa de um token de Usuário do Sistema Permanente.

**Passo a passo:**
1. Acesse as **Configurações do Gerenciador de Negócios**: [business.facebook.com/settings](https://business.facebook.com/settings).
2. No menu lateral esquerdo, expanda **Usuários** e clique em **Usuários do sistema**.
3. Se não houver nenhum, clique em **Adicionar** e crie um usuário garantindo o cargo de **Administrador**.
4. Selecione o usuário recém-criado e clique no botão **Gerar novo token**.
5. No pop-up:
   - **Aplicativo:** Selecione o seu aplicativo da lista (ex: `agente-zap`).
   - **Permissões:** Role a lista de permissões e marque OBRIGATORIAMENTE `whatsapp_business_messaging` e `whatsapp_business_management`.
6. Finalize clicando em **Gerar token**.
7. Um token longo começando com **EAA...** será exibido. **Copie imediatamente** pois ele não aparecerá de novo.
8. Cole este valor na variável `META_BUSINESS_TOKEN`.
