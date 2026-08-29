// Um registro por dia por usuário (índice único no schema) — POST faz upsert.
export async function upsertEnergyLog(db, userId, payload) {
  const existing = await db.prepare('SELECT * FROM energy_logs WHERE user_id = ? AND date = ?')
    .bind(userId, payload.date).first();

  const fields = {
    energy: payload.energy ?? null,
    disposition: payload.disposition ?? null,
    stress: payload.stress ?? null,
    sleep_quality: payload.sleepQuality ?? null,
    workload: payload.workload ?? null,
    concentration: payload.concentration ?? null
  };

  if (existing) {
    await db.prepare(
      `UPDATE energy_logs SET energy = ?, disposition = ?, stress = ?, sleep_quality = ?, workload = ?, concentration = ?
       WHERE id = ?`
    ).bind(fields.energy, fields.disposition, fields.stress, fields.sleep_quality, fields.workload, fields.concentration, existing.id).run();
    return { ...existing, ...fields };
  }

  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO energy_logs (id, user_id, date, energy, disposition, stress, sleep_quality, workload, concentration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, payload.date, fields.energy, fields.disposition, fields.stress, fields.sleep_quality, fields.workload, fields.concentration).run();
  return { id, user_id: userId, date: payload.date, ...fields };
}

export async function listEnergyLogsInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM energy_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date'
  ).bind(userId, start, end).all();
  return results;
}

export async function getEnergyLogForDate(db, userId, date) {
  return db.prepare('SELECT * FROM energy_logs WHERE user_id = ? AND date = ?').bind(userId, date).first();
}
