# Correções aplicadas — pós bateria de testes

Este documento fecha o ciclo do relatório de bugs: cada item foi corrigido,
testado de novo com os mesmos passos que o reproduziram, e revalidado contra
o fluxo normal (para garantir que a correção não quebrou nada que já
funcionava).

## Resumo por bug

| # | Bug | Correção | Reteste |
|---|---|---|---|
| 1 | Insights/alertas duplicavam a cada `generate` | Deduplicação por `domain`+mensagem (ou `category`+mensagem) dentro do mesmo dia, em `db/insights.js` e `db/notifications.js` | 3 chamadas seguidas → 1 insight salvo (era 3) |
| 2 | Período malformado quebrava o servidor (500) em 3 endpoints | `validateMonthFormat()` novo em `shared/validation.js`, aplicado em `api/engine.js` (3 rotas), `api/reports.js`, `api/finance.js` | Todas as variações testadas agora retornam 400 com mensagem clara |
| 3 | Orçamento com período malformado era aceito na criação | Mesma validação aplicada também no POST de `/api/finance/budgets` | Criação agora rejeita com 400 antes de salvar |
| 4 | Enum/faixa (tipo de conta, dia de cartão, importância de tarefa) só validado pelo `CHECK` do SQLite → 500 genérico | `validateEnum()` e `validateRange()` novos, aplicados em contas, cartões (POST e PATCH) e tarefas (POST e PATCH) | Os 3 casos testados agora retornam 400 com a lista de valores aceitos |
| 5 | Editar conta/cartão arquivado(a) funcionava silenciosamente | `updateAccount`/`updateCard` agora filtram `archived = 0` na busca | Editar após excluir agora retorna 404 |
| 6 | Meta aceitava valor-alvo negativo | Checagem `targetAmountCents <= 0` no POST e no PATCH de metas | Retorna 400 "valor-alvo precisa ser maior que zero" |
| 7 | Duplo clique no registro rápido criava despesa 2x | Botão de submit é desabilitado (`disabled=true`) durante a requisição, reabilitado no `finally`, em `index.html` | Correção de frontend — não testável via curl, mas a causa raiz (ausência de trava) foi eliminada no código |
| 8 | Orçamento com `planned=0` e gasto real mostrava "0% usado" | `percent_used` agora retorna `null` + `no_limit_defined: true` nesse caso, propagado em `api/finance.js` e `api/reports.js` | Confirmado: resposta agora traz `percent_used: null, no_limit_defined: true` em vez de `0` |
| 9 | Textos longos eram truncados sem aviso | `validateMaxLength()` novo, aplicado antes de qualquer `sanitizeText` em conta, transação (descrição/notas), meta (nome) e tarefa (título) | Nome de 300 caracteres agora retorna 400 em vez de salvar cortado |
| 10 | `effortMinutes`/`durationMinutes` negativos aceitos | `validatePositive()` novo, aplicado em tarefas (POST/PATCH) e sessões de foco (POST) | Ambos agora retornam 400 |
| 11 | Mensagem confusa ao registrar sessão de estudo com `minutes: 0` | Checagem explícita `<= 0` com mensagem própria, separada da checagem de data | Mensagem agora é "A duração precisa ser maior que zero." |

## O que foi verificado além do que o relatório pedia

- **Reteste de regressão do caminho feliz**: recriei o fluxo completo (cartão
  → tarefa → meta → orçamento → transação parcelada → sessão de foco →
  Dashboard) com dados válidos, do zero, depois de todas as correções. Tudo
  funcionou sem erro, incluindo o Dashboard consumindo os dados recém-criados
  corretamente.
- **Suíte de testes unitários (Fase 13)**: os 29 testes automatizados
  continuam passando sem alteração — as correções desta rodada foram todas em
  camadas de validação de entrada (rotas HTTP), não nas funções de cálculo
  puro que os testes cobrem, então não havia expectativa de quebra ali, mas
  confirmei mesmo assim.
- **Sintaxe**: todos os arquivos `.js` do projeto passaram por `node --check`
  sem erro depois das edições.

## Uma correção que ainda não é 100% abrangente (para não fingir cobertura total)

O Bug 4 (validação de enum/faixa ausente) foi corrigido nos 3 campos que o
relatório testou explicitamente (`accounts.type`, `cards.closingDay`/`dueDay`,
`tasks.importance`/`urgency`). O schema tem outras colunas com `CHECK
constraint` que não testei individualmente (ex.: `cards.brand`,
`debts.amortization_system`, `investments.category`, `transactions.status`) —
é provável que o mesmo padrão de bug exista ali, já que a causa raiz era
estrutural (delegar validação inteiramente ao banco). Recomendo uma varredura
dedicada por essas colunas antes de considerar essa classe de bug
definitivamente eliminada em todo o app.
