-- Migração 0002 — execução de rotinas.
-- Adicionada depois da 0001 porque a necessidade de comparar planejado x
-- realizado (seção 26) só ficou clara ao implementar o módulo de rotinas —
-- daqui em diante, mudanças de schema vão como migrações novas, não como
-- edição retroativa da 0001.

CREATE TABLE routine_logs (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_routine_logs_routine_date ON routine_logs(routine_id, date);
