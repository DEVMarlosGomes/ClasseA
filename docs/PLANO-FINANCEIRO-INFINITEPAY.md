# Plano — Financeiro, comissões, recepção e InfinitePay

Status: aprovado em princípio · revisão 2 · 2026-11-07 · complementa [PLANO-MERCADO-PAGO.md](PLANO-MERCADO-PAGO.md)

## 1. Decisões do Igor (2026-11-07)

| # | Tema | Decisão |
| --- | --- | --- |
| 1 | Base da comissão | **35% do valor recebido**, pago pela plataforma ou na barbearia |
| 2 | Percentual | 35% padrão; **o Igor muda o percentual de cada barbeiro quando quiser** |
| 3 | Taxas | **Interruptor "descontar taxa da plataforma"**. Ligado, aparece a escolha de **quais plataformas** têm a taxa descontada antes da comissão |
| 4 | O que gera comissão | **Só atendimentos concluídos e pagos.** Falta e cancelamento não geram |
| 5 | Repasse | **Quinzenal** (dias 1–15 e 16–fim do mês) |
| 6 | Pagamento na barbearia | Precisa ser **registrado como pago ("dar baixa")**. Novo perfil **Recepção** com acesso à agenda para isso |
| — | Visibilidade | Barbeiro vê **só a própria comissão** dos serviços que prestou e que foram pagos. Números gerais: **só o Igor**, na aba Financeiro do painel |
| — | Gateways | **InfinitePay**: PIX e cartão avulsos. **Mercado Pago**: só o plano recorrente |
| — | Infra | O projeto **já está no Blaze** |

## 2. Fase 0 — sair do modo Spark (pré-requisito de tudo)

Hoje a Vercel roda com `VITE_SPARK=true`: o navegador faz o papel das Functions e as regras de segurança são frouxas. Por exemplo, qualquer barbeiro lê todos os `payments`. Com o Blaze, a barbearia passa a rodar no modo seguro:

1. **Migrar papéis:** copiar `roles/{uid}` → custom claims de cada usuário (script único). Sem isso, barbeiros e clientes criados no Spark perdem acesso quando as regras de produção entrarem. O Igor já tem os claims (bootstrap).
2. **Publicar as Functions** (`southamerica-east1`) e as regras `firestore.rules` (as de produção, não as `spark`).
3. **Vercel/Render:** `VITE_SPARK=false` e novo deploy.
4. **Conferir:** login de cada perfil, agendamento, cancelamento, agenda do barbeiro, painel do Igor.

Risco conhecido: nesta máquina o carregamento das Functions passa de 10 s (`Timeout after 10000` no emulador), e o deploy faz a mesma análise. Rodar o deploy com `FUNCTIONS_DISCOVERY_TIMEOUT=60` e, de preferência, com a pasta excluída do antivírus.

## 3. Modelo de dados

### 3.1 Baixa do atendimento (`appointments.settlement`) e comissão (`commissions`)

Gravado **só pelas Functions**, quando o atendimento é concluído e pago:

```ts
settlement: {
  status: 'paid' | 'refunded';
  channel: 'online' | 'shop' | 'plan';
  method: 'pix' | 'credit' | 'debit' | 'cash' | 'plan';
  platform: 'infinitepay' | 'mercadopago' | 'none';   // maquininha InfinitePay = 'infinitepay'
  receivedCents: number;                              // o que entrou de fato
  feeCents: number;                                   // taxa da plataforma (estimada ou informada)
  paidAt: Timestamp;
  registeredBy: string;                               // uid de quem deu baixa
}

// commissions/{appointmentId} — coleção separada: a recepção lê o atendimento, mas não a comissão.
{
  appointmentId: string;
  barberId: string;
  pct: number;                                        // percentual vigente na baixa
  baseCents: number;                                  // recebido, ou recebido − taxa (seção 3.3)
  amountCents: number;
  period: '2026-11-A' | '2026-11-B';                  // quinzena do repasse
}
```

- **Online (InfinitePay):** a baixa é automática quando o pagamento é confirmado e o atendimento concluído.
- **Na barbearia:** a recepção (ou o Igor) registra **forma de pagamento e valor recebido**. O valor vem preenchido com o preço e pode mudar (desconto, gorjeta fica fora).
- **Plano:** ver a decisão pendente na seção 7.
- **Percentual congelado:** mudar o percentual do barbeiro vale para as próximas baixas, não reescreve as já feitas.

### 3.2 Configuração financeira (`settings/finance`, só o Igor)

```ts
{
  defaultCommissionPct: 35,
  deductPlatformFees: false,                 // o interruptor
  deductFrom: ['infinitepay'],               // aparece quando o interruptor está ligado
  fees: {                                    // % por plataforma e forma (o Igor preenche com o contrato dele)
    infinitepay: { pix: 0, credit: 0, debit: 0 },
    mercadopago: { credit: 0 },
  },
}
```

