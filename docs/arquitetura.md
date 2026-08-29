# Arquitetura — Fase 1

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Hospedagem/deploy | Cloudflare Workers (unificado com Pages), via GitHub | Segue `manual-deploy-cloudflare.md`: deploy automático a cada commit, grátis. |
| Banco relacional | Cloudflare D1 (SQLite gerenciado) | O app tem dezenas de entidades relacionadas (transações, cartões, parcelas, metas...). KV puro exigiria reimplementar joins/índices manualmente. D1 é gratuito no volume de um usuário único (5M leituras/dia, 100k escritas/dia, 5GB — free tier permanente, sem cartão de crédito, verificado em agosto/2026). |
| Sessão/preferências | Cloudflare KV | Mantido conforme o manual original para o que ele faz bem: chave-valor simples (token de sessão, flags). |
| Frontend | HTML/JS servido como assets estáticos pelo próprio Worker (`ASSETS` binding) | Sem build step obrigatório, alinhado ao `wrangler.jsonc` do manual. |
| PWA | manifest.json + sw.js + ícones | Segue `manual-pwa-celular.md` à risca, incluindo a exclusão de `/api/*` do cache do Service Worker. |

## Camadas de código

- `src/api/*` — rotas HTTP finas: autenticam, validam entrada, chamam o engine, devolvem JSON. Nenhuma fórmula financeira aqui.
- `src/engine/FinancialEngine.js` — única fonte de cálculo financeiro (limite de gastos, projeções, parcelas, patrimônio, amortização). Cada método retorna também o `breakdown` usado para a tela "como esse valor foi calculado?" (seção 45 da especificação).
- `src/engine/DecisionEngine.js` — consome saídas do FinancialEngine + dados de tempo/foco/energia/estudos e gera insights, alertas, prioridades e conflitos. Nunca recalcula números financeiros por conta própria.
- `src/db/*` — acesso ao D1 (queries), isolado das rotas.
- `src/auth/*` — sessão e proteção de rotas.
- `src/shared/*` — validação, sanitização, helpers de resposta HTTP.

## Regras que vêm dos manuais anexados (não negociáveis)

1. Projeto Cloudflare no fluxo "Workers" (não "Pages" clássico) → `_worker.js` na raiz + `wrangler.jsonc` explícito. Sem pasta `functions/`.
2. `.assetsignore` contendo `_worker.js` (e, por segurança, `migrations`/`docs`) para não publicar código/schema como conteúdo público.
3. Cloudflare Access na frente do app, com provider "One-time PIN" e política do tipo "Emails" (não "Email domain") — configuração de infraestrutura, fora do código do repositório.
4. Service Worker precisa excluir `/api/*` do cache — já implementado em `sw.js`.
5. `CACHE_NAME` deve ser incrementado a cada release que mude o "casco" do app.

## Regras de dados (seções 72, 73, 43 da especificação)

- Toda transação carrega `value_kind` (`real`/`previsto`/`estimado`/`simulado`) — nunca misturados.
- Simulações do "Modo E se?" nunca gravam nas tabelas reais; rodam em memória a partir de uma cópia dos dados.
- Todo cálculo que gera uma recomendação grava (ou reconstrói) um `breakdown` explicável — a UI nunca mostra um número sem conseguir explicar sua composição.

## Próximas fases

- Fase 2: autenticação real (registro, login, hashing, expiração de sessão no KV).
- Fase 3: módulo financeiro completo (rotas de contas, cartões, transações, orçamento).
- Fase 4: implementação real do `FinancialEngine` com testes de cenários extremos (seção 65).
