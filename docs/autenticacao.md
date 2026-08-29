# Autenticação e infraestrutura — Fase 2 (revisada)

## Correção de arquitetura

A primeira versão desta fase implementou um sistema de registro/login/senha próprio
dentro da aplicação. Isso duplicava, sem necessidade, a proteção que o
`manual-deploy-cloudflare.md` já especifica: **Cloudflare Access** na frente de todo
o app, com login por e-mail via One-Time PIN (seção 8 do manual). Como este é um
sistema de uso pessoal — não multiusuário — a camada de senha própria era uma
segunda superfície de autenticação sem propósito, além de contrariar a diretriz de
evitar soluções improvisadas (seção 78 da especificação do produto). Foi removida.

## Como funciona agora

1. O usuário abre o app → Cloudflare Access intercepta a requisição e exige login
   por e-mail (One-Time PIN), conforme já configurado no painel Access.
2. Só depois desse login a requisição chega ao Worker. A Cloudflare injeta o
   cabeçalho `Cf-Access-Authenticated-User-Email` em toda requisição autenticada.
3. `src/auth/access.js` lê esse cabeçalho e busca (ou cria, no primeiro acesso)
   a linha correspondente em `users` + `user_settings`.
4. Todas as rotas de `/api/*` recebem `request.user` já resolvido — nenhuma rota
   lida com login, senha, cookie ou token.

## Por que isso é mais simples e mais seguro

- Uma única superfície de autenticação (a Cloudflare já cuida disso profissionalmente),
  em vez de duas.
- Nenhuma senha, hash, ou sessão para gerenciar, renovar ou vazar dentro da aplicação.
- Defesa em profundidade mantida: se por algum motivo uma requisição chegar sem o
  cabeçalho do Access (configuração incorreta), o Worker ainda recusa com 401 em vez
  de assumir um usuário anônimo.

## O que mudou nos arquivos

- Removidos: `src/auth/password.js`, `src/auth/session.js`, `src/api/auth.js`.
- Novo: `src/auth/access.js` (identidade via Access + auto-provisionamento).
- `migrations/0001_core.sql`: tabela `users` não tem mais `password_hash`.
- `src/api/router.js`: usa `requireAccessUser` em vez de sessão via KV/cookie.
- O binding `SESSIONS_KV` no `wrangler.jsonc` deixou de ser necessário para
  autenticação — pode ser removido ou reaproveitado depois para cache/preferências
  se surgir uma necessidade concreta.
