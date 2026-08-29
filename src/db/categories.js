export async function listCategories(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM categories WHERE user_id = ? AND archived = 0 ORDER BY name'
  ).bind(userId).all();
  return results;
}

export async function createCategory(db, userId, { name, parentId, kind }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO categories (id, user_id, name, parent_id, kind) VALUES (?, ?, ?, ?, ?)')
    .bind(id, userId, name, parentId || null, kind).run();
  return { id, user_id: userId, name, parent_id: parentId || null, kind };
}

export async function archiveCategory(db, userId, id) {
  const result = await db.prepare('UPDATE categories SET archived = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}

// Categorias padrão sugeridas no onboarding (seção 6 da especificação).
export const DEFAULT_CATEGORIES = [
  ['Moradia', 'despesa'], ['Alimentação', 'despesa'], ['Transporte', 'despesa'],
  ['Saúde', 'despesa'], ['Educação', 'despesa'], ['Lazer', 'despesa'],
  ['Assinaturas', 'despesa'], ['Compras', 'despesa'], ['Serviços', 'despesa'],
  ['Impostos', 'despesa'], ['Financiamentos', 'despesa'], ['Investimentos', 'despesa'],
  ['Outros', 'despesa'], ['Salário', 'receita'], ['Renda extra', 'receita']
];

export async function seedDefaultCategories(db, userId) {
  const statements = DEFAULT_CATEGORIES.map(([name, kind]) =>
    db.prepare('INSERT INTO categories (id, user_id, name, kind) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, name, kind)
  );
  await db.batch(statements);
}
