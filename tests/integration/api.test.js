// Testes de integração: sobem o Worker de verdade (mesmo motor de produção,
// via `wrangler dev --local`) com um D1 real (SQLite local), fazem
// requisições HTTP reais contra ele, e derrubam o servidor ao final —
// tudo dentro de uma única execução de processo, sem depender de um
// servidor já estar rodando.
//
// Diferença para tests/engine/*.test.js: aqueles testam funções puras
// isoladas; este arquivo testa as ROTAS HTTP de ponta a ponta contra o D1
// real, incluindo autenticação via Access, persistência entre requisições,
// e efeitos colaterais no banco (o que os testes unitários não alcançam).
//
// Requer o wrangler instalado (veja package.json → devDependencies).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '../..');
const PORT = 8799; // porta dedicada aos testes, para não colidir com `npm run dev`
const BASE = `http://localhost:${PORT}`;
const PERSIST_DIR = '/tmp/gem-integration-test-state';

let child;

function findWranglerBin() {
  const localBin = path.join(APP_ROOT, 'node_modules', '.bin', 'wrangler');
  if (existsSync(localBin)) return localBin;
  // Ambientes onde o wrangler foi instalado fora da pasta do projeto
  // (necessário neste sandbox porque node_modules não pode ficar dentro do
  // diretório de assets do Worker — ver docs/testes.md).
  const hoisted = path.resolve(APP_ROOT, '..', 'tools', 'node_modules', '.bin', 'wrangler');
  if (existsSync(hoisted)) return hoisted;
  throw new Error('wrangler não encontrado. Rode "npm install --save-dev wrangler" fora da pasta do projeto.');
}

function waitForServerReady(proc, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Servidor não ficou pronto em ${timeoutMs}ms. Saída:\n${output}`)), timeoutMs);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('Ready on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (chunk) => { output += chunk.toString(); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`wrangler dev encerrou prematuramente (código ${code}). Saída:\n${output}`));
    });
  });
}

function runMigrations(wranglerBin) {
  return new Promise((resolve, reject) => {
    const migrate = spawn(wranglerBin, [
      'd1', 'execute', 'gem-db', '--local', '--persist-to', PERSIST_DIR,
      '--file=./migrations/0001_core.sql'
    ], { cwd: APP_ROOT });
    migrate.on('exit', (code) => {
      if (code !== 0) return reject(new Error('Falha ao aplicar migração 0001'));
      const migrate2 = spawn(wranglerBin, [
        'd1', 'execute', 'gem-db', '--local', '--persist-to', PERSIST_DIR,
        '--file=./migrations/0002_routine_logs.sql'
      ], { cwd: APP_ROOT });
      migrate2.on('exit', (code2) => {
        if (code2 !== 0) return reject(new Error('Falha ao aplicar migração 0002'));
        const migrate3 = spawn(wranglerBin, [
          'd1', 'execute', 'gem-db', '--local', '--persist-to', PERSIST_DIR,
          '--file=./migrations/0003_onboarding.sql'
        ], { cwd: APP_ROOT });
        migrate3.on('exit', (code3) => {
          if (code3 !== 0) return reject(new Error('Falha ao aplicar migração 0003'));
          const migrate4 = spawn(wranglerBin, [
            'd1', 'execute', 'gem-db', '--local', '--persist-to', PERSIST_DIR,
            '--file=./migrations/0004_workouts.sql'
          ], { cwd: APP_ROOT });
          migrate4.on('exit', (code4) => {
            if (code4 !== 0) return reject(new Error('Falha ao aplicar migração 0004'));
            resolve();
          });
        });
      });
    });
  });
}

before(async () => {
  if (existsSync(PERSIST_DIR)) rmSync(PERSIST_DIR, { recursive: true, force: true });
  mkdirSync(PERSIST_DIR, { recursive: true });

  const wranglerBin = findWranglerBin();
  await runMigrations(wranglerBin);

  child = spawn(wranglerBin, ['dev', '--local', '--port', String(PORT), '--persist-to', PERSIST_DIR], {
    cwd: APP_ROOT
  });
  await waitForServerReady(child);
});

after(() => {
  if (child) child.kill();
  if (existsSync(PERSIST_DIR)) rmSync(PERSIST_DIR, { recursive: true, force: true });
});

function authHeaders(email) {
  return { 'Cf-Access-Authenticated-User-Email': email, 'Content-Type': 'application/json' };
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test('requisição sem header do Access é rejeitada com 401', async () => {
  const res = await api('/api/finance/accounts');
  assert.equal(res.status, 401);
});

test('primeiro acesso provisiona o usuário e semeia categorias padrão', async () => {
  const res = await api('/api/finance/categories', { headers: authHeaders('integracao1@exemplo.com') });
  assert.equal(res.status, 200);
  assert.equal(res.body.categories.length, 15);
});

test('fluxo financeiro completo: conta → transação parcelada → limite de gastos reflete tudo', async () => {
  const headers = authHeaders('integracao2@exemplo.com');

  const account = await api('/api/finance/accounts', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Conta Teste', type: 'corrente', balance: 1000 })
  });
  assert.equal(account.status, 201);

  const income = await api('/api/finance/transactions', {
    method: 'POST', headers, body: JSON.stringify({ description: 'Salário', amount: 3000, type: 'receita', dueDate: '2026-08-29' })
  });
  assert.equal(income.status, 201);

  const expense = await api('/api/finance/transactions', {
    method: 'POST', headers, body: JSON.stringify({ description: 'Notebook', amount: 1200, type: 'despesa', dueDate: '2026-08-29', installmentsTotal: 3 })
  });
  assert.equal(expense.status, 201);
  assert.equal(expense.body.transaction.is_installment, 1);

  const spendingLimit = await api('/api/engine/spending-limit?month=2026-08', { headers });
  assert.equal(spendingLimit.status, 200);
  // 3000 receita - 400 (primeira parcela de 1200/3) = 2600 disponível
  assert.equal(spendingLimit.body.available, 2600);
});

test('meta atrasada é sinalizada corretamente pelo endpoint real', async () => {
  const headers = authHeaders('integracao3@exemplo.com');
  const goal = await api('/api/goals', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Viagem', targetAmount: 6000, currentAmount: 1200, deadline: '2027-02-28', monthlyContribution: 500 })
  });
  assert.equal(goal.status, 201);
  assert.equal(goal.body.goal.plan.isBehindSchedule, true);
});

test('validação de formato de mês retorna 400 claro, não 500 (bug corrigido)', async () => {
  const headers = authHeaders('integracao4@exemplo.com');
  const res = await api('/api/engine/spending-limit?month=2026/08', { headers });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /formato de mês/i);
});

test('editar conta arquivada retorna 404 (bug corrigido)', async () => {
  const headers = authHeaders('integracao5@exemplo.com');
  const created = await api('/api/finance/accounts', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Temporária', type: 'carteira' })
  });
  const id = created.body.account.id;

  await api(`/api/finance/accounts/${id}`, { method: 'DELETE', headers });

  const edited = await api(`/api/finance/accounts/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ name: 'Não deveria funcionar' })
  });
  assert.equal(edited.status, 404);
});

