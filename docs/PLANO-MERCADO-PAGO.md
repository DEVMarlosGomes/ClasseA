# Plano — Mercado Pago (planos recorrentes) e painel do Igor

Status: proposta · 2026-11-07

## 1. Onde estamos

| Item | Situação atual | Arquivo |
| --- | --- | --- |
| Gateway | Só `MockPaymentGateway`, atrás da interface `PaymentGateway` | `functions/src/payments/gateway.ts` |
| Assinatura | `subscribePlan` cobra o cartão salvo; `processSubscriptions` (cron diário) renova cobrando o token de novo | `functions/src/payments/index.ts` |
| PIX | BR Code fictício + botão "Simular pagamento" | `confirmMockPix` |
| Ambiente oficial | **Spark** (`VITE_SPARK=true`): as "Functions" rodam no navegador (`src/lib/spark/*`) | `docs/DEPLOY-PREVIEWS.md` |
| Admin | Papel `admin` via custom claim; já existem Agenda da equipe (todos os barbeiros), Planos, Assinaturas | `src/features/admin/*` |
| Igor | Cadastrado como **barbeiro**; é o titular do CNPJ (`DEFAULT_SETTINGS.legalName`) | `shared/defaults.ts`, `scripts/seed.ts` |

## 2. Bloqueio nº 1: Spark não serve para pagamento real

Mercado Pago exige:

- **Access Token secreto** no servidor (nunca no navegador);
- **Webhook** público para receber "pagamento aprovado", "assinatura cancelada", etc.;
- chamadas HTTP de saída para `api.mercadopago.com`.

No Spark não há Cloud Functions, então nada disso existe. **Pré-requisito: migrar o projeto `classea-97dd2` para Blaze** e publicar as Functions que já estão escritas (`southamerica-east1`). Custo esperado para o volume de uma barbearia: dentro da cota gratuita do Blaze (centavos/mês); configurar alerta de orçamento de R$ 20.

O modo Spark continua existindo só para previews (Vercel/Render) com o gateway mock.

## 3. Decisão de arquitetura: quem cobra a recorrência?

| Opção | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| **A. Assinaturas do MP (`/preapproval`)** — recomendada | Criamos a assinatura no MP com o cartão tokenizado; o MP cobra todo mês/semestre/ano e avisa por webhook | MP faz retentativas, atualização de cartão e e-mails de cobrança; não guardamos token reutilizável; menor escopo PCI | Só cartão de crédito (sem PIX recorrente); troca de plano = cancelar e criar outra |
| B. Cartão salvo (Customers & Cards) + nosso cron | Continuamos com `processSubscriptions` cobrando via `/v1/payments` | Controle total, reaproveita código atual | Nós cuidamos de retentativa, falhas, CVV em recorrência e chargeback; mais código e risco |

**Recomendação: Opção A.** O cron atual deixa de cobrar e passa a só reconciliar (expirar, resetar uso mensal, lembretes).

### PIX nos planos

PIX não tem débito automático no MP. Proposta:

- plano **semestral/anual** pago à vista via PIX (`/v1/payments` com `payment_method_id: "pix"`), sem renovação automática — já é o comportamento atual (`autoRenew: false` para PIX);
- 3 dias antes do fim, o app envia lembrete com novo PIX.

## 4. Modelo de recebimento: conta única do Igor

Todo o dinheiro cai **numa única conta Mercado Pago, do CNPJ 51.571.215/0001-01 (Igor)**. Não usamos split/marketplace: os outros barbeiros não recebem pelo MP; o repasse/comissão é acertado fora do app (pode virar relatório no painel — ver fase 4).

Credenciais (painel do desenvolvedor MP → "Suas integrações" → criar aplicação "Classe A App"):

| Segredo | Onde fica |
| --- | --- |
| `MP_ACCESS_TOKEN` (teste e produção) | Secret Manager (`defineSecret`) nas Functions |
| `MP_WEBHOOK_SECRET` | Secret Manager |
| `VITE_MP_PUBLIC_KEY` | variável do front (é pública) |

## 5. Fluxos

### 5.1 Assinar plano com cartão

```
Cliente (CardForm com MercadoPago.js / Card Payment Brick)
   │  tokeniza o cartão no navegador → card_token_id (uso único)
   ▼
Function subscribePlan({ planId, cardToken })
   │  POST /preapproval  { reason, payer_email, card_token_id,
   │                       auto_recurring: { frequency: 1|6|12, frequency_type: "months",
   │                                         transaction_amount, currency_id: "BRL" },
   │                       external_reference: subscriptionId, status: "authorized" }
   │  header X-Idempotency-Key = subscriptionId
   ▼
subscriptions/{id}  status: "pending" → aguardando webhook
   ▼
Webhook mpWebhook  (topic subscription_preapproval / subscription_authorized_payment / payment)
   │  1. valida x-signature (HMAC-SHA256 com MP_WEBHOOK_SECRET)
   │  2. NÃO confia no corpo: busca o recurso no MP pelo id
   │  3. grava/atualiza payments/{mpPaymentId} (id do MP = id do doc → idempotente)
   │  4. atualiza subscription: active / past_due / cancelled + currentPeriodEnd
   ▼
notifyUser(...)  "Plano ativo" / "Não conseguimos renovar"
```

