// Toda query SQL relacionada a usuário vive aqui — nenhuma rota escreve SQL direto.
// Identidade vem do Cloudflare Access (ver src/auth/access.js); não há senha aqui.

export async function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
}

export async function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}
