# Gem — Sistema pessoal de gestão financeira e de vida

Construído seguindo os manuais anexados (`manual-deploy-cloudflare.md` e
`manual-pwa-celular.md`) e a especificação completa do produto (80 seções).
Este README é o ponto de entrada — cada fase tem seu próprio documento em
`docs/`.

## 🚧 Estado atual do deploy — LEIA ISTO PRIMEIRO

O código está completo e testado (veja "Estado real do projeto" abaixo), mas
**o deploy na Cloudflare ainda não terminou**. Histórico do que já aconteceu:

1. O repositório já foi criado no GitHub e já está conectado a um projeto
   Cloudflare Workers (deploy automático a cada push está configurado).
2. **Primeira tentativa de build falhou**: o upload inicial dos arquivos para
   o GitHub (feito arrastando pastas pelo navegador) não subiu tudo — as
   pastas `src/shared/` e `src/engine/` inteiras, mais o arquivo
   `src/db/workoutSessions.js`, ficaram de fora. O build do Cloudflare
   acusou dezenas de erros `Could not resolve` apontando exatamente para
   esses arquivos ausentes.
3. Nesse mesmo diagnóstico, encontrei mais dois problemas no `package.json`
   local, **já corrigidos**: a versão do `wrangler` estava presa em `^3.90.0`
   (o Cloudflare instalou a 3.114.17, desatualizada — testamos tudo aqui
   localmente com a 4.x); e os scripts `db:migrate:local`/`db:migrate:remote`
   não incluíam a migração `0004_workouts.sql` (do módulo de treino).
4. **Onde paramos**: o usuário ia clonar o repositório de verdade na máquina
   dele (fora deste sandbox), copiar os arquivos que faltaram + o
   `package.json` corrigido por cima, e dar `git push` para disparar um novo
   build. **Não há confirmação ainda de que esse push aconteceu nem de que o
   build passou.** A partir daqui, o usuário está usando o Claude Code, que
   tem acesso real ao terminal/arquivos da máquina dele — este sandbox (onde
   o projeto foi originalmente construído e testado) não tem esse acesso.

### Checklist do que falta confirmar/fazer, nesta ordem

- [ ] Confirmar que o repositório no GitHub tem TODOS os arquivos deste
      projeto (comparar contagem de arquivos com o que está na pasta local —
      deveriam ser ~124 arquivos, sem `node_modules`).
- [ ] Confirmar que o `package.json` no GitHub já reflete a correção
      (`"wrangler": "^4.0.0"` e as 4 migrações nos scripts) — se não, fazer
      commit+push dessa correção.
- [ ] Confirmar que o build mais recente no painel Cloudflare (aba
      **Deployments** do projeto Worker) terminou com sucesso, sem os erros
      `Could not resolve`.
- [x] `package.json` corrigido (`wrangler` ^4.0.0 + migração 0004 nos
      scripts) e enviado ao GitHub — build automático confirmado com sucesso
      (deploy `ab081d2e` em 2026-08-29T11:15Z).
- [x] `database_id` real do D1 já estava preenchido em `wrangler.jsonc`
      (`76628b91-2031-498e-a059-2259c6ec1ed7`), binding `env.DB` → `gem-db`
      confirmado via `wrangler d1 info`.
- [x] As 4 migrações rodaram contra o banco remoto (`npm run
      db:migrate:remote`) — `gem-db` foi de 0 para 38 tabelas.
- [x] Cloudflare Access ativado — **método real usado**: direto na página do
      Worker (`Workers & Pages` → projeto `gem` → aba **Access** → **Protect
      this worker behind access**), em vez do caminho manual via Zero Trust
      descrito originalmente no guia. Isso provisiona o Zero Trust org
      automaticamente. Política criada: **"Acesso Particular"**, restrita ao
      e-mail `dev.matheusmatos@gmail.com`. Verificado por requisição HTTP:
      `gem.dev-matheusmatos.workers.dev` responde com `302` para
      `*.cloudflareaccess.com/cdn-cgi/access/login/...` (tela de login do
      Access), confirmando a proteção ativa.
- [ ] Testar o primeiro acesso de ponta a ponta (login por e-mail + código,
      seção 2.7) e depois o PWA no celular (Parte 3).

O guia completo, passo a passo, está em `docs/GUIA-DEPLOY-COMPLETO.md`.

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
- **Deploy real na Cloudflare** — nunca foi publicado de fato, porque exige
  acesso à sua conta. Checklist pronto em `docs/deploy.md`, execução a ser
  feita em conjunto com você.

## Como continuar a partir daqui

1. Seguir o checklist de `docs/deploy.md` para publicar o que já existe.
2. Testar o Dashboard real contra dados reais.
3. Retomar o desenvolvimento de frontend módulo a módulo, na ordem que fizer
   mais sentido para o seu uso diário (provavelmente: Financeiro completo →
   Metas → Meu Dia → o restante).
