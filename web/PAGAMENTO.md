# Gate de Pagamento (Mercado Pago / Google Pay)

Plano de implementação do sistema de cobrança recorrente que bloqueia o acesso
ao `/dashboard` de contas sem assinatura ativa. Sem período de teste: a conta
nasce bloqueada e só libera após o primeiro pagamento ser confirmado.

## Decisões

- **Gateway**: Mercado Pago (Google Pay sozinho não processa nem transfere
  dinheiro — precisa de um gateway por trás). Mercado Pago porque já tem conta
  bancária no Brasil, Pix, cartão e API de assinaturas.
- **Modelo de cobrança**: assinatura recorrente automática.
- **Métodos no checkout**: Google Pay + Pix + Cartão (Checkout do Mercado
  Pago oferece os três na mesma tela).
- **Trial sem cartão (atualizado)**: o cadastro pode ser concluído
  escolhendo um método de pagamento (segue pra `/pagamento`) **ou pulando
  essa etapa** — nesse caso a conta nasce com `assinatura.status: 'trial'` e
  `trialEndsAt` 14 dias à frente, com acesso liberado ao dashboard até o
  prazo vencer. Depois do trial expirar sem pagamento, a conta vira
  `pendente_pagamento` e passa a valer o mesmo bloqueio de antes. (Decisão
  anterior era "sem trial" — mudou a pedido do produto: o botão de pular no
  `/cadastro` precisa dar acesso de verdade, não só adiar o cartão.)
- **Ressalva**: a API de assinaturas do Mercado Pago (`preapproval`) cobra
  automaticamente todo mês via **cartão tokenizado**. Pix e Google Pay
  funcionam para o pagamento inicial; a recorrência subsequente depende do
  cartão salvo — limitação do próprio Mercado Pago, deixar isso claro para o
  usuário final no checkout.

## Passo 0 — Segurança (fazer antes de tudo)

`VERCEL_ENV_SETUP.md` está commitado no git e contém uma **chave privada real
do Firebase Admin SDK em texto puro** (vazada no commit `4aa9767`). Com essa
chave, qualquer pessoa tem acesso admin total ao Firestore e poderia escrever
`assinatura.status = 'ativa'` direto no banco, contornando todo o bloqueio.

- [ ] Rotacionar a service account no console do Firebase (gerar nova chave,
      revogar a antiga).
- [ ] Remover o conteúdo sensível de `VERCEL_ENV_SETUP.md` e do histórico do
      git (ação destrutiva — pedir confirmação antes de reescrever histórico).

## Passo 1 — Modelo de dados

Arquivo: `web/src/types/database.ts`

- [ ] Adicionar campo `assinatura` em `Conta`:
  ```ts
  assinatura?: {
    status: 'trial' | 'pendente_pagamento' | 'ativa' | 'atrasada' | 'cancelada'
    trialEndsAt?: Date
    mpPreapprovalId?: string
    mpPayerId?: string
    proximoVencimento?: Date
    ultimoPagamentoId?: string
  }
  ```
- [ ] Atualizar `criarConta` e `atualizarConta` em `web/src/lib/firestore.ts`
      para aceitar o novo campo.
- [ ] Adicionar helper `atualizarAssinatura(contaId, data)`.

## Passo 2 — Integração com Mercado Pago

- [ ] Novas env vars em `.env.local.example` e na Vercel:
      `MERCADOPAGO_ACCESS_TOKEN` (privado, servidor),
      `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] Instalar o SDK oficial `mercadopago` (Node).
- [ ] Criar `web/src/lib/mercadopago.ts`: inicializa o client e expõe
      `criarAssinatura(conta)` (cria um `preapproval`), `buscarAssinatura(id)`,
      `buscarPagamento(id)`.
- [ ] Regra: o webhook nunca confia no corpo recebido — sempre busca o
      recurso pelo ID direto na API do Mercado Pago antes de gravar no
      Firestore (evita spoofing de payload).

## Passo 3 — Webhook

Arquivo: `web/src/app/api/webhook/mercadopago/route.ts`

Replicar o padrão já usado em `web/src/app/api/webhook/route.ts` (verificação
de assinatura do body cru antes de parsear):

- [ ] Validar o header `x-signature` do Mercado Pago com
      `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] Buscar o recurso (`payment` ou `preapproval`) pela API oficial usando o
      ID do evento.
- [ ] Mapear o status retornado para `assinatura.status` da conta
      correspondente via `atualizarAssinatura`.

## Passo 4 — Bloqueio de acesso

Arquivo: `web/src/app/dashboard/layout.tsx` (hoje é `'use client'`, só cuida
de UI — não pode fazer checagem no servidor).

