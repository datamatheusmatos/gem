# Motor financeiro e projeções — Fase 4

## Rotas (`/api/engine/*`)

| Rota | O que calcula |
|---|---|
| `GET /spending-limit?month=YYYY-MM` | Disponível para gastar no mês, com `breakdown` explicando cada dedução. |
| `GET /limit-tiers?month=YYYY-MM` | Três níveis (seção 10): `safe`, `comfortable`, `max`. **`max` nunca deve ser exibido como recomendação principal na UI** — só como referência de "até onde dá para ir". |
| `POST /simulate-purchase` | "Posso comprar?" (seção 11) — recebe valor/parcelas, devolve veredito (`segura`/`atencao`/`nao_recomendada`) e impacto. |
| `GET /cash-flow-projection?months=N` | Projeção de fluxo de caixa/patrimônio para N meses, marcada como estimativa. |
| `GET /net-worth` | Patrimônio líquido = contas + investimentos − dívidas. |
| `GET /savings-rate?month=YYYY-MM` | Taxa de poupança do mês. |
| `POST /simulate-debt-payoff` | "E se eu antecipar R$X?" (seção 12) — estimativa simplificada. |

## Premissa de design importante: onde entram os "investimentos programados"

A seção 10 lista "investimentos programados" como uma dedução própria na fórmula
do limite de gastos. No nosso schema, **um aporte mensal recorrente de
investimento é lançado como uma transação do tipo `despesa` na categoria
"Investimentos"** (categoria padrão já semeada no onboarding), com
`recurrence = 'mensal'`. Isso significa que `sumExpensesInRange()` já inclui
esse valor automaticamente — não existe uma dedução separada de "investimento"
no código do `FinancialEngine`.

Validei essa premissa reproduzindo o exemplo exato da seção 2 da especificação
(renda R$3.000, despesas fixas R$1.000, financiamento R$500, investimento R$300,
meta R$200, variável R$150 já gasto): o resultado bate com os R$850 de margem
citados no documento quando o investimento é tratado como despesa categorizada,
e não bate (dá R$1.150) se for ignorado. Isso está registrado como teste manual
nesta fase — recomendo que o onboarding (Fase 5) deixe claro para você, ao
cadastrar um investimento recorrente, que ele deve ser lançado dessa forma.

## Camadas de dedução do limite de gastos, na ordem do `breakdown`

1. Renda prevista (soma de transações tipo `receita` no mês).
2. Despesas do mês — fixas, variáveis e investimentos categorizados (soma única).
3. Parcelas de financiamentos/dívidas ativas (uma por dívida, por mês).
4. Contribuições para metas ativas (`goals.monthly_contribution_cents`).
5. Margem de segurança (`user_settings.safety_margin_cents`).

## Limitações conhecidas (documentadas para não virar "cálculo escondido")

- `projectCashFlow` usa recorrências mensais já cadastradas como base — não
  tenta prever inflação/reajuste automaticamente ainda (a especificação pede
  "inflação configurável" na seção 16; ficou de fora desta fase, sinalizo aqui
  para não esquecer).
- `simulateDebtPayoff` é uma estimativa simplificada (reduz o saldo devedor
  linearmente), não uma tabela de amortização Price/SAC completa. Está marcado
  como `isEstimate: true` em toda resposta, conforme a regra da seção 53 de
  nunca apresentar simulação como garantia.
- `debtsDueInPeriod` hoje assume que toda dívida ativa gera uma parcela por mês
  corrente — não verifica ainda se o `due_day` da dívida já passou ou não
  dentro do mês de referência.