test('backup completo: exportar, apagar, restaurar, e conferir que os dados voltam', async () => {
  const headers = authHeaders('integracao6@exemplo.com');

  await api('/api/finance/accounts', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Conta Backup', type: 'corrente', balance: 500 })
  });

  const exported = await fetch(`${BASE}/api/backup/export`, { headers });
  const backup = await exported.json();
  assert.ok(backup.tables.accounts.length >= 1);

  // Cria dado extra que NÃO deveria sobreviver à restauração
  await api('/api/finance/accounts', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Vai sumir', type: 'poupanca' })
  });

  const restore = await api('/api/backup/restore', {
    method: 'POST', headers, body: JSON.stringify({ confirmWipe: true, backup })
  });
  assert.equal(restore.status, 200);

  const accountsAfter = await api('/api/finance/accounts', { headers });
  assert.equal(accountsAfter.body.accounts.length, 1);
  assert.equal(accountsAfter.body.accounts[0].name, 'Conta Backup');
});

test('insights não duplicam ao gerar mais de uma vez (bug corrigido)', async () => {
  const headers = authHeaders('integracao7@exemplo.com');

  await api('/api/goals', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Meta atrasada', targetAmount: 1000, currentAmount: 0, deadline: '2026-09-05', monthlyContribution: 10 })
  });

  await api('/api/insights/generate', { method: 'POST', headers });
  await api('/api/insights/generate', { method: 'POST', headers });
  await api('/api/insights/generate', { method: 'POST', headers });

  const recent = await api('/api/insights/recent', { headers });
  const messages = recent.body.insights.map(i => i.message);
  const uniqueMessages = new Set(messages);
  assert.equal(messages.length, uniqueMessages.size, 'não deveria haver mensagens de insight duplicadas');
});

// ---------- Regressões da 2ª bateria de testes (rodada de "usuário real") ----------

test('data malformada em weekly-review retorna 400, não 500 (bug corrigido)', async () => {
  const headers = authHeaders('integracao8@exemplo.com');
  const res = await api('/api/reports/weekly-review?date=data-invalida', { headers });
  assert.equal(res.status, 400);
});

