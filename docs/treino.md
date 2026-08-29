# Treino em casa (calistenia/peso do corpo)

## Motivação

Funcionalidade adicionada a pedido, fora do escopo original da
especificação — mas conectada de propósito à arquitetura já existente
(energia/fadiga, tempo disponível, "Meu Dia"), em vez de ser um módulo
isolado.

## Como a sugestão é calculada (100% determinística, sem IA)

1. **Rotação de grupo muscular** (`chooseMuscleGroup`): olha a sessão de
   treino mais recente e evita repetir o(s) grupo(s) trabalhado(s) nela.
   Não é uma divisão fixa por dia da semana — se você treinar em dias
   variados, a rotação se adapta.
2. **Intensidade por energia e tempo** (`computeIntensity`): usa o registro
   de energia do dia (`energy_logs`, já existente desde a Fase 7) para
   decidir se o treino de hoje deve ser mais leve (energia baixa: menos
   séries, no máximo 20 minutos) ou completo (energia alta: mais séries).
   O tempo disponível vem do mesmo cálculo do "Meu Dia"
   (`calculateDailyPlan`), então o treino nunca é sugerido maior do que o
   tempo real livre.
3. **Seleção de exercícios**: filtra a biblioteca pelo grupo escolhido,
   remove os exercícios que o usuário marcou como excluídos (lesão,
   preferência), e preenche a duração-alvo por ordem de dificuldade.
4. **Progressão simples** (`calculateProgression`): se há histórico de
   séries/repetições do mesmo exercício nos últimos 21 dias, sugere +1
   repetição em relação à última vez — sobrecarga progressiva básica.

## Testado

- Cenário isolado (função pura, sem banco): energia baixa reduz duração
  para no máximo 20 min mesmo com 40 min livres; rotação evita o grupo do
  último treino; seleção de exercícios preenche a duração-alvo; progressão
  sugere +1 repetição corretamente.
- Teste de integração real (Worker + D1): biblioteca semeada com 20
  exercícios; energia baixa reduz a duração sugerida; rotação evita
  repetir "pernas" no dia seguinte a um treino de pernas; exercício
  excluído desaparece da sugestão seguinte; sessão sem exercícios é
  rejeitada.
- Teste manual completo: registrei uma sessão de peito com flexão diamante
  a 8 repetições, e o histórico gravou corretamente 8 reps na data certa
  (a progressão em si — sugerir 9 na próxima vez que o grupo voltar a ser
  escolhido pela rotação — já estava validada isoladamente).

## Onde aparece no app

- **Aba própria "Treino"**: sugestão do dia com detalhes de cada exercício
  (instrução, séries/repetições), histórico dos últimos 60 dias, e gestão
  de exercícios excluídos.
- **Resumo em "Meu Dia"**: card compacto com o grupo muscular do dia e os
  exercícios sugeridos, com link para a tela completa.

## Biblioteca de exercícios (seed inicial)

20 exercícios sem equipamento, cobrindo 6 grupos musculares (peito/tríceps,
costas/bíceps, pernas, core, ombros, corpo todo), em 3 níveis de
dificuldade. A tabela `exercises` é compartilhada entre todos os usuários
(não tem `user_id`) — é um catálogo de referência, não dado pessoal.

## O que não foi feito, por decisão consciente

- **Sem foto/vídeo dos exercícios** — só texto, mantendo o app livre de
  qualquer serviço externo pago ou hospedagem de mídia.
- **Sem aviso médico dedicado na interface ainda** — recomendo adicionar um
  aviso simples ("não substitui orientação de educador físico/médico"),
  no mesmo espírito do que já existe para energia/fadiga, antes de
  considerar este módulo pronto para uso real.
- **Progressão simplificada**: sempre sugere +1 repetição, não modela
  periodização (semanas de volume/intensidade variável) nem diferencia
  progressão por objetivo (força vs. resistência).
