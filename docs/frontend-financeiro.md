# Módulo Financeiro — Frontend completo

## O que mudou na arquitetura do frontend

O `index.html` deixou de ser uma página única e virou uma casca de navegação
(sidebar no desktop, navegação inferior no mobile — seção 3 da especificação),
com um roteador simples baseado em hash (`public/app/router.js`). Cada tela
vira um módulo JS próprio, seguindo a estrutura de pastas que já estava
prevista desde a Fase 1 (`public/app/dashboard/`, `public/app/finance/`).

**Importante para o deploy:** os arquivos de frontend agora vivem em
`public/`, servidos pelo Worker a partir da raiz do projeto — por isso as
referências no `index.html` usam `/public/styles/main.css` e
`/public/app/main.js` (o caminho na URL espelha o caminho em disco). Testado
localmente: todos os arquivos são servidos com o `content-type` correto, e
`/src` (código do backend) continua bloqueado do acesso público.

## Telas do Módulo Financeiro (`#financeiro`, com sub-abas)

| Aba | Arquivo | Funcionalidade |
|---|---|---|
| Contas | `finance/accounts.js` | CRUD completo + transferência entre contas |
| Cartões | `finance/cards.js` | CRUD + barra de limite comprometido |
| Transações | `finance/transactions.js` | Lista filtrável por mês, criação com parcelamento, exclusão |
| Orçamento | `finance/budgets.js` | Planejado x realizado, com aviso de "sem limite definido" (bug 8 corrigido) |
| Dívidas | `finance/debts.js` | CRUD + registro de pagamento (reduz saldo devedor de verdade) |
| Investimentos | `finance/investments.js` | CRUD + aporte/resgate (atualiza valor e quantidade) |
| Simulador | `finance/simulator.js` | "Posso comprar?" com veredito e impacto |

## Backend que faltava e foi completado nesta etapa

`src/db/debts.js` e `src/db/investments.js` já existiam (bem escritos, com o
mesmo padrão de consistência dos demais módulos), mas **nunca tinham sido
ligados a rotas HTTP** — não apareciam em `api/finance.js`. Adicionei as
rotas `/api/finance/debts` (+ `/payments`) e `/api/finance/investments` (+
`/movements`), com as mesmas validações (enum, faixa, tamanho de texto)
corrigidas na rodada de bugs anterior.

## Testes realizados antes de considerar pronto

- **Sintaxe**: todos os arquivos `.js` do backend e do frontend passaram por
  `node --check`.
- **Arquivos estáticos**: confirmei via `curl` que `/`, `/public/styles/main.css`,
  `/public/app/main.js` e todos os módulos de tela são servidos com HTTP 200
  e `content-type` correto; `/src/...` continua retornando 404.
- **Fluxo completo ponta a ponta**: simulei a sequência real de uso — criar
  conta → criar cartão → lançar despesa parcelada → definir orçamento →
  cadastrar dívida → cadastrar investimento e aportar → simular compra →
  voltar ao Dashboard. Cada etapa retornou o status esperado, e o Dashboard
  final refletiu corretamente a soma de despesas (parcela do notebook) e a
  parcela do financiamento no cálculo do limite de gastos — confirma que os
  dados de uma tela aparecem corretamente nas telas que dependem deles.
- **Validações nas rotas novas**: repeti os padrões de validação (campo
  obrigatório, enum, faixa numérica) contra `/debts` e `/investments` e
  todos retornaram 400 com mensagem clara, nenhum 500.
- **Suíte automatizada**: os 29 testes unitários continuam passando.

## O que ainda não está nesta entrega

- Edição/arquivamento de dívidas e investimentos (só criação, pagamento/movimento
  e listagem têm tela; `updateDebt`/`updateInvestment` existem no backend mas
  não têm botão de editar na interface ainda).
- Histórico de pagamentos/movimentos não tem tela própria (a API existe —
  `GET /debts/:id/payments`, `GET /investments/:id/movements` — só falta o
  componente de visualização).
- Calendário financeiro (seção 17) e planejamento futuro/projeção visual
  (seção 16) ainda não têm tela — a API de projeção (`/api/engine/cash-flow-projection`)
  já existe desde a Fase 4.
- Os outros módulos da especificação (Metas, Meu Dia, Estudos/Projetos/Hábitos,
  Assistente, Relatórios, Configurações) continuam só com o backend pronto,
  sem tela — o Dashboard já busca dados deles, mas não há uma área dedicada
  para gerenciá-los ainda.
