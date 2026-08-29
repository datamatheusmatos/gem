import { jsonError, jsonOk } from '../shared/http.js';
import { fromCents } from '../shared/money.js';
import { FinancialEngine } from '../engine/FinancialEngine.js';
import { budgetStatusForPeriod } from '../db/budgets.js';
import { sumIncomeInRange, sumExpensesInRange } from '../db/financeSummary.js';
import { listTimeEntriesInRange } from '../db/timeEntries.js';
import { summarizeTimeByCategory } from '../engine/timeCalc.js';
import { listFocusSessionsInRange } from '../db/focusSessions.js';
import { calculateFocusStats } from '../engine/focusCalc.js';
import {
  expensesByCategoryInRange, studyHoursInRange, habitsComplianceSummary, projectsProgressSummary
} from '../db/reports.js';
import { percentChange, weekRange, previousWeekRange, previousMonth } from '../engine/reportsCalc.js';
import { validateMonthFormat, validateDateFormat } from '../shared/validation.js';

export async function handleReports(request, env, segments) {
  const action = segments[0];
  const db = env.DB;
  const userId = request.user.id;
  const url = new URL(request.url);

  if (action === 'financial' && request.method === 'GET') {
    const range = requireRange(url);
    if (!range) return jsonError('Informe o intervalo (start e end).');
    const startError = validateDateFormat(range.start, 'Data inicial');
    if (startError) return jsonError(startError);
    const endError = validateDateFormat(range.end, 'Data final');
    if (endError) return jsonError(endError);
    return financialReport(db, userId, range);
  }
  if (action === 'time' && request.method === 'GET') {
    const range = requireRange(url);
    if (!range) return jsonError('Informe o intervalo (start e end).');
    const startError = validateDateFormat(range.start, 'Data inicial');
    if (startError) return jsonError(startError);
    const endError = validateDateFormat(range.end, 'Data final');
    if (endError) return jsonError(endError);
    return timeReport(db, userId, range);
  }
  if (action === 'weekly-review' && request.method === 'GET') {
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const dateError = validateDateFormat(date, 'Data');
    if (dateError) return jsonError(dateError);
    return weeklyReview(db, userId, date);
  }
  if (action === 'monthly-review' && request.method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const monthError = validateMonthFormat(month);
    if (monthError) return jsonError(monthError);
    return monthlyReview(db, userId, month);
  }

  return jsonError('Rota de relatórios não encontrada.', 404);
}

function requireRange(url) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  return start && end ? { start, end } : null;
}

async function financialReport(db, userId, range) {
  if (!range) return jsonError('Informe o intervalo (start e end).');

  const [income, expenses, byCategory] = await Promise.all([
    sumIncomeInRange(db, userId, range),
    sumExpensesInRange(db, userId, range),
    expensesByCategoryInRange(db, userId, range)
  ]);

  const financialEngine = new FinancialEngine(db);
  const netWorth = await financialEngine.calculateNetWorth(userId);

  return jsonOk({
    income: fromCents(income),
    expenses: fromCents(expenses),
    net: fromCents(income - expenses),
    netWorth: fromCents(netWorth),
    expensesByCategory: byCategory.map(c => ({ category: c.category_name, total: fromCents(c.total_cents) }))
  });
}

async function timeReport(db, userId, range) {
  if (!range) return jsonError('Informe o intervalo (start e end).');

  const entries = await listTimeEntriesInRange(db, userId, range);
  const focusSessions = await listFocusSessionsInRange(db, userId, {
    start: `${range.start}T00:00:00Z`, end: `${range.end}T23:59:59Z`
  });
  const studyMinutes = await studyHoursInRange(db, userId, range);
  const habitsCompliance = await habitsComplianceSummary(db, userId, range);
  const projects = await projectsProgressSummary(db, userId);

  return jsonOk({
    timeByCategory: minutesToHours(summarizeTimeByCategory(entries)),
    focus: calculateFocusStats(focusSessions),
    studyHours: Math.round((studyMinutes / 60) * 10) / 10,
    habitsCompliance,
    projects
  });
}

async function weeklyReview(db, userId, date) {
  const current = weekRange(date);
  const previous = previousWeekRange(date);

  const [currentIncome, currentExpenses, previousIncome, previousExpenses] = await Promise.all([
    sumIncomeInRange(db, userId, current),
    sumExpensesInRange(db, userId, current),
    sumIncomeInRange(db, userId, previous),
    sumExpensesInRange(db, userId, previous)
  ]);

  const currentEntries = await listTimeEntriesInRange(db, userId, current);
  const currentFocus = await listFocusSessionsInRange(db, userId, {
    start: `${current.start}T00:00:00Z`, end: `${current.end}T23:59:59Z`
  });
  const currentStudyMinutes = await studyHoursInRange(db, userId, current);
  const habitsCompliance = await habitsComplianceSummary(db, userId, current);

  return jsonOk({
    period: current,
    financial: {
      income: fromCents(currentIncome),
      expenses: fromCents(currentExpenses),
      incomeChangePercent: percentChange(currentIncome, previousIncome),
      expensesChangePercent: percentChange(currentExpenses, previousExpenses)
    },
    time: minutesToHours(summarizeTimeByCategory(currentEntries)),
    focusStats: calculateFocusStats(currentFocus),
    studyHours: Math.round((currentStudyMinutes / 60) * 10) / 10,
    habitsCompliance
  });
}

async function monthlyReview(db, userId, month) {
  const range = { start: `${month}-01`, end: `${month}-31` };
  const prevMonth = previousMonth(month);
  const prevRange = { start: `${prevMonth}-01`, end: `${prevMonth}-31` };

  const [income, expenses, prevIncome, prevExpenses] = await Promise.all([
    sumIncomeInRange(db, userId, range),
    sumExpensesInRange(db, userId, range),
    sumIncomeInRange(db, userId, prevRange),
    sumExpensesInRange(db, userId, prevRange)
  ]);

  const financialEngine = new FinancialEngine(db);
  const netWorth = await financialEngine.calculateNetWorth(userId);
  const savingsRate = await financialEngine.calculateSavingsRate(userId, month);
  const budgets = await budgetStatusForPeriod(db, userId, month);
  const studyMinutes = await studyHoursInRange(db, userId, range);
  const habitsCompliance = await habitsComplianceSummary(db, userId, range);
  const projects = await projectsProgressSummary(db, userId);

  return jsonOk({
    month,
    financial: {
      income: fromCents(income),
      expenses: fromCents(expenses),
      incomeChangePercent: percentChange(income, prevIncome),
      expensesChangePercent: percentChange(expenses, prevExpenses),
      netWorth: fromCents(netWorth),
      savingsRatePercent: savingsRate,
      budgets: budgets.map(b => ({ category: b.category_name, percentUsed: b.percent_used, noLimitDefined: b.no_limit_defined }))
    },
    development: {
      studyHours: Math.round((studyMinutes / 60) * 10) / 10,
      habitsCompliance,
      projects
    }
  });
}

function minutesToHours(totalsByCategory) {
  const out = {};
  for (const [cat, minutes] of Object.entries(totalsByCategory)) {
    out[cat] = Math.round((minutes / 60) * 10) / 10;
  }
  return out;
}
