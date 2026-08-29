// A autenticação de verdade é feita pelo Cloudflare Access, na frente do Worker
// (One-Time PIN por e-mail, configurado conforme manual-deploy-cloudflare.md).
// Nenhuma requisição chega aqui sem já ter passado por aquele login.
//
// O Access injeta o cabeçalho `Cf-Access-Authenticated-User-Email` em toda
// requisição autenticada. Este módulo só lê esse cabeçalho, confirma que ele
// existe (defesa em profundidade — se o Access estiver mal configurado e deixar
// passar uma requisição sem o cabeçalho, ainda assim bloqueamos aqui) e garante
// que existe uma linha correspondente em `users`.

import { seedDefaultCategories } from './../db/categories.js';

const ACCESS_EMAIL_HEADER = 'Cf-Access-Authenticated-User-Email';

export async function requireAccessUser(request, env) {
  const email = request.headers.get(ACCESS_EMAIL_HEADER);
  if (!email) return null; // sem o cabeçalho do Access, não há identidade confiável

  return findOrCreateUserByEmail(env.DB, email.trim().toLowerCase());
}

async function findOrCreateUserByEmail(db, email) {
  const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Primeiro acesso deste e-mail autorizado: provisiona a conta e as
  // configurações padrão numa única transação.
  await db.batch([
    db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(id, email, now),
    db.prepare(`INSERT INTO user_settings (user_id, currency, week_start, theme, safety_margin_cents, emergency_fund_target_months, updated_at)
                VALUES (?, 'BRL', 'monday', 'system', 0, 6, ?)`).bind(id, now)
  ]);

  // Categorias padrão (seção 6) já disponíveis desde o primeiro uso — o usuário
  // pode editar/arquivar depois, mas não começa com a tela vazia.
  await seedDefaultCategories(db, id);

  return { id, email, created_at: now };
}