test('status de meta inválido retorna 400, não 500 (bug corrigido)', async () => {
  const headers = authHeaders('integracao9@exemplo.com');
  const goal = await api('/api/goals', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Meta status', targetAmount: 100, deadline: '2027-01-01' })
  });
  const res = await api(`/api/goals/${goal.body.goal.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ status: 'status_invalido' })
  });
  assert.equal(res.status, 400);
});

test('meta que já nasce completa vira concluida automaticamente (bug corrigido)', async () => {
  const headers = authHeaders('integracao10@exemplo.com');
  const goal = await api('/api/goals', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Já completa', targetAmount: 500, currentAmount: 500, deadline: '2027-01-01' })
  });
  assert.equal(goal.body.goal.status, 'concluida');
});

test('moeda inválida é rejeitada com 400 (bug corrigido)', async () => {
  const headers = authHeaders('integracao11@exemplo.com');
  const res = await api('/api/settings', { method: 'PATCH', headers, body: JSON.stringify({ currency: 'XYZ123!!!' }) });
  assert.equal(res.status, 400);
});

test('resgate de investimento maior que o saldo é rejeitado (bug corrigido)', async () => {
  const headers = authHeaders('integracao12@exemplo.com');
  const inv = await api('/api/investments', {
    method: 'POST', headers, body: JSON.stringify({ name: 'CDB Teste', category: 'renda_fixa', currentValue: 100 })
  });
  const res = await api(`/api/investments/${inv.body.investment.id}/movements`, {
    method: 'POST', headers, body: JSON.stringify({ type: 'resgate', amount: 500, date: '2026-08-29' })
  });
  assert.equal(res.status, 400);
});

test('completedSteps de rotina fora da faixa é rejeitado (bug corrigido)', async () => {
  const headers = authHeaders('integracao13@exemplo.com');
  const routine = await api('/api/growth/routines', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Rotina Teste', period: 'manha' })
  });
  await api(`/api/growth/routines/${routine.body.routine.id}/steps`, {
    method: 'POST', headers, body: JSON.stringify({ title: 'Passo 1', orderIndex: 0 })
  });
  const res = await api(`/api/growth/routines/${routine.body.routine.id}/logs`, {
    method: 'POST', headers, body: JSON.stringify({ date: '2026-08-29', completedSteps: 999 })
  });
  assert.equal(res.status, 400);
});

// ---------- Módulo de treino em casa ----------

test('biblioteca de exercícios vem semeada com 20 exercícios', async () => {
  const headers = authHeaders('integracao14@exemplo.com');
  const res = await api('/api/workouts/exercises', { headers });
  assert.equal(res.status, 200);
  assert.equal(res.body.exercises.length, 20);
});

test('sugestão de treino considera energia baixa e reduz a duração', async () => {
  const headers = authHeaders('integracao15@exemplo.com');
  await api('/api/wellbeing/energy-logs', { method: 'POST', headers, body: JSON.stringify({ date: '2026-08-29', energy: 2 }) });
  const res = await api('/api/workouts/suggestion?date=2026-08-29', { headers });
  assert.equal(res.status, 200);
  assert.equal(res.body.applicable, true);
  assert.ok(res.body.targetMinutes <= 20, 'energia baixa deveria limitar a duração a no máximo 20min');
});

test('rotação de grupo muscular evita repetir o último grupo treinado', async () => {
  const headers = authHeaders('integracao16@exemplo.com');
  await api('/api/workouts/sessions', {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-08-29', muscleGroups: 'pernas', exercises: [{ exerciseId: 'ex-agachamento-livre', sets: 3, reps: 15 }] })
  });
  const res = await api('/api/workouts/suggestion?date=2026-08-30', { headers });
  assert.notEqual(res.body.muscleGroup, 'pernas');
});

test('exercício excluído não aparece mais na sugestão', async () => {
  const headers = authHeaders('integracao17@exemplo.com');
  await api('/api/workouts/excluded-exercises', {
    method: 'POST', headers, body: JSON.stringify({ exerciseId: 'ex-burpee', reason: 'joelho' })
  });
  const res = await api('/api/workouts/suggestion?date=2026-08-29', { headers });
  const ids = res.body.exercises.map(e => e.id);
  assert.ok(!ids.includes('ex-burpee'));
});

test('sessão de treino sem exercícios é rejeitada', async () => {
  const headers = authHeaders('integracao18@exemplo.com');
  const res = await api('/api/workouts/sessions', {
    method: 'POST', headers, body: JSON.stringify({ date: '2026-08-29', muscleGroups: 'core', exercises: [] })
  });
  assert.equal(res.status, 400);
});
