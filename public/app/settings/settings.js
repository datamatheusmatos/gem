import { api } from '../api.js';
import { setCurrency } from '../format.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <h1 class="page-title">Configurações</h1>
    <form class="form-grid card" id="settings-form">
      <div><label>Moeda</label><input type="text" name="currency" maxlength="3" style="text-transform:uppercase;"></div>
      <div><label>Início da semana</label>
        <select name="weekStart">
          <option value="monday">Segunda-feira</option>
          <option value="sunday">Domingo</option>
        </select>
      </div>
      <div><label>Tema</label>
        <select name="theme">
          <option value="system">Automático (sistema)</option>
          <option value="dark">Escuro</option>
          <option value="light">Claro</option>
        </select>
      </div>
      <div><label>Margem de segurança mensal (R$)</label><input type="number" name="safetyMargin" step="0.01" min="0"></div>
      <div><label>Meta de reserva de emergência (meses de despesas)</label><input type="number" name="emergencyFundTargetMonths" min="1" max="24" step="0.5"></div>
      <button type="submit" class="btn btn-primary">Salvar configurações</button>
      <div class="form-msg" id="settings-msg"></div>
    </form>

    <div class="section-title">Backup e restauração</div>
    <div class="card">
      <p class="page-subtitle" style="margin-top:0;">Exporte seus dados regularmente — é a única forma de recuperá-los se algo der errado.</p>
      <div class="form-row-2">
        <button class="btn btn-secondary" id="export-json-btn">Baixar backup completo (JSON)</button>
        <button class="btn btn-secondary" id="export-csv-btn">Baixar transações (CSV)</button>
      </div>
      <button class="btn btn-danger btn-block" id="restore-btn" style="margin-top:10px;">Restaurar de um backup</button>
      <input type="file" id="restore-file-input" accept="application/json" style="display:none;">
      <div class="form-msg" id="backup-msg"></div>
    </div>
  `;

  document.getElementById('export-json-btn').onclick = () => {
    window.location.href = '/api/backup/export';
  };
  document.getElementById('export-csv-btn').onclick = () => {
    window.location.href = '/api/backup/export/csv?table=transactions';
  };

  const fileInput = document.getElementById('restore-file-input');
  document.getElementById('restore-btn').onclick = () => fileInput.click();

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const backupMsg = document.getElementById('backup-msg');
    backupMsg.classList.remove('error');

    if (!confirm('Restaurar este backup vai APAGAR todos os seus dados atuais e substituir pelo conteúdo do arquivo. Esta ação não pode ser desfeita. Continuar?')) {
      fileInput.value = '';
      return;
    }

    backupMsg.textContent = 'Restaurando...';
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await api('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ confirmWipe: true, backup })
      });
      backupMsg.textContent = `Restauração concluída: ${result.restoredRows} registros importados.`;
    } catch (err) {
      backupMsg.textContent = err.message; backupMsg.classList.add('error');
    } finally {
      fileInput.value = '';
    }
  });

  const form = document.getElementById('settings-form');
  const msg = document.getElementById('settings-msg');

  try {
    const { settings } = await api('/settings');
    form.currency.value = settings.currency;
    form.weekStart.value = settings.weekStart;
    form.theme.value = settings.theme;
    form.safetyMargin.value = settings.safetyMargin;
    form.emergencyFundTargetMonths.value = settings.emergencyFundTargetMonths;
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      const { settings } = await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          currency: fd.get('currency').toUpperCase(),
          weekStart: fd.get('weekStart'),
          theme: fd.get('theme'),
          safetyMargin: fd.get('safetyMargin') || 0,
          emergencyFundTargetMonths: parseFloat(fd.get('emergencyFundTargetMonths')) || undefined
        })
      });
      setCurrency(settings.currency);
      msg.textContent = 'Configurações salvas.';
      msg.classList.remove('error');
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
