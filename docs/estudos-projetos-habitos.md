# Estudos, projetos, hábitos e rotinas — Fase 8

## Rotas (`/api/growth/*`)

| Rota | O que faz |
|---|---|
| `GET/POST /study` | Cursos/matérias. |
| `POST /study/:id/sessions` | Registra sessão de estudo — atualiza `hours_done` e devolve `pace` já calculado. |
| `GET /study/:id/pace` | Ritmo necessário x ritmo atual (seção 22). |
| `GET/POST /projects` | Projetos. |
| `GET/POST /projects/:id/tasks`, `PATCH /projects/:id/tasks/:taskId` | Tarefas do projeto — marcar concluída **recalcula automaticamente** `progress` do projeto (feitas/total), nunca digitado à mão. |
| `GET/POST /habits`, `POST/GET /habits/:id/logs` | Hábitos com sequência e taxa de cumprimento calculadas no GET dos logs. |
| `GET/POST /routines`, `.../steps`, `.../logs` | Rotinas com etapas e execução diária (planejado x realizado). |

## Ritmo de estudo (seção 22)

`calculateStudyPace` compara o ritmo semanal necessário para terminar no prazo
(`horas restantes ÷ semanas restantes`) com o ritmo real das últimas 4 semanas
de sessões. Testei com um curso de 100h (40h feitas, 6 semanas de prazo — logo
10h/semana necessárias) contra um ritmo real baixo e o `percent_behind`
resultante confirmou o atraso, no espírito da mensagem-modelo "você está X%
abaixo do ritmo necessário".

## Hábitos (seção 25)

- `calculateStreak`: percorre os logs do mais recente para trás e para na
  primeira quebra. Testado com uma sequência que quebra no penúltimo dia — o
  streak correto foi 1 (só o dia mais recente conta, pois o anterior está
  quebrado), não 3.
- `calculateComplianceRate`: expectativa de ocorrências no período conforme a
  frequência (diária/semanal/mensal) x quantas foram de fato marcadas.

## Projetos: progresso nunca "mentiroso"

`toggleProjectTask` recalcula `projects.progress` a partir da contagem real de
tarefas concluídas sempre que uma tarefa muda de status. Isso evita o cenário
proibido pelo checklist final da especificação: "não existem cálculos
financeiros [ou de progresso] escondidos dentro da UI" — o número vem sempre
de uma contagem verificável, nunca de um campo editado manualmente que possa
divergir da lista de tarefas.

## Rotinas: nova tabela `routine_logs` (migração 0002)

O schema original (Fase 1) não previa como registrar a execução de uma rotina
— só a rotina e suas etapas. Para cumprir a seção 26 ("comparar planejado x
realizado"), adicionei `routine_logs` (etapas concluídas/total por dia) numa
migração nova, em vez de editar a 0001 retroativamente — a partir de agora,
toda mudança de schema vai como migração incremental.

## Em aberto para fases seguintes

- O `DecisionEngine` (Fase 9) vai consumir `percent_behind` de estudos,
  `progress` de projetos e `complianceRate` de hábitos para gerar os insights
  de texto da seção 27 — nenhuma dessas fórmulas precisa ser recalculada lá,
  só interpretada.