- [ ] Mover o conteúdo atual para `web/src/app/dashboard/DashboardShell.tsx`
      (mesmo componente cliente, sem mudanças de UI).
- [ ] `web/src/app/dashboard/layout.tsx` vira Server Component: chama
      `auth()` (já existe em `web/src/lib/auth.ts`), busca a `Conta` via
      `obterConta(contaId)`. Libera (`<DashboardShell>{children}</DashboardShell>`)
      quando `assinatura.status === 'ativa'` **ou** (`status === 'trial'` e
      `trialEndsAt` ainda não passou); nos demais casos, `redirect('/pagamento')`.
- [ ] `middleware.ts` continua igual (só checa presença do cookie `session`,
      roda no Edge runtime) — a checagem de pagamento fica no layout porque
      precisa do Admin SDK/Firestore.

## Passo 5 — Página de pagamento

Arquivo: `web/src/app/pagamento/page.tsx`

- [ ] Página protegida (exige sessão, não entra em `PUBLIC_ROUTES`) que
      mostra o status atual da assinatura e embute o Wallet Brick do Mercado
      Pago com Google Pay + Pix + Cartão.
- [ ] Após aprovação, o webhook já terá atualizado o Firestore; a página faz
      polling curto ou o usuário navega de volta para `/dashboard`.

## Passo 6 — Cadastro público (não existe hoje)

Não existe página de self-signup — contas são criadas via scripts de admin.

Arquivo: `web/src/app/cadastro/page.tsx`

- [ ] Adicionar `/cadastro` em `PUBLIC_ROUTES` no `middleware.ts`. (Já feito
      — ver `web/src/middleware.ts`; o wizard visual em
      `web/src/app/cadastro/` já existe, falta só a criação real da conta.)
- [ ] Criar o usuário no Firebase Auth (client SDK).
- [ ] Criar a `Conta` com o `Usuario` como `PROPRIETARIO`, e
      `assinatura.status` dependendo da escolha na última etapa do wizard
      (pagamento): se o usuário escolheu um método,
      `status: 'pendente_pagamento'`; se pulou, `status: 'trial'` com
      `trialEndsAt: now + 14 dias`.
- [ ] Chamar `setSession` e redirecionar: `pendente_pagamento` vai pra
      `/pagamento`; `trial` vai direto pra `/dashboard`.

## Passo 7 — Renovação e tolerância

- [ ] Falha na renovação (webhook reporta `preapproval` pausado/pagamento
      rejeitado) → `assinatura.status = 'atrasada'` imediatamente, mantendo
      acesso por um período curto de tolerância (ex.: 3 dias, configurável).
- [ ] Criar `web/src/app/api/cron/checar-assinaturas/route.ts` +
      configuração em `vercel.json` (Vercel Cron, execução diária): varre
      contas `atrasada` cujo prazo de tolerância já passou e marca
      `cancelada`; varre também contas `trial` cujo `trialEndsAt` já passou
      e marca `pendente_pagamento` (nunca `cancelada` — a conta nunca chegou
      a assinar, só o teste acabou).

## Passo 8 — Segurança específica do pagamento

- [ ] Toda chamada à API do Mercado Pago e escrita de status de assinatura
      acontece só no servidor (API routes/server actions).
- [ ] Nunca confiar em status de pagamento reportado pelo client — sempre
      reconfirmar servidor-a-servidor com a API do Mercado Pago.
- [ ] Documentar as novas env vars em `.env.local.example` e nas configs da
      Vercel; não repetir o erro do `VERCEL_ENV_SETUP.md` (nunca colar
      chaves reais em markdown versionado).

## Verificação

- [ ] Rodar o fluxo completo em sandbox do Mercado Pago (credenciais e
      cartões de teste): `/cadastro` → conta `pendente_pagamento` → checkout
      → webhook (via `ngrok` ou preview da Vercel) → conferir que a conta
      vira `ativa` e `/dashboard` libera.
- [ ] Forçar `assinatura.status` para `atrasada`/`cancelada` numa conta de
      teste direto no Firestore e confirmar que `/dashboard/*` redireciona
      para `/pagamento`.
- [ ] Invocar a rota do cron manualmente com uma conta cujo
      `proximoVencimento` já passou e conferir que ela é bloqueada.
- [ ] Confirmar que `/cadastro` é acessível sem sessão e `/dashboard/*` não é
      acessível sem assinatura ativa.
- [ ] Concluir o cadastro pulando a etapa de pagamento → conta `trial` →
      `/dashboard` libera direto. Forçar `trialEndsAt` no passado numa conta
      de teste e confirmar que o cron marca `pendente_pagamento` e o
      `/dashboard/*` passa a redirecionar para `/pagamento`.
