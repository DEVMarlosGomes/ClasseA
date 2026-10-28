# Classe A Barbearia

Web app mobile-first da Classe A Barbearia. O projeto reúne landing page, agendamento, área do cliente, planos e pagamentos simulados, área do barbeiro, painel administrativo, documentos LGPD, PWA e backend Firebase.

[![CI](https://github.com/DEVMarlosGomes/ClasseA/actions/workflows/ci.yml/badge.svg)](https://github.com/DEVMarlosGomes/ClasseA/actions/workflows/ci.yml)

## Recursos

- landing responsiva com catálogo, equipe, planos, localização e próximo horário disponível;
- agendamento em etapas, escolha de profissional, prevenção de conflito e disponibilidade pública;
- cadastro e login com e-mail/senha ou Google, recuperação de senha e verificação de e-mail;
- área do cliente com próximos horários, histórico, repetição, cancelamento, plano e perfil;
- área do barbeiro com agenda diária/semanal, atendimento, bloqueios e histórico do cliente;
- painel administrativo para agenda, equipe, serviços, planos, assinaturas, pagamentos, textos legais e configurações;
- pagamentos mock com cartão ou Pix, isolados atrás de uma interface pronta para receber um gateway real;
- consentimento de cookies, versionamento de termos, exportação/exclusão de conta e regras de acesso por papel;
- PWA instalável, funcionamento offline das telas já visitadas, App Check e observabilidade opcional com Sentry;
- testes unitários, de regras do Firestore e jornadas E2E em layouts mobile e desktop.

## Arquitetura

| Camada         | Tecnologia e responsabilidade                                                 |
| -------------- | ----------------------------------------------------------------------------- |
| Interface      | React 19, TypeScript, Vite, Tailwind CSS, Radix UI e Framer Motion            |
| Estado e dados | TanStack Query, Zustand e React Hook Form + Zod                               |
| Backend        | Firebase Authentication, Cloud Firestore, Storage e Cloud Functions v2        |
| Hospedagem     | Firebase Hosting com fallback de SPA e PWA via Workbox                        |
| Qualidade      | ESLint, Vitest, Firebase Rules Unit Testing e Playwright                      |
| Entrega        | GitHub Actions para verificação, preview de pull request e produção na `main` |

As leituras públicas da landing usam Firestore Lite. Áreas autenticadas carregam o SDK completo sob demanda para listeners em tempo real e cache persistente. Operações sensíveis, como criação de barbeiro, agendamento, cancelamento, pagamentos e exclusão de conta, passam por Functions e validam o papel do usuário no servidor.

As coleções principais são `users`, `barbers`, `services`, `plans`, `appointments`, `availabilityPublic`, `subscriptions`, `payments`, `legal` e `settings`. As regras em `firestore.rules` mantêm clientes isolados, limitam barbeiros à própria agenda e reservam alterações administrativas a usuários com claim `admin`.

```text
src/                 interface, rotas, componentes e integrações do navegador
shared/              tipos, regras de agenda e valores padrão compartilhados
functions/src/       Functions, gatilhos, notificações e gateway de pagamento
tests/               testes E2E e das regras do Firestore
scripts/             seed local, emuladores, assets e bootstrap de produção
public/               marca, imagens, robots.txt e manifestos públicos
.github/workflows/    integração e entrega contínuas
```

## Estado atual

O código compila e usa o Firebase Emulator Suite no desenvolvimento. O app Web de produção já está registrado no projeto Firebase `barbeariaclassea-9f2b4`, e o Hosting padrão é `https://barbeariaclassea-9f2b4.web.app`.

Previews públicos conectados à branch `main`:

- Vercel: `https://classeabarbearia.vercel.app`;
- Render: `https://classe-a-barbearia-preview.onrender.com`.

A landing já inclui os dados comerciais informados, os quatro planos mensais, os preços avulsos, as fotos reais do espaço e dos trabalhos e os profissionais Roberth, Igor Gabriel e Anderson CH. Igor aparece no centro, identificado como proprietário. Enquanto o Firestore estiver indisponível, o catálogo público usa esses dados locais de reserva para que a landing não fique vazia; o agendamento e as áreas autenticadas continuam dependendo do Firebase ativo.

Endereço comercial: **Av. Miguel Badra, 1896 — Badra, Suzano/SP — CEP 08690-010**. O botão “Como chegar” usa o [local oficial no Google Maps](https://maps.app.goo.gl/L5kWnQNGbSM9qHtr6).

Antes do deploy público ainda é obrigatório:

1. ativar o Cloud Firestore em modo Native e região `southamerica-east1`;
2. confirmar que o projeto está no plano Blaze, necessário para Cloud Functions e tarefas agendadas;
3. habilitar os provedores de Authentication;
4. criar a chave reCAPTCHA Enterprise do App Check;
5. informar Instagram, e-mail e horários oficiais em `/admin/configuracoes`;
6. obter revisão jurídica das minutas de Privacidade, Termos e Cookies;
7. configurar o envio real de e-mail. WhatsApp continua intencionalmente desativado até a escolha de um provedor;
8. executar a lista de validação e só então liberar o Hosting de produção.

O Realtime Database existente em `barbeariaclassea-9f2b4-default-rtdb` não é usado. A aplicação foi desenhada para Cloud Firestore.

## Desenvolvimento local

Pré-requisitos: Node.js 20 ou 22, Java 21 para os emuladores e npm.

```bash
npm ci
npm --prefix functions ci
npm run emulators
```

Em outro terminal:

```bash
npm run seed
npm run dev
```

URLs locais:

- app: `http://localhost:5173`
- Emulator UI: `http://localhost:4000`
- Hosting emulado: `http://localhost:5000`

Contas locais, todas com a senha `ClasseA#2026`:

- `dono@classea.test` — administrador;
- `roberth@classea.test`, `igor@classea.test`, `anderson@classea.test` — barbeiros;
- `cliente@classea.test` — cliente com plano e cartão mock.

O arquivo `.env.local` aponta para `demo-classe-a` e mantém `VITE_USE_EMULATORS=true`. O arquivo ignorado `.env.production.local` contém a configuração pública do app Web de produção e mantém `VITE_USE_EMULATORS=false`.

## Verificações

```bash
npm run check
npm run test:rules
npm run test:e2e
```

`npm run check` executa lint, TypeScript, testes unitários, build das Functions e build do front. `test:rules` valida isolamento por papel. `test:e2e` sobe emuladores, aplica o seed e testa landing, cliente, barbeiro e admin em Chromium mobile e desktop.

## Ligar o Firebase de produção

O projeto e o app Web já estão associados ao repositório:

- projeto: `barbeariaclassea-9f2b4`;
- app Web: `Classe A Barbearia Web`;
- Hosting: `barbeariaclassea-9f2b4.web.app`;
- alias local: `prod` em `.firebaserc`.

Siga esta ordem porque a região do Firestore não pode ser trocada depois da criação.

### Homologação no plano Spark

Para testar sem ativar faturamento, configure `VITE_SPARK=true` na Vercel, Render ou em `.env.production.local` e execute:

```bash
npm run deploy:spark
```

Esse comando compila o front e publica `firestore.spark.rules`, os índices e o Hosting. O modo Spark executa no navegador as operações que normalmente seriam protegidas por Functions, usa `roles/{uid}` no lugar de custom claims e grava fotos pequenas como data URL no Firestore. Authentication e o Firestore precisam estar habilitados antes do deploy.

Use esse modo somente para homologação. Um cliente modificado pode falsificar disponibilidade, agendamentos e pagamentos simulados porque não existe um backend confiável para validar essas operações. Para uso com clientes reais, siga as etapas abaixo, migre para Blaze e mantenha `VITE_SPARK=false`.

### 1. Plano e orçamento

No console do Firebase, abra **Uso e faturamento** e vincule uma conta de faturamento para usar o plano Blaze. No Google Cloud Billing, crie alertas de orçamento. O Blaze não significa cobrança automática alta, mas Functions, Scheduler, egress e extensões podem gerar custo.

### 2. Cloud Firestore

No console, abra **Build > Firestore Database > Criar banco de dados**:

- modo: **Native**;
- região: **southamerica-east1 (São Paulo)**;
- regras iniciais: qualquer opção temporária, pois `firestore.rules` será implantado em seguida.

Neste momento a API do Firestore ainda está desativada no projeto. Não use o Realtime Database como substituto.

### 3. Authentication

Em **Build > Authentication > Sign-in method**:

- habilite **E-mail/senha**;
- habilite **Google** e selecione o e-mail de suporte;
- confira em **Settings > Authorized domains** se constam `localhost`, `barbeariaclassea-9f2b4.web.app`, `barbeariaclassea-9f2b4.firebaseapp.com` e o domínio próprio quando existir.

Personalize o remetente e os modelos de verificação de e-mail e redefinição de senha antes do lançamento.

### 4. Storage

Abra **Build > Storage**, crie o bucket padrão na região compatível e depois implante `storage.rules`. O front aceita fotos JPG, PNG ou WebP de até 3 MB.

### 5. App Check

Em **Build > App Check**, registre o app Web com **reCAPTCHA Enterprise**. Copie apenas a _site key_ pública para `VITE_RECAPTCHA_ENTERPRISE_KEY` em `.env.production.local` e na variável do GitHub Actions.

Primeiro publique com App Check em modo de monitoramento. Confira as métricas de requisições válidas e inválidas. As callables permanecem sem imposição enquanto `ENFORCE_APP_CHECK` não for `true`, permitindo testar os previews antes de configurar o reCAPTCHA. Só depois habilite a imposição para Authentication, Firestore, Storage e Functions, defina `ENFORCE_APP_CHECK=true` no ambiente das Functions e implante novamente. O front inicializa App Check antes desses serviços e renova tokens automaticamente.

### 6. Regras, índices e Functions

Autentique o CLI e selecione o alias:

```bash
npx firebase-tools login
npx firebase-tools use prod
npm run check
npx firebase-tools deploy --only firestore,storage,functions --project barbeariaclassea-9f2b4
```

As Functions usam Node.js 20 e região `southamerica-east1`. Se o deploy informar APIs desativadas, aceite a ativação ou habilite no Google Cloud Console: Cloud Functions, Cloud Build, Artifact Registry, Eventarc e Cloud Scheduler.

### 7. Primeiro administrador e dados iniciais

Instale o Google Cloud CLI e autentique Application Default Credentials:

```bash
gcloud auth application-default login
```

Execute uma única vez, trocando os dados:

```powershell
$env:PRODUCTION_PROJECT_ID='barbeariaclassea-9f2b4'
$env:BOOTSTRAP_CONFIRM='barbeariaclassea-9f2b4'
$env:ADMIN_EMAIL='dono@seudominio.com.br'
$env:ADMIN_NAME='Nome do proprietário'
$env:ADMIN_PHONE='5511999999999'
npm run bootstrap:production
```

O script exige a repetição exata do project ID, recusa projetos `demo-*`, cria somente o primeiro admin, configura claims e `roles/{uid}`, e adiciona as configurações, os serviços, os planos e os perfis públicos dos três barbeiros sem clientes ou agendamentos fictícios. Ele imprime um link único para definir a senha.

Entre em `/admin` e substitua todos os dados de exemplo. Cadastre equipe, serviços, preços, planos e versões jurídicas definitivas. Não rode `npm run seed` contra produção; esse comando é exclusivo dos emuladores.

### 8. E-mail e lembretes

As Functions gravam mensagens na coleção `mail`. Instale e configure a extensão oficial **Trigger Email from Firestore** ou troque `functions/src/notify.ts` por um provedor transacional. Restrinja a coleção `mail` às Functions, configure SPF/DKIM do domínio e teste verificação, cancelamento e lembretes de 24 h e 2 h.

O adaptador de WhatsApp é `NoopWhatsAppNotifier`: nenhuma mensagem de WhatsApp é enviada até que uma implementação real seja escolhida.

### 9. Preview e produção

Crie primeiro um canal temporário:

```bash
npm run build
npx firebase-tools hosting:channel:deploy homologacao --expires 7d --project barbeariaclassea-9f2b4
```

Valide em celular real: cadastro, login, agendamento, conflito de horário, cancelamento, plano mock, agenda do barbeiro, admin, cookies e exclusão de conta.

Depois do aceite comercial e jurídico:

```bash
npx firebase-tools deploy --only hosting --project barbeariaclassea-9f2b4
```

Para um deploy completo posterior:

```bash
npx firebase-tools deploy --only firestore,storage,functions,hosting --project barbeariaclassea-9f2b4
```

## GitHub Actions

O workflow `.github/workflows/ci.yml` executa qualidade, regras e E2E; abre canal de preview em PR e publica a branch `main`.

Configure no repositório:

- secret `FIREBASE_SERVICE_ACCOUNT` com uma conta de serviço dedicada e permissões mínimas para deploy;
- variable `VITE_FIREBASE_API_KEY`;
- variable `VITE_RECAPTCHA_ENTERPRISE_KEY`.
- variable `ENABLE_FIREBASE_DEPLOY` com valor `true` somente depois de concluir a preparação de produção deste guia.

Enquanto `ENABLE_FIREBASE_DEPLOY` estiver ausente ou diferente de `true`, pushes na `main` executam a verificação
sem tentar publicar no Firebase. Proteja `main` exigindo o job `verify`. Use ambientes do GitHub com aprovação
obrigatória para `deploy-production` se desejar um controle adicional.

## Deploy de testes em outros provedores

O repositório inclui `vercel.json` e `render.yaml` para publicar o front na Vercel ou Render com fallback de SPA.
Variáveis, autorização dos novos domínios no Firebase e limitações do backend estão documentadas em
[`docs/DEPLOY-PREVIEWS.md`](docs/DEPLOY-PREVIEWS.md).

## Pagamentos

Todos os pagamentos são simulados. O front nunca envia CVV e as Functions guardam apenas token fictício, bandeira e final do cartão. Cartões de teste:

- `4242 4242 4242 4242` — aprovado;
- `5555 5555 5555 4444` — aprovado;
- `4000 0000 0000 0002` — recusado;
- `4000 0000 0000 9995` — saldo insuficiente;
- `4000 0000 0000 0069` — vencido.

Para um gateway real, implemente outra classe da interface `PaymentGateway` em `functions/src/payments/gateway.ts`. A tokenização deve acontecer no SDK do gateway no navegador; PAN completo e CVV nunca devem passar pelas Functions nem pelo Firestore.

## LGPD e resposta a incidentes

As minutas são ponto de partida e exigem revisão de advogado. Antes do lançamento, confirme controlador, CNPJ, endereço, canal do titular, retenção, operadores, transferência internacional, regras de plano/cancelamento e maioridade.

Em incidente: preserve evidências e logs com acesso restrito, interrompa o vetor, avalie natureza/volume/risco dos dados, registre decisões, acione jurídico e responsável interno, comunique ANPD e titulares quando aplicável dentro do prazo legal vigente, corrija a causa e documente as medidas posteriores. Nunca registre dados de cartão, senhas ou dados pessoais desnecessários em logs.

## Referências oficiais

- [Adicionar Firebase a um app Web](https://firebase.google.com/docs/web/setup)
- [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart)
- [Cloud Functions](https://firebase.google.com/docs/functions/get-started)
- [App Check para Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Sites padrão do Hosting após 15/10/2026](https://firebase.google.com/docs/hosting/default-site)
