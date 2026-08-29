# Assistente, insights e recomendações — Fase 9

## Rotas (`/api/insights/*`)

| Rota | O que faz |
|---|---|
| `POST /generate` | Roda `DecisionEngine.generateInsights` + `generateAlerts`, persiste tudo e devolve o resultado. Pensado para rodar uma vez por dia (ex.: quando o usuário abre o app pela primeira vez no dia) ou sob demanda. |
| `GET /recent` | Últimos 20 insights já gerados, com o `data` reconstituído (base para "como foi calculado?"). |
| `GET /notifications` | Notificações não lidas. |
| `PATCH /notifications/:id` | Marca como lida. |
| `GET /priorities` | Ranking combinado de prioridade dinâmica (hoje: metas; tarefas já têm seu próprio endpoint em `/api/time/tasks`). |
| `GET /conflicts` | Conflitos de alto nível (hoje: orçamento insuficiente frente aos compromissos do mês). |

## Por que é 100% determinístico, sem IA paga

Conforme decidido com você na Fase 4: o `DecisionEngine` não chama nenhuma API
de linguagem. Toda mensagem é gerada por comparação de números já calculados
(orçamento, metas, ritmo de estudo, hábitos, foco) contra limiares fixos, e
formatada em texto com template literal. Isso mantém o app 100% gratuito e
também torna cada mensagem **auditável**: o campo `data` salvo junto de cada
insight é exatamente o número que gerou a frase — nada é "inventado" por um
modelo de linguagem.

## Mapeamento das mensagens-modelo da seção 27 já implementadas

| Modelo da especificação | Implementado como |
|---|---|
| "Seu orçamento de lazer está próximo do limite." | Insight de orçamento ≥ 80% usado. |
| "Uma parcela de RX terminará no próximo mês... margem aumentará ~RX." | Insight de dívida com `installments_paid == installments_total - 1`. |
| "Para atingir sua meta X no prazo, aumente sua contribuição em RX." | Insight de meta atrasada (`goalsCalc.calculateGoalPlan`) — testado e bate exatamente com o exemplo da seção 15/27. |
| "Você está X% abaixo do ritmo necessário para concluir o curso." | Insight de estudo (`studyCalc.calculateStudyPace`). |
| "Seu melhor desempenho ocorre em sessões entre X e Y minutos." | Insight de foco (`focusCalc.analyzeDurationVsProductivity`), só quando há dados suficientes. |

## O que ficou fora do escopo desta fase (documentado, não escondido)

- **Reserva de emergência (seção 14)** não tem uma entidade própria no banco —
  hoje ela precisaria ser modelada como uma meta (`goals`) de categoria
  "reserva". Não implementei um alerta dedicado de "baixa reserva" porque isso
  exigiria decidir essa convenção antes; sinalizo para a próxima revisão.
- **Alertas de conta a vencer / fatura elevada** (seção 28) ainda não têm rota
  própria — dependem de checar `transactions`/`installments` com `due_date`
  nos próximos N dias. Ficou de fora para não inflar mais esta fase; é uma
  extensão direta de `generateAlerts` quando você quiser priorizar isso.
- **Conflitos de agenda/tempo** já existem desde a Fase 6
  (`detectAppointmentConflicts`, `calculateDailyPlan.is_over_committed`) — o
  `detectConflicts` desta fase soma só o conflito de nível financeiro, para
  não duplicar lógica.
