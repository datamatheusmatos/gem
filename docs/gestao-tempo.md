# Gestão de tempo — Fase 6

## Rotas (`/api/time/*`)

| Rota | O que faz |
|---|---|
| `GET/POST/DELETE /entries` | Registros de tempo por categoria (trabalho, sono, estudos...). GET já devolve `byCategory` somado — base do gráfico "para onde está indo meu tempo?" (seção 18). |
| `GET/POST/PATCH/DELETE /tasks` | Tarefas com importância/urgência/esforço estimado. GET já devolve `priorityScore` e `eisenhower` calculados e ordenados. |
| `GET/POST/DELETE /appointments` | Agenda com horário. GET já devolve `conflicts` — pares de compromissos sobrepostos (seção 55). |
| `GET /today?date=YYYY-MM-DD` | **"Meu Dia"** (seção 19): compromissos + tarefas do dia + prioridades + tempo disponível calculado + conflitos, tudo numa chamada. |

## `calculateDailyPlan` — tempo disponível de verdade (seções 19 e 74)

Soma a duração dos compromissos com horário fixo e o esforço estimado das
tarefas do dia, e subtrai isso do tempo de vigília (24h menos sono — 16h por
padrão quando não há registro de sono naquele dia, documentado explicitamente
como estimativa). Se o total planejado ultrapassa o tempo disponível, a
resposta já vem com `is_over_committed: true` — o sistema **não aceita
silenciosamente** um planejamento impossível, ele identifica o conflito
(regra explícita da seção 74).

Testei com o cenário exato do exemplo da especificação (8h trabalho + 2h
deslocamento + 3h estudos + 2h exercício + 2h projetos + 2h tarefas pessoais =
19h de plano contra 16h disponíveis) e o resultado bateu: `available_minutes:
-180`, `is_over_committed: true`.

## Prioridade (seções 23 e 56)

`calculateTaskPriorityScore` combina importância, urgência e um "boost" que
cresce conforme o prazo se aproxima (satura em 5 pontos nos últimos dias) —
é a base da prioridade dinâmica: a mesma tarefa fica mais prioritária sozinha,
sem o usuário precisar reclassificar nada, só porque o prazo chegou perto.

`classifyEisenhower` classifica em 4 quadrantes (`fazer_agora`, `planejar`,
`delegar_ou_agilizar`, `eliminar_ou_adiar`) usando limiar de importância/urgência
≥ 4. Isso ajuda a cumprir a regra da seção 23 de "não deixar tudo como alta
prioridade" — só tarefas realmente importantes E urgentes caem em
`fazer_agora`.

## Conflitos de agenda (seção 55)

`detectAppointmentConflicts` ordena os compromissos por horário de início e
verifica sobreposição em uma varredura — testado com dois compromissos que se
cruzam parcialmente (19h-20h e 19h30-21h) e o conflito foi identificado
corretamente.

## Em aberto para fases seguintes

- Rotinas (seção 26 — comparação planejado × realizado) ficam para a Fase 8,
  junto de hábitos/projetos, por serem do mesmo bloco de "vida pessoal
  estruturada" na especificação.
- O valor de "minutos de vigília" hoje é uma constante (16h) quando não há
  registro de sono do dia — se o usuário quiser configurar isso por padrão
  (ex.: dorme 6h, não 8h), precisa virar um campo em `user_settings`. Sinalizo
  aqui para decidirmos se vale a pena antes do onboarding.
