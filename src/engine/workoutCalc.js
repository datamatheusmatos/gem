// Motor de sugestão de treino em casa — funções puras (sem banco), seguindo o
// mesmo espírito do FinancialEngine/DecisionEngine: regras determinísticas,
// sem IA, e sempre com um "porquê" explicável junto do resultado.

const MUSCLE_GROUP_LABELS = {
  peito_triceps: 'Peito e tríceps', costas_biceps: 'Costas e bíceps', pernas: 'Pernas',
  core: 'Core (abdômen)', ombros: 'Ombros', corpo_todo: 'Corpo todo'
};

const ROTATION_ORDER = ['peito_triceps', 'costas_biceps', 'pernas', 'core', 'ombros', 'corpo_todo'];

// Escolhe o próximo grupo muscular a treinar, evitando repetir o(s) grupo(s)
// da sessão mais recente — rotação simples baseada em "há quanto tempo não
// treino esse grupo", não uma divisão fixa de dias da semana (mais flexível
// para quem treina em dias variados).
export function chooseMuscleGroup(recentSessions) {
  if (recentSessions.length === 0) {
    return { group: 'corpo_todo', reason: 'Nenhum treino recente registrado — começando com corpo todo.' };
  }

  const lastSession = recentSessions[0]; // já vem ordenado do mais recente
  const lastGroups = lastSession.muscle_groups.split(',').map(g => g.trim());

  // Se o treino de ontem/mais recente foi "corpo todo", qualquer grupo serve
  // hoje — não há uma restrição específica a evitar.
  if (lastGroups.includes('corpo_todo') && lastGroups.length === 1) {
    return { group: 'pernas', reason: 'Último treino foi corpo todo — hoje focamos em pernas para variar o estímulo.' };
  }

  const candidates = ROTATION_ORDER.filter(g => !lastGroups.includes(g));
  const next = candidates[0] || ROTATION_ORDER[0];
  return {
    group: next,
    reason: `Último treino trabalhou ${lastGroups.map(g => MUSCLE_GROUP_LABELS[g] || g).join(' e ')} — hoje focamos em ${MUSCLE_GROUP_LABELS[next]} para dar descanso a esses grupos.`
  };
}

// Define duração-alvo e intensidade a partir do tempo disponível e da
// energia registrada hoje. Energia baixa reduz o volume (menos séries),
// mesmo que haja tempo de sobra — não force sobrecarga num dia de pouca
// energia (seção 21 da especificação: usar energia como ferramenta de
// planejamento, não ignorá-la).
export function computeIntensity(availableMinutes, energyLevel) {
  const energy = energyLevel ?? 3; // sem registro hoje -> assume nível médio

  let targetMinutes = Math.min(availableMinutes ?? 30, 45);
  targetMinutes = Math.max(targetMinutes, 0);

  let setsMultiplier = 1;
  let intensityLabel = 'moderada';

  if (energy <= 2) {
    setsMultiplier = 0.7;
    targetMinutes = Math.min(targetMinutes, 20);
    intensityLabel = 'leve (energia baixa hoje)';
  } else if (energy >= 4) {
    setsMultiplier = 1.15;
    intensityLabel = 'completa (energia alta hoje)';
  }

  if (targetMinutes < 10) {
    return { targetMinutes: 0, setsMultiplier, intensityLabel, applicable: false };
  }

  return { targetMinutes, setsMultiplier, intensityLabel, applicable: true };
}

// Seleciona exercícios da biblioteca (já filtrada por grupo muscular e sem
// os excluídos pelo usuário) até preencher a duração-alvo, aplicando
// progressão simples: se há histórico de sets/reps para aquele exercício,
// sugere manter ou aumentar levemente (sobrecarga progressiva); sem
// histórico, usa os valores padrão da biblioteca.
export function selectExercises(library, { targetMinutes, setsMultiplier, difficultyOrder }, progressionByExercise = {}) {
  if (targetMinutes <= 0 || library.length === 0) return [];

  const targetSeconds = targetMinutes * 60;
  const ordered = [...library].sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty));

  const selected = [];
  let usedSeconds = 0;
  let i = 0;

  while (usedSeconds < targetSeconds && selected.length < 6 && i < ordered.length * 2) {
    const exercise = ordered[i % ordered.length];
    const progression = progressionByExercise[exercise.id];

    const sets = Math.max(Math.round(exercise.default_sets * setsMultiplier), 2);
    const reps = progression ? progression.suggestedReps : exercise.default_reps;

    const exerciseSeconds = sets * exercise.seconds_per_set + (sets - 1) * 20; // +20s de descanso entre séries
    if (selected.some(s => s.id === exercise.id)) { i++; continue; }

    selected.push({
      id: exercise.id, name: exercise.name, muscleGroup: exercise.muscle_group,
      difficulty: exercise.difficulty, sets, reps, instructions: exercise.instructions,
      isProgression: !!progression
    });
    usedSeconds += exerciseSeconds;
    i++;
  }

  return selected;
}

// Progressão simples: se a última vez que a pessoa fez este exercício ela
// completou o número de repetições sugerido (ou mais), sugere +1 ou +2
// repetições da próxima vez — sobrecarga progressiva básica, sem exigir
// nenhum dado além do que a sessão de treino já registra.
export function calculateProgression(recentExerciseLogs) {
  const progression = {};
  for (const log of recentExerciseLogs) {
    const current = progression[log.exercise_id];
    if (!current || log.date > current.date) {
      progression[log.exercise_id] = { date: log.date, reps: log.reps, sets: log.sets };
    }
  }

  const result = {};
  for (const [exerciseId, data] of Object.entries(progression)) {
    result[exerciseId] = { suggestedReps: data.reps + 1, lastReps: data.reps, lastSets: data.sets };
  }
  return result;
}

export function muscleGroupLabel(group) {
  return MUSCLE_GROUP_LABELS[group] || group;
}
