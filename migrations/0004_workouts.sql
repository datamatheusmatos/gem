-- Migração 0004 — módulo de treino em casa (calistenia/peso do corpo).
-- Adicionada após a decisão de incluir sugestão de rotina de exercícios,
-- seguindo o mesmo padrão das migrações anteriores: incremental, não altera
-- as tabelas já existentes.

-- Biblioteca de exercícios: tabela de REFERÊNCIA, compartilhada entre todos
-- os usuários (não tem user_id) — o mesmo catálogo de exercícios vale para
-- todo mundo, só a sugestão e o histórico de cada um mudam.
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN ('peito_triceps','costas_biceps','pernas','core','ombros','corpo_todo')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('iniciante','intermediario','avancado')),
  default_sets INTEGER NOT NULL DEFAULT 3,
  default_reps INTEGER NOT NULL DEFAULT 10,
  seconds_per_set INTEGER NOT NULL DEFAULT 40, -- estimativa de duração por série, para orçar o tempo total
  instructions TEXT
);

-- Exercícios que o usuário marcou como "não posso fazer" (lesão, preferência).
CREATE TABLE excluded_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_excluded_exercises_user_ex ON excluded_exercises(user_id, exercise_id);

-- Uma sessão de treino realizada (não a sugestão em si — a sugestão é
-- calculada na hora e não precisa ser persistida antes de ser executada).
CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  muscle_groups TEXT NOT NULL, -- grupos treinados nesta sessão, separados por vírgula
  duration_minutes INTEGER,
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, date);

-- Exercícios de cada sessão, com séries/repetições realizadas — usado tanto
-- para o histórico quanto para calcular a progressão (seção "sobrecarga
-- progressiva simples" do motor de sugestão).
CREATE TABLE workout_session_exercises (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_workout_session_exercises_session ON workout_session_exercises(workout_session_id);

-- ---------- Seed: catálogo inicial de exercícios sem equipamento ----------

INSERT INTO exercises (id, name, muscle_group, difficulty, default_sets, default_reps, seconds_per_set, instructions) VALUES
('ex-flexao-padrao', 'Flexão de braço padrão', 'peito_triceps', 'iniciante', 3, 10, 35, 'Mãos na largura dos ombros, corpo reto, desça até o peito quase tocar o chão.'),
('ex-flexao-joelho', 'Flexão de braço com joelho no chão', 'peito_triceps', 'iniciante', 3, 12, 30, 'Mesma execução da flexão padrão, mas apoiando os joelhos — bom ponto de partida.'),
('ex-flexao-diamante', 'Flexão diamante', 'peito_triceps', 'avancado', 3, 8, 40, 'Mãos próximas formando um triângulo sob o peito — foco maior em tríceps.'),
('ex-mergulho-cadeira', 'Mergulho no banco/cadeira (tríceps)', 'peito_triceps', 'intermediario', 3, 12, 35, 'Mãos apoiadas numa cadeira firme atrás do corpo, desça e suba flexionando os cotovelos.'),
('ex-flexao-pike', 'Flexão pike (ombros)', 'ombros', 'intermediario', 3, 10, 35, 'Quadril elevado formando um V invertido, flexione os braços levando a cabeça em direção ao chão.'),
('ex-remada-invertida', 'Remada invertida (com mesa ou barra baixa)', 'costas_biceps', 'intermediario', 3, 10, 35, 'Deite sob uma mesa firme, segure a borda e puxe o peito em direção a ela.'),
('ex-superman', 'Superman (lombar/costas)', 'costas_biceps', 'iniciante', 3, 12, 30, 'Deitado de bariga para baixo, eleve braços e pernas simultaneamente, segure e desça.'),
('ex-agachamento-livre', 'Agachamento livre', 'pernas', 'iniciante', 3, 15, 40, 'Pés na largura dos ombros, desça como se fosse sentar, joelhos alinhados com os pés.'),
('ex-afundo', 'Afundo (lunge) alternado', 'pernas', 'iniciante', 3, 12, 40, 'Um passo à frente, desça até o joelho de trás quase tocar o chão, alterne as pernas.'),
('ex-agachamento-bulgaro', 'Agachamento búlgaro', 'pernas', 'avancado', 3, 10, 45, 'Pé de trás apoiado numa cadeira, agache com a perna da frente.'),
('ex-elevacao-panturrilha', 'Elevação de panturrilha', 'pernas', 'iniciante', 3, 20, 25, 'Em pé, eleve os calcanhares o máximo possível e desça controlado.'),
('ex-prancha', 'Prancha abdominal', 'core', 'iniciante', 3, 1, 40, 'Apoie antebraços e pontas dos pés, corpo reto, segure na posição (contar em segundos).'),
('ex-prancha-lateral', 'Prancha lateral', 'core', 'intermediario', 3, 1, 35, 'De lado, apoiado num antebraço, corpo reto, segure na posição.'),
('ex-abdominal-bicicleta', 'Abdominal bicicleta', 'core', 'iniciante', 3, 15, 35, 'Deitado, alterne cotovelo e joelho opostos num movimento de pedalar.'),
('ex-mountain-climber', 'Mountain climber', 'core', 'intermediario', 3, 20, 35, 'Posição de prancha alta, leve os joelhos ao peito alternadamente em ritmo acelerado.'),
('ex-burpee', 'Burpee', 'corpo_todo', 'avancado', 3, 10, 45, 'Agache, jogue os pés para trás em prancha, flexione, volte e salte.'),
('ex-polichinelo', 'Polichinelo (jumping jack)', 'corpo_todo', 'iniciante', 3, 20, 30, 'Salte abrindo pernas e braços simultaneamente, volte à posição inicial.'),
('ex-agachamento-salto', 'Agachamento com salto', 'pernas', 'intermediario', 3, 12, 40, 'Agache e exploda para cima em um salto, aterrisse suave e repita.'),
('ex-escalador-lento', 'Escalador lento (slow mountain climber)', 'core', 'iniciante', 3, 10, 35, 'Igual ao mountain climber, mas em ritmo controlado — bom para iniciantes.'),
('ex-ponte-gluteo', 'Ponte de glúteo', 'pernas', 'iniciante', 3, 15, 35, 'Deitado, pés apoiados, eleve o quadril contraindo o glúteo no topo.');
