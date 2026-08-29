# Correções — 2ª bateria de testes (pós onboarding/backup/consolidação)

## Resumo por bug

| # | Bug | Correção | Confirmado por |
|---|---|---|---|
| 1 | `date` malformada quebrava com 500 em `weekly-review`, `/today`, `/entries` | `validateDateFormat()` novo, aplicado nos 3 endpoints (+ `financial`/`time` por consistência) | Teste de integração `data malformada em weekly-review retorna 400` |
| 2 | `status` de meta inválido quebrava com 500 | `validateEnum` no PATCH de metas | Teste de integração `status de meta inválido retorna 400` |
| 3 | Meta que nasce completa não vira `concluida` | `createGoal` aplica a mesma regra de `addContribution` | Teste de integração `meta que já nasce completa vira concluida` |
| 4 | Campo "Moeda" salvo mas nunca usado (funcionalidade falsa) | `format.js` ganhou `setCurrency()`/`brl(value, currency)`; `main.js` carrega a moeda ao iniciar; `settings.js` atualiza ao salvar | Regressão manual: `PATCH /settings` com moeda válida + fluxo completo sem erro |
| 5 | Moeda sem validação de formato | Regex `/^[A-Z]{3}$/` no backend | Teste de integração `moeda inválida é rejeitada com 400` |
| 6 | `completedSteps` de rotina sem faixa válida | `validateRange(completedSteps, 0, totalSteps)` | Teste de integração `completedSteps de rotina fora da faixa é rejeitado` |
| 7 | Resgate de investimento maior que o saldo gravava valor incorreto no histórico | Rejeitado com 400 antes de chamar `recordMovement` quando `amount > current_value_cents` | Teste de integração `resgate de investimento maior que o saldo é rejeitado` |
| 8 | Investimento aceitava quantidade/preço médio negativos | Validação `< 0` na criação | Regressão manual |
| 9 | Datas futuras aceitas em sessão de foco/estudo | `validateNotFuture()` novo, aplicado nos dois endpoints | Regressão manual (sessão válida com data de hoje continua funcionando) |
| 10 | Energia aceitava valores decimais | `validateInteger()` + `validateRange()` | Regressão manual |
| 11 | Nome de meta em branco/só espaços aceito | `validateNonBlank()` novo | — |
| 12 | Texto contraditório quando horas de estudo excedem o total | Frontend agora mostra "superou a carga prevista" em vez de "Xh de Yh" com X>Y | — |

## Validadores novos em `shared/validation.js`

- `validateDateFormat(dateStr, label)` — formato `AAAA-MM-DD` + data real (rejeita `2026-13-45`).
- `validateNotFuture(isoString, label)` — rejeita datas/horários futuros, com 5 min de tolerância para relógio dessincronizado.
- `validateInteger(value, label)` — rejeita decimais em escalas discretas.
- `validateNonBlank(value, label)` — rejeita string vazia após `trim()`, que `validateRequiredFields` não pega sozinha.

## Sobre o Bug 4 (moeda) — decisão de implementação

Em vez de só validar o campo e deixá-lo continuar sem efeito (o que teria "corrigido" a entrada de dado inválido mas mantido a funcionalidade falsa), optei por **conectar de verdade**: `format.js` agora tem estado de módulo (`currentCurrency`) atualizado uma vez no carregamento do app e a cada vez que o usuário salva as configurações. Toda chamada a `brl()` no app inteiro (Dashboard, Financeiro, Metas, Relatórios, etc.) passa a refletir a moeda escolhida automaticamente, sem precisar tocar em cada tela individualmente.

## Testes

- **29/29 testes unitários** continuam passando (nenhuma mudança nas funções de cálculo puro).
- **14/14 testes de integração** passando — 6 novos, um por bug crítico/alto corrigido, todos confirmando 400 em vez do comportamento anterior (500 ou aceitação silenciosa).
- **Regressão do caminho feliz**: repeti o fluxo completo com dados válidos (moeda, meta, investimento com resgate normal, rotina, relatório semanal, Meu Dia, estudo, energia, foco) sem nenhum erro.

## O que ainda fica em aberto, por escopo, não por esquecimento

- `validateNonBlank` foi aplicado só ao nome de metas (o bug relatado). Provavelmente o mesmo problema existe em outros campos de nome/título (contas, tarefas, projetos, hábitos, rotinas) — não fiz a varredura completa por tempo, mas o padrão de correção é idêntico e reaproveitável.
- A validação de moeda aceita qualquer combinação de 3 letras maiúsculas (não confere contra a lista real de ~180 códigos ISO 4217) — suficiente para não quebrar o `Intl.NumberFormat`, mas não impede alguém de configurar um código que não existe de verdade (ex.: "ZZZ"). Se isso importar, a próxima melhoria seria validar contra uma lista real.
