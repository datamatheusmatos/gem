import { jsonError, jsonOk } from '../shared/http.js';
import { rowsToCsv } from '../shared/csv.js';
import { exportAllData, wipeAllData, restoreAllData } from '../db/backup.js';

export async function handleBackup(request, env, segments) {
  const action = segments[0];
  const db = env.DB;
  const userId = request.user.id;

  if (action === 'export' && segments[1] === 'csv' && request.method === 'GET') {
    return exportCsv(request, db, userId);
  }

  if (action === 'export' && request.method === 'GET') {
    const backup = await exportAllData(db, userId);
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gem-backup-${backup.exportedAt.slice(0, 10)}.json"`
      }
    });
  }

  if (action === 'restore' && request.method === 'POST') {
    return restoreRoute(request, db, userId);
  }

  return jsonError('Rota de backup não encontrada.', 404);
}

async function exportCsv(request, db, userId) {
  const url = new URL(request.url);
  const table = url.searchParams.get('table');
  if (!table) return jsonError('Informe a tabela a exportar (?table=transactions, por exemplo).');

  const backup = await exportAllData(db, userId);
  if (!(table in backup.tables)) {
    return jsonError(`Tabela "${table}" não existe ou não pode ser exportada.`, 404);
  }

  const csv = rowsToCsv(backup.tables[table]);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${table}.csv"`
    }
  });
}

// Restauração é uma operação destrutiva (apaga os dados atuais antes de
// reinserir o backup) — por isso exige confirmação explícita no corpo da
// requisição, nunca é feita "por engano" (seção 36: "nunca destruir dados
// existentes durante importações sem confirmação").
async function restoreRoute(request, db, userId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  if (body.confirmWipe !== true) {
    return jsonError('Restaurar um backup apaga todos os seus dados atuais antes de reimportar. Envie "confirmWipe": true para confirmar que você entende isso.');
  }

  if (!body.backup || typeof body.backup !== 'object' || !body.backup.tables) {
    return jsonError('Arquivo de backup inválido — envie o JSON exportado por /api/backup/export sem modificar sua estrutura.');
  }

  await wipeAllData(db, userId);
  const result = await restoreAllData(db, userId, body.backup.tables);

  return jsonOk({ ok: true, restoredRows: result.restored });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
