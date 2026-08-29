# Passo a passo — Publicar o Gem e testar no celular

Este guia assume que você nunca fez nada disso antes. Siga na ordem, sem
pular etapas. Cada passo diz exatamente onde clicar.

---

## Parte 1 — Subir o código para o GitHub

### 1.1 Criar o repositório
1. Acesse [github.com](https://github.com) e faça login (ou crie uma conta, é grátis).
2. Clique no `+` no canto superior direito → **New repository**.
3. Nome: `gem` (ou o que preferir).
4. Marque **Private** (recomendado, já que vai ter seus dados financeiros de exemplo depois).
5. **Não** marque nenhuma das opções de "Initialize this repository with..." (sem README, sem .gitignore — o projeto já tem os seus).
6. Clique em **Create repository**.

### 1.2 Subir os arquivos
Depois de criar, o GitHub mostra uma tela com comandos. Você tem duas opções:

**Opção A — pelo navegador (mais simples, sem instalar nada):**
1. Baixe a pasta do projeto (o pacote que te entreguei) para o seu computador e descompacte.
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Arraste **todos os arquivos e pastas** da pasta do projeto para a área de upload (o GitHub aceita arrastar pastas inteiras no navegador Chrome/Edge).
4. Espere o upload terminar, escreva uma mensagem tipo "Primeira versão" no campo de commit, e clique em **Commit changes**.

**Opção B — pela linha de comando (se você tiver `git` instalado):**
```bash
cd caminho/para/a/pasta/gem
git init
git add .
git commit -m "Primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gem.git
git push -u origin main
```

### 1.3 Confirmar que subiu certo
Recarregue a página do repositório no GitHub. Você deve ver as pastas `src/`,
`public/`, `docs/`, `migrations/`, `tests/`, e os arquivos `index.html`,
`_worker.js`, `wrangler.jsonc`, `package.json`, `README.md` na raiz.

**Importante:** confirme que **não aparece** uma pasta `node_modules` — se
aparecer, é porque o `.gitignore` não foi respeitado no upload; delete essa
pasta pelo próprio GitHub (ela não deveria existir no pacote que te entreguei).

---

## Parte 2 — Criar a conta e os recursos na Cloudflare

### 2.1 Conta
1. Acesse [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) e crie uma conta grátis (não pede cartão de crédito).
2. Confirme seu e-mail se for pedido.

### 2.2 Criar o banco de dados (D1)
1. No painel, menu lateral → **Storage & Databases** → **D1 SQL Database**.
2. Clique em **Create database**.
3. Nome: `gem-db` (tem que ser exatamente esse nome, é o que está configurado no `wrangler.jsonc`).
4. Clique em **Create**.
5. Na página do banco recém-criado, copie o **Database ID** (um código tipo `a1b2c3d4-...`). Guarde esse valor, você vai usar no passo 2.4.

### 2.3 Criar o projeto Worker conectado ao GitHub
1. Menu lateral → **Workers & Pages**.
2. Clique em **Create application** → aba **Import a repository** (ou "Connect to Git", dependendo da versão do painel).
3. Autorize a Cloudflare a acessar sua conta do GitHub, se for pedido.
4. Escolha o repositório `gem` que você criou na Parte 1.
5. Na tela de configuração de build:
   - **Build command**: deixe **vazio**.
   - **Deploy command**: deixe o padrão (o `wrangler.jsonc` já cuida de tudo).
6. Clique em **Save and Deploy**. O primeiro deploy provavelmente vai falhar ou terminar incompleto — é esperado, porque o banco ainda não está conectado. Sem problema, siga para o próximo passo.

### 2.4 Conectar o banco de dados ao projeto
1. Abra o arquivo `wrangler.jsonc` do seu repositório **pelo próprio GitHub** (clique no arquivo, depois no ícone de lápis para editar).
2. Troque `"database_id": "SUBSTITUIR-PELO-ID-REAL-DO-D1"` pelo ID que você copiou no passo 2.2.5.
3. Clique em **Commit changes** (direto na branch `main`).
4. Isso já dispara um novo deploy automático na Cloudflare — espere ~1 minuto.
5. Volte na página do projeto Worker → aba **Bindings** → confirme que aparece `env.DB` apontando para `gem-db`. Se aparecer, o binding foi reconhecido automaticamente pelo `wrangler.jsonc`.

### 2.5 Rodar as migrações do banco (criar as tabelas)
Isso precisa ser feito uma vez, pela linha de comando, porque o painel da
Cloudflare não tem um botão para "rodar SQL direto". Você vai precisar do
Node.js instalado no seu computador ([nodejs.org](https://nodejs.org), baixe a versão LTS).

1. Baixe o repositório para o seu computador (se ainda não tiver a pasta local):
   ```bash
   git clone https://github.com/SEU-USUARIO/gem.git
   cd gem
   ```
2. Instale o wrangler (só nesta pasta, não precisa instalar globalmente):
   ```bash
   npm install --save-dev wrangler
   ```
3. Faça login na sua conta Cloudflare pelo terminal:
   ```bash
   npx wrangler login
   ```
   Isso abre uma janela do navegador pedindo para autorizar — clique em **Allow**.
4. Rode as três migrações contra o banco **remoto** (o de produção):
   ```bash
   npx wrangler d1 execute gem-db --remote --file=./migrations/0001_core.sql
   npx wrangler d1 execute gem-db --remote --file=./migrations/0002_routine_logs.sql
   npx wrangler d1 execute gem-db --remote --file=./migrations/0003_onboarding.sql
   npx wrangler d1 execute gem-db --remote --file=./migrations/0004_workouts.sql
   ```
   Cada comando deve terminar mostrando `"success": true`.

### 2.6 Ativar o Cloudflare Access (login por e-mail)

**Nota (feito em 2026-08-29):** na prática, o caminho mais direto foi pular a
etapa manual do Zero Trust e ativar direto pela página do Worker — a
Cloudflare provisiona o Zero Trust org automaticamente por trás dos panos.
Passos usados de fato:

1. **Workers & Pages** → projeto `gem` → aba **Access** → **Protect this
   worker behind access**.
2. Isso cria automaticamente uma política — em **Access controls** →
   **Policies**, criada a política **"Acesso Particular"**.
3. No critério da regra, seletor **"Emails"** (não "Email domain") com o
   e-mail `dev.matheusmatos@gmail.com`.
4. Verificado via HTTP: a URL do worker responde `302` redirecionando para
   `*.cloudflareaccess.com/cdn-cgi/access/login/...`, confirmando a proteção
   ativa. O One-time PIN já vem habilitado por padrão nesse fluxo — não foi
   necessário configurar manualmente em Settings → Authentication.

Passos originais (alternativa, caso o atalho acima não apareça no seu
painel):

1. No painel, vá em **Zero Trust** (aparece no menu lateral principal, ou em `one.dash.cloudflare.com`).
2. Se for a primeira vez, escolha um nome de equipe (qualquer nome, ex.: `seunome-pdi`) — isso cria sua URL do Zero Trust.
3. Menu lateral → **Settings** → **Authentication** → **Login methods** → **Add new** → escolha **One-time PIN** → **Save**.
4. Volte para **Workers & Pages** → seu projeto `gem` → aba **Access** (é uma aba própria, ao lado de "Settings"/"Bindings" — não fica dentro de Settings).
5. Ative a proteção (**Enable Access** ou similar).
6. Isso cria automaticamente uma política — edite-a: em **Access controls** → **Policies**, abra a política criada.
7. No critério da regra, troque o seletor de **"Email domain"** para **"Emails"** (é o erro mais comum: domínio vs. e-mail específico).
8. Digite seu e-mail completo (ex.: `voce@gmail.com`) no campo.
9. Clique em **Save**.

### 2.7 Testar o primeiro acesso
1. Abra a URL do seu projeto (aparece no topo da página do Worker, algo como `gem.SEU-USUARIO.workers.dev`).
2. Deve aparecer uma tela pedindo seu e-mail (Cloudflare Access).
3. Digite seu e-mail → você recebe um código de 6 dígitos por e-mail → digite o código.
4. Depois de logar, o Dashboard do app deve carregar (com valores zerados, já que ainda não há dados) — se aparecer a tela de **Boas-vindas** (onboarding), é o comportamento esperado no primeiro acesso.

Se alguma coisa der errado aqui, veja a seção "Erros conhecidos" no fim deste documento antes de tentar de novo.

---

## Parte 3 — Testar como PWA no celular

### 3.1 Android (Chrome)
1. Abra a URL do app no Chrome do celular.
2. Faça login normalmente (mesmo processo do passo 2.7).
3. Toque no menu de 3 pontinhos (canto superior direito do Chrome).
4. Toque em **Adicionar à tela inicial** (ou **Instalar aplicativo**, dependendo da versão do Chrome).
5. Confirme. Um ícone do Gem (o diamante) aparece na tela inicial do celular, igual a um app nativo.
6. Abra por esse ícone — deve abrir em tela cheia, **sem** a barra de endereço do navegador aparecendo.

### 3.2 iPhone (Safari — só funciona no Safari, não no Chrome do iPhone)
1. Abra a URL do app no **Safari** (é uma limitação da Apple, não do app — o Chrome do iPhone não tem essa opção).
2. Toque no ícone de Compartilhar (o quadrado com a seta para cima, na barra inferior).
3. Role para baixo e toque em **Adicionar à Tela de Início**.
4. Confirme. O ícone aparece na tela inicial.
5. Abra por esse ícone — mesma experiência de tela cheia.

### 3.3 O que testar no celular depois de instalado
- [ ] O app abre sem barra de navegador visível.
- [ ] A navegação inferior (Dashboard, Meu Dia, Financeiro, etc.) aparece e funciona ao tocar.
- [ ] O registro rápido de despesas (botão "+" flutuante no Dashboard) funciona.
- [ ] Preencher um formulário (ex.: criar uma conta em Financeiro → Contas) e confirmar que aparece na lista.
- [ ] Fechar o app completamente (não só minimizar) e reabrir pelo ícone — os dados devem continuar lá (vêm do banco na nuvem, não do celular).
- [ ] Testar com a internet do celular desligada por um instante — o "casco" do app (menus, telas) deve continuar abrindo mesmo sem internet, mas os dados não carregam (comportamento esperado do Service Worker, que só armazena a estrutura visual, não os dados financeiros).

---

## Erros conhecidos (se algo der errado)

| Sintoma | Causa provável | Fix |
|---|---|---|
| Tela em branco ou erro 500 ao abrir | Migrações não rodaram | Repita o passo 2.5 |
| Não aparece a aba "Access" no projeto | Você está olhando "Settings" em vez da aba própria | A aba "Access" fica ao lado de "Settings"/"Bindings", no topo da página do projeto |
| Código de login nunca chega no e-mail | Provedor "One-time PIN" não foi adicionado, ou a política está com "Email domain" em vez de "Emails" | Revise os passos 2.6.3 e 2.6.7 |
| Build falha mencionando `_worker.js` | Arquivo não está na raiz do repositório | Confirme que `_worker.js` está solto na raiz, não dentro de uma subpasta |
| Erro citando "Uploading a Pages `_worker.js` file as an asset" | `.assetsignore` não foi enviado ou está incompleto | Confirme que o arquivo `.assetsignore` (sem extensão, começa com ponto) subiu para o GitHub — arquivos que começam com ponto às vezes ficam escondidos no explorador de arquivos do computador |

---

## Depois de tudo funcionando

Guarde o link do app (adicione aos favoritos no computador também). A partir
de agora, qualquer alteração de código que subir para o GitHub na branch
`main` gera um novo deploy automático — você não precisa repetir nenhum
passo desta Parte 2, exceto se um dia adicionar uma nova migração de banco
(aí só o passo 2.5 se repete, com o novo arquivo).