### 5.2 Mapeamento de status

| MP (`preapproval.status`) | Nosso `Subscription.status` |
| --- | --- |
| `pending` | `pending` (novo) |
| `authorized` + último pagamento aprovado | `active` |
| pagamento recusado (MP vai retentar) | `past_due` |
| `paused` | `past_due` |
| `cancelled` | `cancelled` (acesso até `currentPeriodEnd`) |

### 5.3 Cancelamento e arrependimento (CDC art. 49)

- Dentro de 7 dias: `PUT /preapproval/{id} {status:"cancelled"}` + `POST /v1/payments/{id}/refunds`.
- Depois de 7 dias: cancela no MP, mantém acesso até o fim do período (igual hoje).

### 5.4 Troca de plano

Na data de renovação (`pendingPlanId`): cancela a preapproval antiga e cria a nova com `start_date = currentPeriodEnd`. Alternativa mais simples para o mesmo período: `PUT /preapproval/{id}` alterando `transaction_amount`.

## 6. Mudanças no código

### Backend (`functions/`)

1. `payments/mercadopago.ts` — `MercadoPagoGateway` (SDK `mercadopago` oficial ou `fetch`), timeout 10 s, `X-Idempotency-Key` em toda criação.
2. Estender `PaymentGateway` com `createSubscription`, `cancelSubscription`, `getSubscription`, `getPayment`; mock implementa também (testes e Spark continuam funcionando).
3. Escolha do gateway por ambiente: `MP_ACCESS_TOKEN` presente → MP; senão → mock.
4. `payments/webhook.ts` — `onRequest` público, valida assinatura, responde 200 rápido, processa idempotente. Registrar cada evento em `webhookEvents/{eventId}` (dedup + auditoria).
5. `subscribePlan`, `cancelSubscription`, `changePlan`, `createPixCharge` passam a usar o MP. Remover `confirmMockPix` em produção.
6. `processSubscriptions` deixa de cobrar; vira reconciliação: busca no MP assinaturas `active` com `currentPeriodEnd` vencido sem webhook (rede de segurança caso um webhook se perca).
7. Tipos: `Payment.method` ganha `'card' | 'pix'`; `Payment.gatewayRef` = id do MP; `Subscription` ganha `mpPreapprovalId` e status `pending`. `paymentMethods` (cartões salvos) deixa de ser necessário para planos.

### Front (`src/`)

1. `CardForm` → Card Payment Brick do MP (o número do cartão nunca passa pelo nosso código; atualizar CSP/Permissions-Policy em `vercel.json` para `sdk.mercadopago.com`).
2. `PixPanel` → QR real (`point_of_interaction.transaction_data.qr_code_base64`) com escuta em tempo real de `pixCharges/{id}` (o webhook muda o status).
3. Remover `DemoNotice` em produção; manter em preview.
4. `ClientPaymentsPage`: botão "Atualizar cartão do plano" (nova preapproval ou `PUT` com novo `card_token_id`).

### Regras (`firestore.rules`)

- `webhookEvents/*`: `allow read: if isAdmin(); write: if false`.
- Leitura de `clients` por collection group para o admin (ver seção 7).

## 7. Igor como administrador

### 7.1 Papel

Igor recebe `roles: ['barber', 'admin']` (continua atendendo e tem o painel do dono). Em produção, via `bootstrap:production` com `ADMIN_EMAIL` do Igor, ou pelo `setUserRole` a partir de outro admin. Só o Igor (e opcionalmente o Marlos como suporte técnico) com `admin`.

### 7.2 O que ele precisa ver — e o que já existe

