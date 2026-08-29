# Gem — Sistema pessoal de gestão financeira e de vida

Construído seguindo os manuais anexados (`manual-deploy-cloudflare.md` e
`manual-pwa-celular.md`) e a especificação completa do produto (80 seções).
Este README é o ponto de entrada — cada fase tem seu próprio documento em
`docs/`.

## 🚧 Estado atual — LEIA ISTO PRIMEIRO

**Atualizado em 2026-08-29, via Claude Code rodando na máquina do usuário**
(não mais no sandbox onde o projeto foi originalmente construído). Cloudflare
já está conectada e operacional: repositório GitHub `datamatheusmatos/gem`
→ Worker `gem` com deploy automático a cada push, banco D1 `gem-db` com as
tabelas criadas, Access ativo. `wrangler` está autenticado localmente
(`dev.matheusmatos@gmail.com`) e o Node.js/`wrangler` CLI já estão instalados
nesta máquina — dá pra rodar `npm run db:migrate:remote`, `wrangler
deployments list`, etc. direto.

### Checklist de deploy — tudo concluído nesta sessão

- [x] Todos os ~124 arquivos do projeto confirmados no GitHub (nada faltando).
- [x] `package.json` corrigido (`wrangler` ^4.0.0 + 4 migrações nos scripts) e
      enviado — build automático confirmado com sucesso.
- [x] `database_id` real preenchido em `wrangler.jsonc`
      (`76628b91-2031-498e-a059-2259c6ec1ed7`), binding `env.DB` → `gem-db`
      confirmado via `wrangler d1 info`.
- [x] As 4 migrações rodaram contra o banco remoto — `gem-db` tem 38 tabelas.
- [x] Cloudflare Access ativado — **método real usado**: direto na página do
      Worker (`Workers & Pages` → projeto `gem` → aba **Access** → **Protect
      this worker behind access**), não pelo fluxo manual do Zero Trust
      descrito originalmente no guia (isso provisiona o Zero Trust org
      automaticamente). Política **"Acesso Particular"**, restrita ao e-mail
      `dev.matheusmatos@gmail.com`. Verificado via HTTP (302 para tela de
      login do Access).
- [ ] **Ainda falta**: testar o primeiro acesso de ponta a ponta pelo
      navegador de verdade (login por e-mail + código OTP, seção 2.7 do
      guia) e depois instalar/testar como PWA no celular (Parte 3 do guia).
      Isso exige interação humana (checar e-mail, usar o celular) — não dá
      pra automatizar.

O guia completo, passo a passo, está em `docs/GUIA-DEPLOY-COMPLETO.md`.

### Ajustes de produto feitos após o deploy (mesma sessão)

- **Menu "Mais" no celular**: a barra inferior mostrava os 9 itens do menu
  sem `wrap`/scroll, cortando os últimos sem forma de alcançá-los. Agora
  mostra 4 fixos (Dashboard, Meu Dia, Financeiro, Metas) + botão "Mais" que
  abre um diálogo com o resto. (`public/app/router.js`, `main.js`,
  `main.css`, `index.html`)
- **Nome do app**: título/manifest alterados para "Gem | Seja perfeito"
  (`short_name` continua "Gem").
- **Identidade visual**: fundo escuro decorado com campo de estrelas sutil
  (céu noturno) e ícones com glow, mais intenso no item ativo
  (`public/styles/main.css`). O ícone do app no celular (`icon-512-maskable.png`)
  também ganhou as estrelas, posicionadas dentro da zona seguro do ícone
  adaptativo do Android.
- **Entrevista inicial (onboarding) reaberta**: pular a entrevista no primeiro
  acesso marcava `onboardingCompleted=true` para sempre e a rota é `hidden`
  (sem link em nenhum menu) — ficava inacessível. Agora há um botão "Refazer
  entrevista inicial" em Configurações, e o onboarding sempre reinicia do
  primeiro passo ao ser reaberto.

### Próximos passos sugeridos

1. Fazer o teste de primeiro acesso (login Access) e instalar o PWA no
   celular — ver checklist acima.
2. Testar o Dashboard e as telas principais contra dados reais no celular,
   prestando atenção especial ao menu "Mais" e ao novo ícone.
3. Retomar o desenvolvimento de frontend módulo a módulo, na ordem que fizer
   mais sentido para o uso diário (README original sugeria: Financeiro
   completo → Metas → Meu Dia → o restante) — ou seguir reportando ajustes
   pontuais como os desta sessão, conforme forem aparecendo no uso real.

