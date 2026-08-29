export async function getUserSettings(db, userId) {
  return db.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(userId).first();
}

export async function updateUserSettings(db, userId, fields) {
  const current = await getUserSettings(db, userId);
  if (!current) return null;

  const merged = {
    currency: fields.currency ?? current.currency,
    week_start: fields.weekStart ?? current.week_start,
    theme: fields.theme ?? current.theme,
    safety_margin_cents: fields.safetyMarginCents ?? current.safety_margin_cents,
    emergency_fund_target_months: fields.emergencyFundTargetMonths ?? current.emergency_fund_target_months,
    onboarding_completed: fields.onboardingCompleted !== undefined ? (fields.onboardingCompleted ? 1 : 0) : current.onboarding_completed
  };

  await db.prepare(
    `UPDATE user_settings SET currency = ?, week_start = ?, theme = ?, safety_margin_cents = ?,
       emergency_fund_target_months = ?, onboarding_completed = ?, updated_at = ?
     WHERE user_id = ?`
  ).bind(
    merged.currency, merged.week_start, merged.theme, merged.safety_margin_cents,
    merged.emergency_fund_target_months, merged.onboarding_completed, new Date().toISOString(), userId
  ).run();

  return { ...current, ...merged };
}
