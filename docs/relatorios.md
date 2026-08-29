# Relatórios e revisões — Fase 10

## Escopo desta fase

O plano original (seção 77) previa só "Relatórios" na Fase 10, mas as revisões
semanal e mensal (seções 48 e 49) são, na prática, o mesmo tipo de agregação
com um filtro de período e uma comparação — por isso entraram juntas aqui, em
vez de virarem uma Fase 10.5 não planejada. Registrando essa decisão para
ficar claro por que o escopo original foi levemente expandido.

## Rotas (`/api/reports/*`)

| Rota | O que faz |
|---|---|
| `GET /financial?start=&end=` | Receita, despesa, saldo líquido, patrimônio, despesas por categoria — período livre (dia/semana/mês/trimestre/ano/personalizado, seção 29). |
| `GET /time?start=&end=` | Tempo por categoria (em horas), estatísticas de foco, horas de estudo, cumprimento de hábitos, progresso de projetos. |
| `GET /weekly-review?date=YYYY-MM-DD` | Semana (segunda a domingo) contendo a data, comparada com a semana anterior — variação percentual de receita/despesa incluída. |
| `GET /monthly-review?month=YYYY-MM` | Fechamento do mês, comparado com o mês anterior — inclui patrimônio, taxa de poupança e status de orçamento. |

## Comparação entre períodos (seções 29 e 49)

`percentChange(current, previous)` retorna a variação percentual, e trata o
caso de base zero explicitamente (retorna `null` em vez de `Infinity` ou uma
divisão inválida) — isso evita a UI mostrar um número sem sentido tipo
"+∞%" quando não havia gasto no período anterior.

`weekRange`/`previousWeekRange` calculam a semana como segunda a domingo.
Testei com uma sexta-feira (28/08/2026) e a semana anterior corretamente
começou em 17/08 — inclusive a lógica de `previousMonth` foi testada na
virada de ano (janeiro → dezembro do ano anterior).

## O que ficou de fora desta fase

- **Comparação com "média histórica"** (seção 49: "mês atual × mês anterior ×
  média histórica") — implementei só a comparação com o mês/semana anterior.
  Média histórica exigiria decidir uma janela (últimos 6 meses? 12?) e isso é
  uma decisão de produto, não só técnica — prefiro perguntar antes de
  implementar um número que pareça arbitrário.
- **Exportação (CSV/JSON) e backup completo** (seções 36 e 37) não são
  relatórios de leitura — ficam para uma fase própria de
  "importação/exportação e backup", que não estava explicitamente numerada no
  seu plano original de 14 fases. Seguimos direto para PWA/deploy/testes
  conforme seu plano, mas sinalizo que essa funcionalidade da especificação
  ainda não tem rota implementada.
