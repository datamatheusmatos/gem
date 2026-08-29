# Módulo financeiro — Fase 3

## Rotas implementadas (todas sob `/api/finance/*`, autenticadas via Access)

| Rota | Métodos | O que faz |
|---|---|---|
| `/accounts` | GET, POST, PATCH `/accounts/:id`, DELETE `/accounts/:id` | CRUD de contas bancárias. DELETE arquiva (não apaga histórico). |
| `/transfers` | POST | Transferência entre contas — ajusta os dois saldos, **não** gera transação (seção 8). |
| `/cards` | GET, POST, PATCH `/cards/:id`, DELETE `/cards/:id` | CRUD de cartões. GET já retorna `committed` (limite comprometido = soma das parcelas futuras não pagas). |
| `/categories` | GET, POST, DELETE `/categories/:id` | CRUD de categorias. Categorias padrão (seção 6) são semeadas automaticamente no primeiro acesso de cada usuário. |
| `/transactions` | GET `?month=YYYY-MM`, POST, PATCH `/transactions/:id`, DELETE `/transactions/:id` | Ver detalhe abaixo. |
| `/budgets` | GET `?period=YYYY-MM`, POST | Orçamento por categoria com planejado × realizado × percentual utilizado. |

## Parcelamento (seção 7)

Uma transação com `installmentsTotal > 1` grava uma linha "pai" em `transactions`
(valor total, `is_installment = 1`) e gera automaticamente N linhas em `installments`,
uma por mês futuro, usando `addMonths()` para preservar o dia de vencimento
(com fallback para o último dia do mês quando o dia original não existe — ex.:
31/01 + 1 mês = 28/02).

O valor é dividido com `Math.floor(total / N)` em cada parcela e a diferença de
arredondamento é somada à última parcela, garantindo que a soma das parcelas seja
sempre idêntica ao valor total da compra (testado com R$1.200/12x e R$1.000/3x —
ver histórico de execução desta fase).

`GET /transactions?month=` combina, numa única lista ordenada por data, as
transações avulsas do mês **e** as parcelas de compras parceladas que caem
naquele mês — o frontend não precisa saber a diferença entre os dois casos.

## Orçamento

`budgetStatusForPeriod` soma, por categoria, tanto despesas avulsas quanto
parcelas que caem no período, e devolve `percent_used` já calculado — a tela
de orçamento só exibe o número, não recalcula nada.

## O que ainda não está aqui (fases seguintes)

- Cálculo do limite de gastos recomendado (diário/semanal/mensal) — isso é
  `FinancialEngine`, Fase 4. Este módulo só guarda e consulta dados brutos.
- Onboarding com criação assistida de contas/cartões/categorias — Fase 2 tardia
  ou Fase 5, a definir.
