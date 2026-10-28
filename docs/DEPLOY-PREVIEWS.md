# Deploy de testes na Vercel e Render

Os dois serviços hospedam o front React/Vite. Authentication e Firestore usam o projeto Firebase `classea-97dd2`. Para testes no plano Spark, as operações que normalmente dependeriam de Functions rodam no navegador e as fotos de perfil são reduzidas e salvas no Firestore.

## Variáveis do build

Cadastre as variáveis abaixo nos dois provedores. Copie os valores do objeto `firebaseConfig` em **Firebase Console > Configurações do projeto > Geral > Seus aplicativos > Classe A Barbearia Web**.

| Variável                            | Origem              |
| ----------------------------------- | ------------------- |
| `VITE_FIREBASE_API_KEY`             | `apiKey`            |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `authDomain`        |
| `VITE_FIREBASE_PROJECT_ID`          | `projectId`         |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `storageBucket`     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID`              | `appId`             |
| `VITE_FIREBASE_MEASUREMENT_ID`      | `measurementId`     |
| `VITE_USE_EMULATORS`                | `false`             |
| `VITE_SPARK`                        | `true`              |

Não cadastre `databaseURL`: o app usa Cloud Firestore. Não envie `FIREBASE_SERVICE_ACCOUNT` para a Vercel ou Render: o front não usa credenciais administrativas.

Durante os primeiros testes, deixe `VITE_RECAPTCHA_ENTERPRISE_KEY` e `VITE_SITE_URL` ausentes. Sem `VITE_SITE_URL`, o app usa automaticamente o domínio atual. Configure App Check somente depois de registrar os dois domínios de preview.

## Vercel

1. Entre em [vercel.com](https://vercel.com) usando a conta do GitHub que acessa `DEVMarlosGomes/ClasseA`.
2. Clique em **Add New > Project** e importe `DEVMarlosGomes/ClasseA`.
3. Confirme **Framework Preset: Vite**, **Root Directory: `./`**, **Build Command: `npm run build`** e **Output Directory: `dist`**.
4. Em **Environment Variables**, adicione todas as variáveis da tabela para os ambientes Preview e Production.
5. Clique em **Deploy**. O arquivo `vercel.json` já contém o fallback de SPA e os cabeçalhos básicos.
6. Copie o domínio terminado em `.vercel.app` e conclua a autorização no Firebase descrita abaixo.

## Render

1. Entre em [dashboard.render.com](https://dashboard.render.com) usando o GitHub.
2. Clique em **New > Blueprint** e conecte `DEVMarlosGomes/ClasseA`.
3. A Render detectará `render.yaml` e pedirá os valores marcados com `sync: false`.
4. Preencha as variáveis da tabela e aplique o Blueprint.
5. Espere o build terminar e copie o domínio terminado em `.onrender.com`.

Se preferir criar manualmente, escolha **New > Static Site**, use `npm ci && npm run build` como Build Command e `dist` como Publish Directory. Em **Redirects/Rewrites**, crie uma regra Rewrite de `/*` para `/index.html`.

## Autorizar os domínios no Firebase

Depois que os dois endereços existirem:

1. Abra **Firebase Console > Authentication > Settings > Authorized domains**.
2. Adicione somente o hostname, sem `https://` e sem barra final, por exemplo `projeto.vercel.app` e `projeto.onrender.com`.
3. Confirme que E-mail/senha e Google estão habilitados em **Authentication > Sign-in method**.
4. Teste cadastro, login, redefinição de senha e login Google nos dois domínios.

Quando configurar App Check, registre os mesmos domínios na chave reCAPTCHA Enterprise, adicione a site key como `VITE_RECAPTCHA_ENTERPRISE_KEY` nos dois provedores e faça novo deploy. Mantenha a imposição desativada até validar as métricas.

## Backend Spark necessário para os testes

Antes de testar agendamento, cancelamento, pagamentos mock e administração:

1. crie o Firestore Native em `southamerica-east1`;
2. habilite Authentication com E-mail/senha e Google;
3. execute `npm run deploy:spark` para publicar as regras de teste, os índices e o Hosting;
4. execute `npm run bootstrap:production` uma vez para criar o primeiro administrador e o catálogo;
5. mantenha `VITE_SPARK=true` na Vercel e na Render e faça um novo deploy.

O modo Spark existe para homologação: sem um backend confiável, um cliente modificado pode falsificar disponibilidade, agendamentos e pagamentos simulados. Antes de atender clientes reais, migre para Blaze, desative `VITE_SPARK` e publique `firestore.rules`, Storage e Functions conforme o README.
