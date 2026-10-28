# Decisões de engenharia

## Firebase e ambientes

- O desenvolvimento usa exclusivamente o projeto fictício `demo-classe-a` no Emulator Suite. A configuração real fica em `.env.production.local`, ignorada pelo Git.
- O projeto real associado é `barbeariaclassea-9f2b4`; o Realtime Database existente não é usado porque disponibilidade, regras, transações e listeners foram modelados para Cloud Firestore.
- O Firestore deve ser criado em `southamerica-east1`. Essa escolha reduz latência para São Paulo e coincide com a região das Functions.
- O alias padrão continua apontando para `demo-classe-a`; produção exige `--project barbeariaclassea-9f2b4` ou o alias `prod`. Isso reduz deploy acidental.
- O bootstrap de produção exige confirmação explícita do project ID e Application Default Credentials. Ele não cria dados pessoais fictícios nem agendamentos.

## Produto

- Pagamentos permanecem 100% simulados. A fronteira `PaymentGateway` permite trocar a implementação sem mudar telas e agendamento.
- Serviços, planos, dados comerciais e políticas sem confirmação permanecem marcados como `TODO(cliente)` e editáveis no admin.
- Desativar serviço, plano ou barbeiro preserva histórico. A UI administrativa prefere ativação/desativação a exclusões destrutivas.
- O painel admin usa Firestore em tempo real para catálogo e visão operacional. Operações de dinheiro, agenda e papel continuam restritas às Cloud Functions.

## Segurança e privacidade

- Claims do Firebase Auth são a fonte de verdade para papéis; `users/{uid}.role` é apenas espelho de interface.
- App Check usa reCAPTCHA Enterprise em produção e permanece desligado nos emuladores.
- Analytics só pode iniciar depois do consentimento. Marketing e desempenho começam negados.
- Dados de cartão reais não entram no backend. CVV é validado e descartado no navegador.
- Documentos legais são versionados. Termos e Privacidade novos exigem novo aceite; mudança da política de cookies pede nova escolha.

## Interface e desempenho

- Rotas são carregadas sob demanda. Firebase Auth e módulos de backend não entram no caminho crítico da landing até serem necessários.
- A identidade preta e dourada, a logo original e as fotos fornecidas são preservadas; nenhuma marca foi redesenhada.
- O design respeita `prefers-reduced-motion`, safe areas móveis e alvos mínimos de toque.
- A landing consulta disponibilidade pública sem PII. O chunk do Firestore é isolado e deve ser acompanhado no Lighthouse antes do lançamento.

## Operação

- E-mail usa a fila `mail`, compatível com a extensão Trigger Email from Firestore. WhatsApp permanece no adaptador sem operação até a escolha do provedor.
- CI valida lint, tipos, testes unitários, regras, E2E e builds. Preview e produção exigem credenciais próprias do repositório.
- A publicação pública fica condicionada à ativação do Firestore/Blaze/App Check, dados comerciais reais e revisão jurídica.