| Necessidade | Hoje | Falta |
| --- | --- | --- |
| Rotina/agenda de cada barbeiro | `AdminAgendaPage` lista o dia com filtro por barbeiro | Visão semanal; abrir/fechar dia e bloquear horário **de outro barbeiro** (as regras de `barbers/{id}/days` já permitem admin; falta a tela — reaproveitar `AgendaGrid`) |
| Remarcar/cancelar atendimento de qualquer barbeiro | Functions validam pelo barbeiro dono | Liberar `admin` em `barberUpdateAppointmentStatus`/`cancelAppointment` com registro de quem fez |
| Clientes de todos | Regra permite admin ler `barberClients`, sem tela | `AdminClientsPage`: busca por nome/telefone, barbeiro, se tem plano, última visita. Query por collection group `clients` (exige `match /{path=**}/clients/{id}` nas regras) |
| Pagamentos | Regras permitem admin ler `payments`, sem tela | `AdminPaymentsPage`: lista por período, filtros (status, método, plano/avulso), totais do mês, link para o pagamento no painel do MP |
| Assinaturas | `AdminSubscriptionsPage` | Mostrar status do MP, próxima cobrança, inadimplentes (`past_due`) em destaque, ação "cancelar" |
| Faturamento por barbeiro | — | Fase 4: relatório mensal (atendimentos concluídos × valor) para calcular comissão |

### 7.3 Privacidade

As **anotações privadas** dos barbeiros sobre clientes (`privateNotes`) hoje são legíveis pelo admin. Decidir com o Igor se o painel mostra ou oculta — princípio do produto: "cada papel vê apenas o que precisa". Sugestão: ocultar por padrão. Atualizar a Política de Privacidade informando que pagamentos são processados pelo Mercado Pago (operador de dados).

## 8. Fases

| Fase | Entrega | Depende de |
| --- | --- | --- |
| 0 | Blaze ativado, Functions publicadas, conta MP do CNPJ verificada, aplicação MP criada, segredos no Secret Manager | Igor (conta MP e cartão do Blaze) |
| 1 | Igor admin + telas: agenda semanal com edição, clientes, pagamentos (ainda com dados mock) | — |
| 2 | `MercadoPagoGateway` + webhook + assinatura com cartão no **sandbox** (credenciais de teste e cartões de teste do MP) | Fase 0 |
| 3 | PIX real (avulso e planos à vista) + reconciliação diária + cancelamento/reembolso | Fase 2 |
| 4 | Relatório por barbeiro, exportação CSV do mês | Fase 1 |
| 5 | Virada para produção: credenciais de produção, URL do webhook de produção, 1 assinatura real de R$ 1 feita pelo Igor e cancelada/estornada | Fases 2–3 |

### Andamento

- **Fase 1 (2026-11-07):** feito no código, sem depender do Mercado Pago:
  - `/admin/rotina` — agenda semanal/diária de qualquer barbeiro (bloquear, liberar, horário extra, modelo semanal, cancelar com aviso), reaproveitando `AgendaEditor` da área do barbeiro;
  - `/admin/clientes` — clientes de toda a equipe, mesclados por cliente, com busca, filtros e WhatsApp; **sem** as anotações particulares;
  - `/admin/assinaturas` (menu "Pagamentos") — nome do cliente, inadimplentes primeiro, total recebido por mês;
  - regra `/{path=**}/clients/{id}` só para admin; seed com Igor `barber + admin`.
  - **Pendente em produção:** o barbeiro `igor-gabriel` de `PUBLIC_BARBERS` tem id fixo, não o uid da conta do Igor. Para a área do barbeiro e o painel funcionarem com a conta real, o documento `barbers/{uid}` precisa usar o uid dele, e `roles/{uid}` precisa ter `['barber', 'admin']`.

## 9. Testes

- Unitário: mapeamento de status MP → nosso; validação de `x-signature` (casos válido, adulterado, `ts` antigo).
- Integração no emulador com gateway mock: webhook duplicado não duplica pagamento; webhook fora de ordem (cancelado antes de autorizado) termina no estado certo.
- Sandbox MP: aprovado, recusado (`OTHE`), cartão sem saldo, cancelamento pelo painel do MP refletindo no app.
- Regras: barbeiro não lê pagamentos nem clientes de outro barbeiro; admin lê.

## 10. Riscos

| Risco | Mitigação |
| --- | --- |
| Webhook perdido → cliente pagou e o plano não ativa | Reconciliação diária + botão "verificar pagamento" que consulta o MP |
| Webhook falso | Validar `x-signature` e sempre reconsultar o recurso pelo id na API |
| Cobrança duplicada em retry | `X-Idempotency-Key` + id do pagamento MP como id do documento |
| Access Token vazado | Só no Secret Manager; nunca em `VITE_*`; rotacionar se exposto |
| Preço do plano mudar | Assinaturas existentes mantêm valor; aplicar novo valor só na renovação via `PUT` com aviso prévio ao cliente |

## 11. Perguntas para o Igor

1. A conta Mercado Pago já existe no CNPJ, verificada?
2. Pode ativar o Blaze no Firebase (cartão para cobrança, com alerta de orçamento)?
3. Plano mensal só no cartão; semestral/anual aceita PIX à vista — de acordo?
4. Ele quer ver as anotações privadas dos outros barbeiros sobre clientes?
5. A comissão dos barbeiros deve aparecer no app (fase 4) ou fica fora?
