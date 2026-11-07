# Passo a passo — trocar o modo Spark pelo Blaze

Projeto: `classea-97dd2` · Região: `southamerica-east1` · Tempo estimado: 1 a 2 horas, com testes.

## Por que a ordem importa

No Spark, o **navegador** faz o papel do servidor: lê os papéis em `roles/{uid}` e escreve agendamentos e pagamentos, com regras frouxas. No Blaze, as **Cloud Functions** fazem isso, os papéis vêm da **conta do Firebase Auth** (custom claims) e as regras fecham tudo.

A ordem abaixo mantém o site funcionando o tempo todo:

1. Functions no ar → 2. site troca de modo → 3. testes → 4. regras restritas por último.

Até o passo 6, dá para voltar atrás só trocando a variável `VITE_SPARK` de volta.

---

## 0. Antes de começar

- [ ] Plano **Blaze** ativo e **alerta de orçamento** configurado (Google Cloud Console → Faturamento → Orçamentos e alertas → R$ 20/mês).
- [ ] Todo o código enviado ao GitHub (`git push`).
- [ ] Uma **chave de conta de serviço nova**, salva fora do projeto (Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada). **Não use a chave que foi colada no chat; revogue-a.**
- [ ] Firebase CLI: use **`npx firebase`** (a do projeto). O `firebase` global não está no PATH desta máquina. Login: `npx firebase login`.
- [ ] Opcional: backup do Firestore (Firebase Console → Firestore → Importar/exportar).

Em todos os comandos abaixo, use o **PowerShell na pasta do projeto**.

## 1. Ativar o Storage

Firebase Console → **Storage** → Começar → local `southamerica-east1`. No Blaze, as fotos de perfil vão para o Storage, e não mais para dentro do Firestore. As fotos antigas continuam aparecendo.

## 2. Migrar os papéis para a conta (claims)

Primeiro em modo de teste, que só mostra o que vai mudar:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\real\da\chave-nova.json"
$env:PRODUCTION_PROJECT_ID="classea-97dd2"
npm run migrate:claims
```

Confira a lista (barbeiros, recepção, clientes). Depois aplique:

```powershell
$env:MIGRATE_CONFIRM="classea-97dd2"
npm run migrate:claims
```

Isso não muda nada no site atual: o Spark continua lendo `roles/{uid}`. Pode rodar de novo sem problema.

## 3. Publicar as Cloud Functions

```powershell
npm run functions:build
npx firebase deploy --only functions --project classea-97dd2
```

- Na primeira vez, o Firebase pede para ativar APIs (Cloud Build, Artifact Registry, Cloud Run, Eventarc, Cloud Scheduler). Aceite.
- Se aparecer `Timeout after 10000` / "Cannot determine backend specification" (a máquina está lenta carregando o código), rode antes `$env:FUNCTIONS_DISCOVERY_TIMEOUT="120"` e repita.
- Os pagamentos continuam **simulados**: sem `PAYMENTS_PROVIDER` e `ONLINE_PAYMENTS`, nada de Mercado Pago nem de InfinitePay é ligado.

## 4. Publicar índices e regras do Storage

```powershell
npx firebase deploy --only firestore:indexes,storage --project classea-97dd2
```

Os índices levam alguns minutos para ficar prontos (Firebase Console → Firestore → Índices → todos "Ativado").

## 5. Trocar o site para o modo Blaze

**Vercel:** Settings → Environment Variables → `VITE_SPARK` = `false` (Production e Preview) → Deployments → **Redeploy**.

**Render:** o `render.yaml` fixa `VITE_SPARK: 'true'`. Troque para `'false'` no arquivo (eu faço o commit quando for a hora) e, no painel da Render, Environment → `VITE_SPARK=false` → Manual Deploy.

Precisa ser `false` explícito: sem a variável, o app detecta o projeto `classea-97dd2` e liga o Spark sozinho.

## 6. Testar (com as regras do Spark ainda valendo)

Todo mundo **sai e entra de novo** (para o login carregar os papéis novos). Teste em celular e computador:

- [ ] Cliente: cadastro novo, login, agendar (pagar na barbearia), cancelar, "Meus agendamentos".
- [ ] Barbeiro: agenda do dia, bloquear e liberar horário, dar baixa, "Não concluído", Comissão.
- [ ] Recepção: entrar, ver a agenda de todos, dar baixa.
- [ ] Igor: painel do dono, Rotina, Clientes, Financeiro, Pagamentos, criar acesso da recepção.
- [ ] Foto de perfil (vai para o Storage).

Se algo falhar: volte `VITE_SPARK=true` + Redeploy (o site volta ao Spark como estava) e me mande o erro.

## 7. Publicar as regras de produção (o passo que fecha a segurança)

```powershell
npx firebase deploy --only firestore:rules --project classea-97dd2
```

Usa o `firestore.rules` (o de produção). A partir daqui, o navegador não grava mais agendamentos, pagamentos, comissões nem papéis: só as Functions gravam.

## 8. Testar de novo

Repita a lista do passo 6. Atenção especial a: barbeiro **não** ver comissão de outro barbeiro, recepção **não** abrir Financeiro, cliente agendando e cancelando.

**Voltar atrás depois do passo 7:** `npx firebase deploy --config firebase.spark.json --only firestore:rules --project classea-97dd2` + `VITE_SPARK=true` + Redeploy.

---

## Depois da troca (quando quiser ligar os pagamentos reais)

- **Mercado Pago (planos recorrentes):** ver "Como ligar no sandbox" em [PLANO-MERCADO-PAGO.md](PLANO-MERCADO-PAGO.md).
- **InfinitePay (PIX e cartão avulsos):** ver "O que é preciso da InfinitePay" em [PLANO-FINANCEIRO-INFINITEPAY.md](PLANO-FINANCEIRO-INFINITEPAY.md).
- **App Check:** com o site estável, configure o reCAPTCHA Enterprise e só depois ligue `ENFORCE_APP_CHECK=true` (ver [DEPLOY-PREVIEWS.md](DEPLOY-PREVIEWS.md)).
