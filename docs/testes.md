# Testes — Fases 13 e continuação

## Duas suítes agora, ambas automatizadas e passando de verdade

### `npm run test:unit` — 29/29 passando
Testa funções puras de cálculo (`FinancialEngine`, `goalsCalc`, `timeCalc`,
`focusCalc`, `habitsCalc`, `reportsCalc`, dinheiro/datas, parcelamento) sem
depender de banco. Detalhes na seção original abaixo.

### `npm run test:integration` — 8/8 passando
Antes, esta seção dizia que testes de integração real (rotas HTTP + D1) não
rodavam neste ambiente sandbox. Isso mudou: `tests/integration/api.test.js`
sobe o **Worker real** via `wrangler dev --local` (mesmo motor de produção,
D1 local de verdade em SQLite), roda requisições HTTP reais contra ele, e
derruba o servidor ao final — tudo dentro de uma única execução de processo
Node (usando `child_process.spawn` para controlar o ciclo de vida do
`wrangler dev`, contornando a limitação deste sandbox de não manter
processos em segundo plano entre chamadas de ferramenta).

Os 8 testes de integração cobrem, contra o banco real:
- Rejeição sem header do Access (401).
- Provisionamento automático do usuário + semeadura de 15 categorias padrão.
- Fluxo financeiro completo: conta → transação parcelada → limite de gastos
  reflete a primeira parcela corretamente (matemática conferida: R$3.000 −
  R$400 = R$2.600).
- Meta atrasada sinalizada corretamente pelo endpoint real (não só pela
  função pura isolada).
- Regressão do bug de período malformado (deveria dar 400, não 500).
- Regressão do bug de editar conta arquivada (deveria dar 404).
- Backup completo: exportar → criar dado extra → restaurar → confirmar que
  só os dados do backup existem (o dado extra desaparece).
- Regressão do bug de insights duplicados (gerar 3x não deveria triplicar).

**Como rodar:** `npm run test:integration` (requer `wrangler` instalado como
devDependency — já está no `package.json`). Roda uma porta dedicada (8799)
para não colidir com `npm run dev`.

## O que ainda não está coberto

- Testes de UI/frontend (cliques reais em botões, preenchimento de
  formulário) — os testes de integração cobrem a API que o frontend consome,
  não o frontend em si. Um teste com Playwright/Puppeteer ficaria mais
  completo, mas exigiria baixar um binário de navegador headless, o que a
  rede deste ambiente sandbox não permite (só registries de pacote).
- Testes de carga/performance — fora do escopo desta etapa.

---

## Testes unitários (conteúdo original desta fase, mantido)

`npm run test:unit` roda `node --test tests/engine/*.test.js` — **29 testes,
29 passando**, sem depender de banco. Cobrem todos os módulos de cálculo puro
construídos nas Fases 4 a 10:

| Arquivo de teste | O que valida |
|---|---|
| `goalsCalc.test.js` | Meta atrasada (exemplo exato da seção 15), meta no ritmo certo, meta geral sem prazo/valor. |
| `timeCalc.test.js` | Sobrecarga de planejamento (exemplo exato da seção 74), conflito de agenda, prioridade dinâmica, Eisenhower. |
| `focusCalc.test.js` | Estatísticas de foco, padrão duração×produtividade (seção 27), ausência de dado insuficiente não vira padrão inventado. |
| `habitsCalc.test.js` | Sequência (streak) parando na primeira quebra, taxa de cumprimento nunca passa de 100%. |
| `studyAndReports.test.js` | Ritmo de estudo atrasado, `percentChange` com base zero, cálculo de semana/mês e virada de ano. |
| `moneyAndInstallments.test.js` | Conversão reais↔centavos, `addMonths` com fallback de fim de mês, soma exata de parcelas com e sem resto de divisão. |