E em cada barbeiro: `barbers/{id}.commissionPct` (vazio = usa o padrão).

### 3.3 Cálculo

```
base = receivedCents − (deductPlatformFees && platform ∈ deductFrom ? feeCents : 0)
comissão = round(base × pct / 100)
```

A taxa vem da tabela `fees`. A InfinitePay não informa a taxa na API, e o Mercado Pago informa (`fee_details`); quando a taxa real existir, ela tem prioridade sobre a tabela.

### 3.4 Repasses (`payouts/{barberId}_{período}`)

- Período quinzenal: `AAAA-MM-A` (1–15) e `AAAA-MM-B` (16–fim).
- O Igor fecha a quinzena: total de comissão, **"Registrar repasse"** (valor, data, forma, observação).
- Atendimento estornado depois do repasse: a comissão entra como **débito na quinzena seguinte**, sem reescrever o passado.

## 4. Perfis e telas

| Perfil | Vê | Faz |
| --- | --- | --- |
| **Igor (admin)** | Tudo | Configura percentuais e taxas, dá baixa, registra repasses, estorna |
| **Recepção** (novo) | Agenda de todos os barbeiros do dia/semana: cliente, serviços, horário, status, preço | **Dar baixa**: concluir + registrar pagamento (forma e valor). Marcar falta. **Não vê** faturamento, comissões nem pagamentos online |
| **Barbeiro** | Sua agenda e seus clientes; **Financeiro: só a própria comissão** | Concluir atendimento (sem registrar pagamento: quem recebe dinheiro é a recepção) |

### Telas

- **`/recepcao`:** agenda do dia, filtro por barbeiro, cartão de cada atendimento com **"Dar baixa"** (forma: dinheiro / PIX / crédito / débito; valor; confirmação). Atendimentos pagos online aparecem já pagos. Lista "pendentes de baixa" de dias anteriores.
- **`/barbeiro/financeiro`:** quinzena atual e anteriores; serviços pagos com a comissão de cada um; total da quinzena; repasse recebido ou a receber. Só os dados dele.
- **`/admin/financeiro`:**
  - resumo do período: bruto, taxas, comissões, resultado; por canal (barbearia, InfinitePay, Mercado Pago, planos);
  - por barbeiro: serviços pagos, base, %, comissão, repasse (pago/pendente) e "Registrar repasse";
  - configuração: % padrão, % por barbeiro, interruptor de taxas + plataformas + tabela de taxas;
  - pendências: atendimentos sem baixa, estornos a fazer na InfinitePay, assinaturas com pagamento pendente;
  - CSV da quinzena/mês.
- **`/admin/barbeiros`:** campo de % de comissão no cadastro e na edição do barbeiro.
- **Criar usuário da recepção:** no painel do Igor (e-mail + convite de senha), igual ao "Novo barbeiro".

### Regras de acesso (Blaze, `firestore.rules`)

- `appointments`: recepção lê todos (`hasRole('reception')`); **escrita só pelas Functions**. A baixa é uma callable `settleAppointment` (roles `reception`, `admin`).
- `appointments.settlement`: barbeiro (os próprios), recepção e admin leem; só as Functions escrevem.
- `commissions/{appointmentId}`: barbeiro lê só as próprias, admin lê tudo, **recepção não lê**; só as Functions escrevem.
- `payouts`: barbeiro lê os próprios; admin lê e escreve.
- `settings/finance`: só admin (diferente de `settings/shop`, que é público).
- `payments`, `subscriptions`: admin e o próprio cliente (barbeiro e recepção **não**).

## 5. InfinitePay (pagamento avulso)

