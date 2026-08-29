# Cloudflare / Deploy — Fase 12

## Por que esta fase é um checklist, não uma execução automática

Este ambiente de desenvolvimento não tem acesso à API da Cloudflare (a rede
aqui é restrita a registries de pacote — npm, PyPI, GitHub — não ao painel ou
à API da Cloudflare). Por isso, esta fase entrega tudo que pode ser preparado
sem essa rede — `wrangler.jsonc`, migrações, `package.json` com os comandos
certos — e um checklist para você executar na sua própria máquina/conta,
seguindo exatamente o `manual-deploy-cloudflare.md` que você anexou no início
do projeto.

## Checklist de deploy (siga nesta ordem)

### 1. Repositório
- [ ] Criar repositório no GitHub (pode ser privado).
- [ ] Subir todo o conteúdo desta pasta (`gem/`) na raiz do repositório
      — não dentro de uma subpasta.

### 2. Cloudflare — criar o projeto
- [ ] Criar conta em dashboard.cloudflare.com/sign-up (se ainda não tiver).
- [ ] **Workers & Pages → Create application → Import a repository** →
      conectar ao GitHub → escolher o repositório.
- [ ] Deixar o build command vazio — o `wrangler deploy` cuida de tudo via
      `wrangler.jsonc`.

### 3. Banco de dados (D1)
- [ ] **Storage & Databases → D1 → Create database** → nome `gem-db`
      (mesmo nome do `wrangler.jsonc`).
- [ ] Copiar o **Database ID** gerado e colar em `wrangler.jsonc`, substituindo
      `SUBSTITUIR-PELO-ID-REAL-DO-D1`.
- [ ] Rodar as migrações contra o banco remoto:
      `npm run db:migrate:remote`
      (ou, localmente antes de subir, `npm run db:migrate:local` para testar
      com `wrangler dev --local`).
- [ ] Ir na aba **Bindings** do projeto → confirmar que o binding `DB`
      aparece automaticamente (o `wrangler.jsonc` já declara).

### 4. Cloudflare Access (login por e-mail)
- [ ] Ir na aba **Access** do projeto (não em Settings — ela é uma aba
      própria no fluxo novo "Workers", conforme o manual).
- [ ] Ativar proteção.
- [ ] Em **Zero Trust → Integrations → Identity providers**, confirmar que
      "One-time PIN" está com status "ADDED" (senão, adicionar).
- [ ] Criar a política de acesso com o seletor **"Emails"** (não "Email
      domain") e digitar seu e-mail completo — este é o erro mais comum
      documentado no manual (confundir domínio com e-mail específico).

### 5. Primeiro acesso
- [ ] Abrir a URL do projeto — deve pedir login por e-mail (One-Time PIN).
- [ ] Depois de logar, o `src/auth/access.js` provisiona automaticamente seu
      usuário e as categorias padrão no primeiro request autenticado — não é
      preciso nenhum cadastro manual.
- [ ] Testar o Dashboard: deve carregar (mesmo que com valores zerados, já
      que ainda não há dados).

### 6. Primeiro uso real
- [ ] Cadastrar uma conta bancária (`POST /api/finance/accounts` — ainda sem
      tela própria, pode ser testado via `curl`/Postman contra a URL de
      produção enquanto as demais telas não existem).
- [ ] Lançar uma receita e uma despesa e conferir se o card de limite de
      gastos do Dashboard atualiza.
- [ ] Testar o registro rápido de gasto na tela real do Dashboard.

## Comandos disponíveis (`package.json`)

```
npm run dev                  # ambiente local (wrangler dev)
npm run deploy                # deploy manual (normalmente desnecessário — o Cloudflare já faz deploy automático a cada commit)
npm run db:migrate:local      # aplica as migrações no D1 local (para testar antes de subir)
npm run db:migrate:remote     # aplica as migrações no D1 de produção
npm test                      # roda a suíte de testes automatizados (Fase 13)
```

## Erros já documentados no seu manual original — continuam válidos

Nada mudou na causa raiz desses problemas desde que o manual foi escrito; se
aparecerem, a seção 4 do `manual-deploy-cloudflare.md` já tem o diagnóstico e
o fix exatos:
- `/api/data` (ou qualquer rota) retornando 404 → verificar se não existe uma
  pasta `functions/` sendo usada por engano (não existe neste projeto).
- Build falhando com "entry-point file at _worker.js was not found" →
  garantir que `_worker.js` está na raiz (está).
- "Uploading a Pages _worker.js file as an asset" → conferir `.assetsignore`
  (já atualizado nesta fase para também esconder `src/`, `tests/`,
  `package.json`, `wrangler.jsonc`).
