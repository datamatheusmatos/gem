-- ============================================================
-- Migração 0001 — núcleo completo do banco de dados (Cloudflare D1)
-- Referência: seção 42 da especificação do produto.
-- Convenções:
--   - Todo id é TEXT (uuid gerado na aplicação, não AUTOINCREMENT)
--   - Toda tabela de domínio de usuário carrega user_id e created_at
--   - Valores monetários em INTEGER (centavos) para evitar erro de ponto flutuante
--   - value_kind distingue: 'real' | 'previsto' | 'estimado' | 'simulado'
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Usuário e configurações ----------

-- Identidade do usuário vem do Cloudflare Access (login por e-mail via One-Time PIN,
-- configurado conforme o manual de deploy). Não há senha própria da aplicação:
-- o Access já autentica antes da requisição chegar ao Worker.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'BRL',
  week_start TEXT NOT NULL DEFAULT 'monday',
  theme TEXT NOT NULL DEFAULT 'system',
  safety_margin_cents INTEGER NOT NULL DEFAULT 0,
  emergency_fund_target_months REAL NOT NULL DEFAULT 6,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Financeiro: contas, cartões, transações ----------

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('corrente','poupanca','carteira','digital','investimento','outros')),
  balance_cents INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  brand TEXT,
  limit_cents INTEGER NOT NULL,
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  is_primary INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cards_user ON cards(user_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_categories_user ON categories(user_id);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita','despesa','transferencia')),
  value_kind TEXT NOT NULL DEFAULT 'real' CHECK (value_kind IN ('real','previsto','estimado','simulado')),
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pago','pendente','atrasado')),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  recurrence TEXT CHECK (recurrence IN (NULL,'nenhuma','mensal','semanal','anual')),
  is_installment INTEGER NOT NULL DEFAULT 0,
  transfer_pair_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, due_date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_card ON transactions(card_id);

CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  total INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','pago'))
);
CREATE INDEX idx_installments_transaction ON installments(transaction_id);
CREATE INDEX idx_installments_due ON installments(due_date);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ---------- Orçamento ----------

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- formato 'YYYY-MM'
  planned_cents INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_budgets_cat_period ON budgets(category_id, period);

-- ---------- Financiamentos e dívidas ----------

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  original_amount_cents INTEGER NOT NULL,
  remaining_amount_cents INTEGER NOT NULL,
  rate_monthly REAL NOT NULL DEFAULT 0,
  amortization_system TEXT CHECK (amortization_system IN (NULL,'price','sac')),
  installments_total INTEGER NOT NULL,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  installment_amount_cents INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_debts_user ON debts(user_id);

CREATE TABLE debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  principal_cents INTEGER NOT NULL,
  interest_cents INTEGER NOT NULL,
  paid_date TEXT NOT NULL,
  is_extra INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);

-- ---------- Investimentos ----------

CREATE TABLE investments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('renda_fixa','fundos','acoes','etf','cripto','outros')),
  institution TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  avg_price_cents INTEGER NOT NULL DEFAULT 0,
  current_value_cents INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_investments_user ON investments(user_id);

CREATE TABLE investment_movements (
  id TEXT PRIMARY KEY,
  investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('aporte','resgate')),
  amount_cents INTEGER NOT NULL,
  quantity REAL,
  date TEXT NOT NULL
);
CREATE INDEX idx_investment_movements_inv ON investment_movements(investment_id);

-- ---------- Metas ----------

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  target_amount_cents INTEGER,
  current_amount_cents INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  monthly_contribution_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','concluida','pausada')),
  metric TEXT, -- para metas não financeiras (ex.: "3 livros")
  progress_current REAL,
  progress_target REAL
);
CREATE INDEX idx_goals_user ON goals(user_id);

CREATE TABLE goal_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL
);
CREATE INDEX idx_goal_contrib_goal ON goal_contributions(goal_id);

-- ---------- Tempo, foco, energia ----------

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- trabalho, deslocamento, sono, estudos, exercicio, lazer, tarefas_domesticas, projetos, livre
  minutes INTEGER NOT NULL,
  date TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);

CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  objective TEXT,
  duration_minutes INTEGER NOT NULL,
  interruptions INTEGER NOT NULL DEFAULT 0,
  perceived_productivity INTEGER CHECK (perceived_productivity BETWEEN 1 AND 5),
  started_at TEXT NOT NULL
);
CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id);

CREATE TABLE energy_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  disposition INTEGER CHECK (disposition BETWEEN 1 AND 5),
  stress INTEGER CHECK (stress BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  workload INTEGER CHECK (workload BETWEEN 1 AND 5),
  concentration INTEGER CHECK (concentration BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX idx_energy_logs_user_date ON energy_logs(user_id, date);

-- ---------- Estudos, projetos, hábitos, rotinas ----------

CREATE TABLE study_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  total_hours REAL,
  hours_done REAL NOT NULL DEFAULT 0,
  deadline TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('planejado','em_andamento','concluido','atrasado'))
);
CREATE INDEX idx_study_items_user ON study_items(user_id);

CREATE TABLE study_sessions (
  id TEXT PRIMARY KEY,
  study_item_id TEXT NOT NULL REFERENCES study_items(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL,
  date TEXT NOT NULL
);
CREATE INDEX idx_study_sessions_item ON study_sessions(study_item_id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  deadline TEXT,
  budget_cents INTEGER,
  priority INTEGER NOT NULL DEFAULT 3,
  progress REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','pausado'))
);
CREATE INDEX idx_projects_user ON projects(user_id);

CREATE TABLE project_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT
);
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);

CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('diario','semanal','mensal')),
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_habits_user ON habits(user_id);

CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_habit_logs_habit_date ON habit_logs(habit_id, date);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('manha','trabalho','noite','estudos','fim_de_semana'))
);

CREATE TABLE routine_steps (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL
);
CREATE INDEX idx_routine_steps_routine ON routine_steps(routine_id);

-- ---------- Tarefas e agenda ----------

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  urgency INTEGER NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  effort_minutes INTEGER,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  location TEXT
);
CREATE INDEX idx_appointments_user_start ON appointments(user_id, start_at);

-- ---------- Notificações e insights ----------

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('informacao','atencao','importante','critico')),
  category TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL, -- financeiro, planejamento, estudos, foco, energia
  message TEXT NOT NULL,
  data_json TEXT, -- payload usado para reconstituir a explicação ("como foi calculado")
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_insights_user_domain ON insights(user_id, domain);

-- ---------- Decisões ----------

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_cents INTEGER,
  evaluation TEXT, -- baixo, moderado, elevado
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_decisions_user ON decisions(user_id);

-- ---------- Backups ----------

CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  size_bytes INTEGER
);
