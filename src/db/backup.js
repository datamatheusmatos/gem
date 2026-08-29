// Backup completo (seções 36-37): exporta TODOS os dados do usuário — não
// apenas o financeiro — em um único objeto JSON, na ordem certa para permitir
// reimportação respeitando dependências entre tabelas (pai antes de filho).
//
// Tabelas deliberadamente fora do backup: `notifications` e `insights` são
// dados gerados pelo DecisionEngine (recalculáveis a qualquer momento via
// /api/insights/generate), não informação autoral do usuário — incluí-las
// infla o arquivo sem agregar valor real a uma restauração.

const PARENT_TABLES = [
  'categories', 'accounts', 'cards', 'goals', 'debts', 'investments',
  'projects', 'habits', 'routines', 'study_items', 'tasks', 'appointments',
  'time_entries', 'focus_sessions', 'energy_logs', 'transactions', 'tags'
];

// Tabelas filhas: não têm user_id direto, então o filtro por usuário exige
// join com a tabela pai. Cada entrada descreve como buscar e como restaurar.
const CHILD_TABLES = [
  { name: 'installments', parentIdCol: 'transaction_id', parentTable: 'transactions' },
  { name: 'transaction_tags', parentIdCol: 'transaction_id', parentTable: 'transactions' },
  { name: 'budgets', parentIdCol: null, hasUserId: true },
  { name: 'goal_contributions', parentIdCol: 'goal_id', parentTable: 'goals' },
  { name: 'debt_payments', parentIdCol: 'debt_id', parentTable: 'debts' },
  { name: 'investment_movements', parentIdCol: 'investment_id', parentTable: 'investments' },
  { name: 'project_tasks', parentIdCol: 'project_id', parentTable: 'projects' },
  { name: 'habit_logs', parentIdCol: 'habit_id', parentTable: 'habits' },
  { name: 'routine_steps', parentIdCol: 'routine_id', parentTable: 'routines' },
  { name: 'routine_logs', parentIdCol: 'routine_id', parentTable: 'routines' },
  { name: 'study_sessions', parentIdCol: 'study_item_id', parentTable: 'study_items' }
];

export async function exportAllData(db, userId) {
  const tables = {};

  for (const table of PARENT_TABLES) {
    const { results } = await db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).bind(userId).all();
    tables[table] = results;
  }

  for (const child of CHILD_TABLES) {
    if (child.hasUserId) {
      const { results } = await db.prepare(`SELECT * FROM ${child.name} WHERE user_id = ?`).bind(userId).all();
      tables[child.name] = results;
    } else {
      const { results } = await db.prepare(
        `SELECT c.* FROM ${child.name} c JOIN ${child.parentTable} p ON p.id = c.${child.parentIdCol} WHERE p.user_id = ?`
      ).bind(userId).all();
      tables[child.name] = results;
    }
  }

  return { exportedAt: new Date().toISOString(), userId, tables };
}

// Apaga todas as tabelas-pai do usuário — as filhas somem sozinhas por
// ON DELETE CASCADE. Não apaga `users` nem `user_settings`: a conta e as
// preferências continuam existindo, só os dados voltam a zero.
export async function wipeAllData(db, userId) {
  const statements = PARENT_TABLES.map(table => db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId));
  await db.batch(statements);
}

// Restaura a partir de um objeto no mesmo formato de exportAllData(). Insere
// na ordem pai→filho para respeitar as referências. Cada linha é inserida
// dinamicamente a partir das próprias chaves do objeto (evita manter uma
// lista de colunas duplicada por tabela, que ficaria dessincronizada do
// schema real com o tempo).
export async function restoreAllData(db, userId, tables) {
  const allTableNames = [...PARENT_TABLES, ...CHILD_TABLES.map(c => c.name)];
  const statements = [];

  for (const tableName of allTableNames) {
    const rows = tables[tableName];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      // Garantia extra: mesmo que o arquivo importado tenha vindo de outra
      // conta por engano, forçamos o user_id para o usuário autenticado
      // atual em toda tabela que tem essa coluna — nunca restauramos dados
      // "por cima" de outro usuário.
      const safeRow = 'user_id' in row ? { ...row, user_id: userId } : row;
      const cols = Object.keys(safeRow);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map(c => safeRow[c]);
      statements.push(
        db.prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`).bind(...values)
      );
    }
  }

  if (statements.length === 0) return { restored: 0 };

  // D1 limita o tamanho de cada `batch`; para backups grandes, divide em
  // lotes de 50 statements para não estourar o limite de uma vez só.
  const BATCH_SIZE = 50;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE));
  }

  return { restored: statements.length };
}
