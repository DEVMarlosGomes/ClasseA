# Product

<!-- impeccable:product-schema 1 -->

> Derived from the engineering brief "Prompt de Engenharia — App Classe A Barbearia" (2026-10-25, @MARLOSG).
> Facts marked *(inferido)* were inferred from the brief, not confirmed in an interview.

## Platform

web

## Stack

React + TypeScript + Vite, Firebase (Auth, Firestore, Functions v2, Storage, Hosting, App Check), Tailwind, Framer Motion, Radix UI. Fixed by the brief.

## Users

- **Cliente da barbearia** — homem adulto da região da loja, no celular, quer marcar corte/barba rápido, sem ligar, e voltar com o mesmo barbeiro. Usa 4G na rua *(inferido)*.
- **Barbeiro** — entre um atendimento e outro, no próprio celular, precisa ver o dia, bloquear/liberar horários com um toque e lembrar como cada cliente gosta do corte.
- **Dono (admin)** — configura serviços, preços, planos, barbeiros e textos legais. Pode também ser barbeiro.

## Product Purpose

Web app da Classe A Barbearia: landing que converte em agendamento, fluxo de agendamento sem login prévio, assinatura de planos (mensal, semestral, anual), pagamento simulado e área do barbeiro com agenda em tempo real. Sucesso = cliente agenda em menos de um minuto; barbeiro gere a agenda sem ligar para ninguém.

## Positioning

É a barbearia física estendida para o celular: o mesmo letreiro dourado retroiluminado, o mesmo preto fosco, os mesmos barbeiros — com horário real, ao vivo, e planos de assinatura.

## Operating Context

- Loja de rua com fachada ACM preta, letreiro dourado, calçada portuguesa ondulada, piso de mármore branco, mural ilustrado em P&B (ídolos brasileiros).
- Atendimento por hora marcada; tolerância de atraso, política de cancelamento (2 h), lembretes 24 h/2 h.
- Fuso America/Sao_Paulo, BRL, formatos brasileiros.

## Capabilities and Constraints

- Pagamentos 100% simulados (MockPaymentGateway); nunca guardar PAN completo nem CVV.
- Agendamentos, cobranças e papéis só escritos por Cloud Functions.
- LGPD: consentimento registrado, nada não essencial antes do aceite, direitos do titular no app.
- Dados de negócio desconhecidos (preços, endereço, CNPJ, barbeiros) = placeholders `TODO(cliente)` em settings.

## Brand Commitments

- Nome: **Classe A Barbearia**. Logo cursiva dourada com a navalha formando o "A" e "— BARBEARIA —" com traços. Usar apenas o arquivo da logo (vetorizado), nunca recriar com fontes.
- Preto fosco dominante + dourado metálico como única cor de destaque.
- Interface em português do Brasil, sem jargão técnico para o cliente.

## Evidence on Hand

- `public/images/fachada.*`, `public/images/interior.*` — fotos reais da loja.
- Mockups de produtos da marca (toalha, camiseta, boné, capa) — referência visual, não usados como fotos da loja.
- **Não existem**: avaliações, número de clientes, anos de mercado, fotos dos barbeiros, preços confirmados. Não inventar.

## Product Principles

1. Agendar é a ação principal: sempre a um toque de distância.
2. A agenda é verdade em tempo real — o que o cliente vê é o que o barbeiro liberou.
3. Nada acontece em silêncio: cancelamentos e conflitos sempre pedem decisão e avisam o cliente.
4. Privacidade por padrão: cada papel vê apenas o que precisa.
5. Premium é precisão, não excesso: movimento contido, desliga com redução de movimento.

## Accessibility & Inclusion

WCAG 2.2 AA; alvos de toque ≥ 44 px; `prefers-reduced-motion` em todo o app; inputs ≥ 16 px.
