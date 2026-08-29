# PWA — Fase 11

## O que foi entregue de verdade

- `manifest.json`, `sw.js`, ícones (192/512/512-maskable) — já existiam desde a
  Fase 1, revisados e mantidos conforme o `manual-pwa-celular.md`.
- **`index.html`**: até esta fase, o projeto era só backend/API — não existia
  nenhuma tela. Criei uma casca funcional do PWA com uma tela real (Dashboard):
  - Card de limite de gastos consumindo `GET /api/engine/spending-limit` de
    verdade.
  - Resumo do dia consumindo `GET /api/time/today` de verdade.
  - Lista de insights e alertas consumindo `GET /api/insights/recent` e
    `GET /api/insights/notifications` de verdade.
  - **Registro rápido de gasto funcional** (seção 33): um botão flutuante abre
    um formulário que faz `POST /api/finance/transactions` de verdade e
    atualiza o card de limite imediatamente após salvar — não é um botão sem
    função.
  - Registro do Service Worker com fallback silencioso, exatamente como
    especificado no manual.
- **Ícones gerados agora**, desenhados com Pillow (não copiados de nenhuma
  fonte externa): diamante geométrico monocromático sobre fundo escuro,
  seguindo a estética que você aprovou — sem qualquer referência a
  personagem protegido por direitos autorais.
- `.assetsignore` atualizado para também não publicar `src/`, `tests/`,
  `package.json` e `wrangler.jsonc` como conteúdo estático — só o que o
  navegador realmente precisa (`index.html`, `manifest.json`, `sw.js`,
  ícones) fica público.

## Limitação importante, declarada com honestidade

A especificação original (seções 3–75) descreve **dezenas de telas**: todos
os módulos financeiros, planejamento, foco, estudos, hábitos, relatórios,
configurações, etc. Construir o frontend completo de todos eles está fora do
que esta sessão consegue entregar com qualidade dentro do escopo já
percorrido — o que existe agora é:

1. Uma **casca PWA instalável e funcional de verdade** (não uma maquete) —
   cumpre os requisitos técnicos de instalação, service worker e cache
   seguro (`/api/*` excluído do cache, como manda o manual).
2. **Uma tela real** (Dashboard) provando que o padrão de integração
   frontend↔API funciona ponta a ponta, com um fluxo completo (registrar
   gasto → ver o limite atualizar).

Recomendo tratar as demais ~59 telas como um trabalho de frontend contínuo,
tela por tela, reaproveitando exatamente este padrão (fetch para `/api/...`,
mesmo sistema de cores/tokens do `index.html`). Não fingi que esse trabalho
está pronto — prefiro te avisar agora a entregar telas com dados fictícios
disfarçados de reais.

## Teste de instalação (a fazer depois do deploy real, Fase 12)

Uma vez publicado, testar conforme a seção 5 do manual de PWA: Android+Chrome
("Adicionar à tela inicial"), iPhone+Safari (não funciona no Chrome do
iPhone — limitação da Apple), Desktop Chrome/Edge (ícone na barra de
endereço).