---

## Stack (100% gratuita — verificado em agosto/2026)

Cloudflare Workers + D1 (SQLite gerenciado, free tier permanente) + Cloudflare
Access (login por e-mail, grátis até 50 usuários) + PWA nativo do navegador.
Nenhuma peça depende de API paga — inclusive o assistente de insights é
100% regras determinísticas, sem chamada a nenhum modelo de linguagem pago.
Detalhes em `docs/arquitetura.md`.

## Índice de documentação por fase

| Fase | Documento | Status |
|---|---|---|
| 1 — Arquitetura e banco | `docs/arquitetura.md` | Completo |
| 2 — Autenticação | `docs/autenticacao.md` | Completo (corrigido: usa Cloudflare Access, não login próprio) |
| 3 — Módulo financeiro | `docs/financeiro.md` | Completo |
| 4 — Motor financeiro | `docs/motor-financeiro.md` | Completo, com limitações declaradas |
| 5 — Metas | `docs/metas.md` | Completo |
| 6 — Gestão de tempo | `docs/gestao-tempo.md` | Completo |
| 7 — Foco e energia | `docs/foco-energia.md` | Completo, com limitação de granularidade declarada |
| 8 — Estudos/projetos/hábitos | `docs/estudos-projetos-habitos.md` | Completo |
| 9 — Assistente/insights | `docs/assistente-insights.md` | Completo, com lacunas declaradas |
| 10 — Relatórios | `docs/relatorios.md` | Completo, com escopo ajustado declarado |
| 11 — PWA | `docs/pwa.md` | Completo — todas as telas construídas |
| 12 — Deploy | `docs/deploy.md` | Checklist pronto — execução guiada em andamento |
| 13 — Testes | `docs/testes.md` | 29 unitários + 8 de integração, todos passando |
| 14 — Refinamento | este documento | Backend consolidado, sem duplicação |
| — Backup/exportação | `docs/backup.md` | Completo, testado (export → apagar → restaurar) |
| — Onboarding | `docs/onboarding.md` | Completo, testado de ponta a ponta |

## Estado real do projeto — honestidade acima de aparência

**O que funciona de ponta a ponta, testado:**
- Toda a API backend (10 domínios: finance, engine, goals, time, wellbeing,
  growth, insights, reports, debts, investments, settings, backup) — CRUD
  real sobre D1, sem dado fictício.
- O `FinancialEngine` e o `DecisionEngine` — cálculos determinísticos,
  validados contra os exemplos exatos da própria especificação.
- **Frontend com navegação real** (sidebar desktop / bottom nav mobile) —
  todas as áreas da especificação têm tela: Onboarding (primeira execução),
  Dashboard, Meu Dia, Financeiro completo (contas, cartões, transações,
  orçamento, dívidas com edição e simulação de amortização, investimentos
  com edição, simulador de compra), Metas, Desenvolvimento pessoal (estudos,
  projetos, hábitos, rotinas), **Treino em casa** (sugestão diária de
  exercícios sem equipamento, com rotação de grupo muscular e ajuste por
  energia/tempo disponível), Assistente (insights, alertas, prioridades,
  conflitos), Relatórios (financeiro, tempo, revisão semanal/mensal),
  Configurações (com backup/restauração).
- Bateria de testes manuais rigorosa (bugs encontrados e corrigidos, com
  reteste confirmado), **29 testes automatizados unitários** e **19 testes de
  integração automatizados** rodando o Worker real contra D1 real.

**Duas correções de arquitetura feitas ao longo do processo:** dívidas e
investimentos tinham implementações duplicadas — consolidado. A rota de
configurações teve um bug próprio (nunca registrada no router) — encontrado
no teste de ponta a ponta e corrigido.

**O que ainda está em aberto, por decisão consciente, não por esquecimento:**
- Reserva de emergência não tem entidade própria — precisa da convenção de
  "meta com categoria reserva" ser confirmada com você antes de virar alerta
  dedicado.
- Calendário financeiro consolidado (seção 17) e visualização gráfica das
  projeções (seção 16) — a API existe, falta o componente visual.
- Testes de UI/frontend real (cliques em navegador) — não é possível baixar
  um navegador headless neste sandbox; os testes de integração cobrem a API
  que o frontend consome, não o clique em si.
- **Deploy real na Cloudflare** — feito nesta sessão (ver seção "Estado
  atual" no topo deste README para o histórico completo e o que ainda falta
  testar manualmente).
