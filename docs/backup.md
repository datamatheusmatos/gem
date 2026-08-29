# Exportação, backup e restauração (seções 36-37)

## Rotas (`/api/backup/*`)

| Rota | O que faz |
|---|---|
| `GET /export` | Backup completo em JSON de todas as tabelas do usuário (17 tabelas-pai + 11 tabelas-filhas), com download automático (`Content-Disposition`). |
| `GET /export/csv?table=transactions` | Exporta uma tabela específica em CSV. Funciona para qualquer tabela presente no backup (troque `transactions` por `accounts`, `goals`, `habits`, etc.). |
| `POST /restore` | Restaura a partir de um backup JSON exportado por esta mesma rota. **Destrutivo**: apaga todos os dados atuais do usuário antes de reimportar — exige `{"confirmWipe": true}` no corpo, senão é rejeitado. |

## O que entra no backup

Todas as tabelas de dado autoral do usuário: contas, cartões, categorias,
transações (+ parcelas + tags), orçamentos, dívidas (+ pagamentos),
investimentos (+ movimentos), metas (+ contribuições), tarefas, compromissos,
registros de tempo, sessões de foco, registros de energia, itens de estudo
(+ sessões), projetos (+ tarefas), hábitos (+ logs), rotinas (+ etapas +
execuções).

**Deliberadamente fora do backup:** `notifications` e `insights` — são dados
*gerados* pelo `DecisionEngine` a qualquer momento via
`POST /api/insights/generate`, não informação que o usuário digitou. Incluí-los
infla o arquivo sem preservar nada que não possa ser recalculado.

## Como a restauração evita corromper dados de outro usuário

Toda linha restaurada tem seu `user_id` **forçado** para o usuário autenticado
da requisição atual, mesmo que o arquivo JSON tenha vindo de outra conta por
engano — nunca é possível "restaurar por cima" dos dados de outra pessoa.

## Testado antes de fechar

No teste de integração automatizado (`tests/integration/api.test.js`):
exportei o backup de um usuário com uma conta cadastrada, criei uma segunda
conta *depois* do backup, restaurei o backup, e confirmei que só a primeira
conta sobrevive — a criada depois do backup desaparece, como esperado de uma
restauração real (não um merge aditivo).
