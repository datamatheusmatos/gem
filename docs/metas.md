# Metas — Fase 5

## Rotas (`/api/goals/*`)

| Rota | O que faz |
|---|---|
| `GET /` | Lista metas ativas, cada uma já com `plan` calculado (quanto guardar por mês/semana/dia, previsão, atraso). |
| `POST /` | Cria meta financeira (`targetAmount`+`deadline`) ou meta geral (`metric`+`progressCurrent`/`progressTarget`). |
| `PATCH /:id` | Atualiza qualquer campo, incluindo registrar conclusão (`status: 'concluida'`). |
| `GET /:id/contributions` | Histórico de aportes da meta. |
| `POST /:id/contributions` | Registra um aporte — atualiza `current_amount_cents` da meta na mesma operação e marca `concluida` automaticamente se atingir o alvo. |

## `calculateGoalPlan` (seção 15)

Função pura em `src/engine/goalsCalc.js`, testada isoladamente antes de ligar ao
banco. Para uma meta com valor-alvo e prazo, calcula:

- quanto falta guardar por mês, semana e dia para bater o prazo;
- quantos meses faltam no ritmo atual de contribuição (`forecast_months`);
- se está atrasada (`forecast_months > months_left`);
- quanto precisaria aumentar a contribuição mensal para recolocar a meta no prazo.

Validei com o cenário-exemplo da especificação: meta de R$6.000, R$1.200
já guardados, prazo em 6 meses, contribuindo R$500/mês → o sistema calcula que
precisaria de R$800/mês, detecta atraso (levaria 10 meses no ritmo atual) e
recomenda aumentar a contribuição em R$300/mês — a mesma mensagem-modelo da
seção 15 ("aumentar sua contribuição mensal em R$X").

## Metas gerais (seção 50)

Metas sem valor financeiro usam `metric` + `progressCurrent`/`progressTarget`
em vez de `targetAmount`/`deadline` — o `calculateGoalPlan` retorna
`{ applicable: false }` para essas, e a UI deve mostrar só a barra de progresso
simples, sem o bloco de "quanto guardar por mês".

## Em aberto para fases seguintes

- Recalcular prioridade dinâmica das metas conforme o prazo se aproxima
  (seção 56) — isso entra no `DecisionEngine`, Fase 9, já que envolve também
  tarefas e projetos, não só metas.
- Onboarding perguntando metas na criação da conta (seção 58) — ainda não
  implementado; hoje a meta só é criada manualmente pela rota acima.
