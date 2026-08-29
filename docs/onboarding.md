# Onboarding guiado (seção 58)

## Como funciona

Uma tela cheia (`#onboarding`, sem sidebar/bottom-nav — ver `fullScreen` no
`router.js`) aparece automaticamente no primeiro acesso de cada usuário,
detectado via `settings.onboardingCompleted === false`. Se o usuário navegar
diretamente para outra URL com hash, o redirecionamento não interfere — só
acontece na entrada "neutra" do app.

Seis etapas curtas, cada uma opcional (**"Pular"** sempre disponível), com
barra de progresso visível, seguindo a instrução da seção 58 de não fazer
dezenas de perguntas de uma vez:

1. **Renda** — cria uma transação de receita recorrente mensal.
2. **Despesas fixas** — permite adicionar várias de uma vez, cada uma vira
   uma transação de despesa recorrente mensal.
3. **Dívidas/financiamentos** — opcional, cria uma dívida via `/api/debts`.
4. **Reserva de emergência e primeira meta** — atualiza `emergencyFundTargetMonths`
   e `safetyMargin` nas configurações, e opcionalmente cria uma meta financeira.
5. **Rotina** — um compromisso fixo (ex.: horário de trabalho), para o
   cálculo de tempo disponível do "Meu Dia" já começar com dado real.
6. **Desenvolvimento** — um item de estudo e/ou hábito opcional.

Ao final (ou ao pular a última etapa), `PATCH /api/settings` marca
`onboardingCompleted: true` e o usuário cai no Dashboard normal, já com os
dados que informou refletidos no cálculo de limite de gastos.

## Testado

Simulei o fluxo completo via API (as mesmas chamadas que os formulários do
onboarding fazem): renda de R$4.000, duas despesas fixas, uma dívida, reserva
e meta, um compromisso, um estudo e um hábito. Ao final, `GET
/api/engine/spending-limit` mostrou exatamente R$1.950 disponíveis — receita
menos despesas menos parcela da dívida menos margem de segurança, todos os
valores vindos do que foi preenchido no onboarding.

## O que não foi feito

- Não adicionei um campo de "horas de sono" nesta etapa — isso contrariaria
  a decisão explícita já tomada com você de manter as 16h de vigília padrão
  fixas por enquanto.
- O onboarding não pergunta explicitamente por investimentos existentes
  (a seção 58 lista isso no "perfil financeiro") — o usuário pode cadastrar
  depois em Financeiro → Investimentos; não incluí para manter o assistente
  em 6 passos curtos em vez de crescer ainda mais.