Resumo da documentação oficial (<https://www.infinitepay.io/checkout-documentacao>, lida em 2026-11-07):

- `POST https://api.checkout.infinitepay.io/links` cria o link (preço em centavos; `order_nsu`, `redirect_url`, `webhook_url`, `customer`; com `X-Api-Key` aceita `valid_until`, `single_payment`, `payment_methods_enabled`).
- O cliente paga **na página da InfinitePay** (PIX ou crédito em até 12x) e volta pelo `redirect_url`.
- **Webhook sem assinatura**: todo aviso é confirmado em `POST .../payment_check` (`handle`, `order_nsu`, `transaction_nsu`, `slug`) e só vale com `paid: true` e valor certo.
- **Sem estorno pela API** (só no app ou na Conta Web) e **sem sandbox** (teste = cobrança real de R$ 1,00, estornada no app).
- Sem recorrência: os planos recorrentes ficam no Mercado Pago.

Fluxo do agendamento pago online:

1. O cliente confirma → o atendimento nasce **`pending_payment`** e segura o horário por **20 min**.
2. A Function cria o link (`order_nsu` = id do atendimento, `valid_until` = fim da reserva, `single_payment`).
3. O cliente paga e volta para `/agendar/retorno?order_nsu=…&slug=…&transaction_nsu=…`, e o app pede a confirmação ao servidor.
4. O servidor chama `/payment_check` (também a partir do webhook) → `confirmed` + `payments/ip_{transaction_nsu}`.
5. A reserva expira sem pagamento → o horário é liberado. Pagamento que chega depois da expiração → **"estorno pendente"** para o Igor.
6. Cancelamento no prazo de atendimento pago online → **"estorno pendente"** (o Igor estorna no app da InfinitePay e marca no painel).

## 6. Fases

| Fase | Entrega | Depende de |
| --- | --- | --- |
| **F0** | Sair do Spark: migrar papéis para claims, publicar Functions e regras, `VITE_SPARK=false` | Blaze (ok) + deploy |
| **F1** | Perfil **Recepção** + tela `/recepcao` + callable `settleAppointment` (baixa na barbearia) + `commissions` + `settings/finance` + % por barbeiro + **Financeiro do barbeiro** + **Financeiro do Igor** + repasses quinzenais + regras | F0 |
| **F2** | InfinitePay nas Functions: link, reserva `pending_payment` com expiração, retorno, webhook → `/payment_check`, estorno pendente | Checkout Integrado habilitado + API key + handle |
| **F3** | Front do pagamento online InfinitePay (agendamento e plano à vista); tira o mock de cartão e PIX | F2 |
| **F4** | Mercado Pago só para plano recorrente (Card Brick) | Credenciais MP |
| **F5** | Validação real: R$ 1,00 InfinitePay (estornar no app) + sandbox MP | F2–F4 |

O F1 fica **antes** dos gateways de propósito: a baixa na barbearia e as comissões já servem hoje, com pagamento no balcão.

### Andamento

- **Decisões finais (2026-11-07):** plano = 35% do preço de tabela; o barbeiro também dá baixa e pode encerrar como "não concluído" com justificativa obrigatória (data, hora e autor registrados); recepção = `recepcao@classea.com.br`; Vercel/Render continuam no Spark por enquanto, e a F0 fica para depois.
- **F1 implementada (2026-11-07)**, funcionando no Spark e nas Functions:
  - `settleAppointment` (baixa + comissão em uma transação) e "não concluído" com justificativa;
  - `/recepcao` (agenda de todos, baixa, pendentes dos últimos 14 dias), também aberta ao Igor;
  - `/barbeiro/financeiro` (só a própria comissão, por quinzena) e `/admin/financeiro` (resultado, comissões por barbeiro, repasse, CSV, regras);
  - regras de comissão: % padrão, % por barbeiro, interruptor de taxa + plataformas + tabela de taxas;
  - acesso da recepção criado pelo Igor em Barbeiros → Recepção;
  - regras: `commissions` e `payouts` por barbeiro, `settings/finance` restrito, e no Spark o barbeiro não lê mais todos os `payments`.
- **Para ir ao ar no Spark:** publicar as regras (`firebase deploy --config firebase.spark.json --only firestore:rules --project classea-97dd2`), fazer push para a Vercel, criar o acesso da recepção pelo painel e pôr **0%** no Igor em Financeiro → Regras.

## 7. Pendências de decisão (resolvidas em 2026-11-07, ver Andamento)

1. **Comissão de atendimento coberto por plano.** O plano não tem "valor recebido" por corte. Opções:
   a) 35% do preço de tabela do serviço;
   b) 35% do valor do plano dividido pelos cortes do mês (ex.: R$ 150 ÷ 5 = R$ 30 por corte; plano ilimitado precisa de uma regra própria);
   c) não gera comissão.
2. **O barbeiro pode dar baixa** (registrar pagamento) quando não houver recepção? Proposta: não; só a recepção e o Igor.
3. **Quem é a recepção:** e-mail da(s) pessoa(s) para criar o acesso.

## 8. Riscos

| Risco | Mitigação |
| --- | --- |
| Migração Spark → Blaze derrubar acessos | Script de claims antes de trocar as regras; checklist por perfil; manter `firestore.spark.rules` para voltar |
| Baixa errada no balcão | Quem deu baixa e quando ficam registrados; o Igor pode corrigir (com histórico) antes do repasse da quinzena |
| Webhook falso da InfinitePay | Sempre `/payment_check` no servidor, conferindo valor e `order_nsu` |
| Pagamento após a reserva expirar | `valid_until` + `single_payment` no link; se ainda acontecer, estorno pendente |
| Recepção vendo comissões | Comissão em coleção separada (`commissions`) que a recepção não lê |
| Taxa real diferente da tabela | Tabela editável; usa a taxa real quando a plataforma informar (Mercado Pago) |
