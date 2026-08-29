# Foco, energia e fadiga — Fase 7

## Rotas (`/api/wellbeing/*`)

| Rota | O que faz |
|---|---|
| `GET/POST/DELETE /focus-sessions?start=&end=` | Sessões de foco (Pomodoro/cronômetro). GET já devolve `stats`, `durationVsProductivity` e `bestHours` calculados. |
| `GET/POST /energy-logs?start=&end=` | Registro diário de energia/disposição/estresse/sono/carga/concentração (escala 1–5). POST faz upsert — um registro por dia. GET devolve `weekdayPattern`. |

## Padrões detectados (seção 21 e 27)

- **`analyzeDurationVsProductivity`**: agrupa sessões em três faixas de duração
  (até 45min, 45–90min, acima de 90min) e compara a produtividade percebida
  média entre elas. Testei com um cenário sintético e a função identificou
  corretamente que sessões acima de 90 minutos tinham produtividade média de
  1,7 contra 4,3–4,7 nas faixas menores — o mesmo tipo de insight da
  mensagem-modelo da seção 27 ("suas sessões acima de 90 minutos tendem a
  apresentar menor desempenho").
- **`analyzeBestHours`**: agrupa por hora do dia em que a sessão começou e
  ordena por produtividade média — base de "seu melhor desempenho ocorre entre
  45 e 70 minutos" (adaptado aqui para horário, já que duração já tem sua
  própria análise).
- **`analyzeWeekdayEnergyPattern`**: agrupa os registros de energia por dia da
  semana.

## Limitação que precisa ficar clara (não escondida no código)

A seção 21 dá como exemplo: *"Você apresenta menor produtividade nas noites de
terça e quinta."* Isso exige saber o **período do dia** (manhã/tarde/noite) em
que a energia foi registrada — mas o schema atual (`energy_logs`) guarda **um
registro por dia**, sem granularidade de período. Por isso,
`analyzeWeekdayEnergyPattern` hoje só consegue dizer "suas terças costumam ter
energia mais baixa", não "suas noites de terça". Se esse nível de detalhe for
importante para você, a correção é adicionar um campo de período (ou permitir
mais de um registro por dia) em `energy_logs` — sinalizo aqui em vez de fingir
que o dado existe.

## Regra de segurança de dados (todas as funções de padrão)

Toda análise (`has_enough_data`) só retorna um padrão quando há uma quantidade
mínima de amostras por grupo (padrão: 2–3). Isso evita o sistema "inventar" um
padrão a partir de uma única sessão ou um único dia da semana registrado —
alinhado com a regra da seção 72 de nunca misturar dado real com suposição.
