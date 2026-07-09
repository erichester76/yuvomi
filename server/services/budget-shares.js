import { buildSplits, parseMoneyToMinor, minorToDecimal } from './split-expenses.js';

const BUDGET_SPLIT_METHODS = ['equal', 'exact', 'percentage'];

function normalizeBudgetSplitMethod(value) {
  return BUDGET_SPLIT_METHODS.includes(value) ? value : 'equal';
}

function normalizeBudgetAssignments(assignments = []) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const seen = new Set();
  return rows
    .map((row) => ({
      user_id: Number(row?.user_id),
      share_amount: row?.share_amount == null || row.share_amount === '' ? null : Number(row.share_amount),
      share_percentage: row?.share_percentage == null || row.share_percentage === '' ? null : Number(row.share_percentage),
    }))
    .filter((row) => Number.isInteger(row.user_id) && row.user_id > 0 && !seen.has(row.user_id) && seen.add(row.user_id));
}

function buildBudgetAssignmentShares({ amount, currency = 'EUR', splitMethod = 'equal', assignments = [] }) {
  const normalized = normalizeBudgetAssignments(assignments);
  if (!normalized.length) return [];
  const sign = Number(amount) < 0 ? -1 : 1;
  const absAmount = Math.abs(Number(amount || 0));
  const amountMinor = parseMoneyToMinor(absAmount.toFixed(2), currency, 'amount');
  const participants = normalized.map((row) => row.user_id);
  const splits = normalizeBudgetSplitMethod(splitMethod) === 'equal'
    ? []
    : normalized.map((row) => normalizeBudgetSplitMethod(splitMethod) === 'exact'
      ? { user_id: row.user_id, amount: Number(row.share_amount || 0).toFixed(2) }
      : { user_id: row.user_id, percentage: Number(row.share_percentage || 0).toFixed(2) });
  return buildSplits({
    method: normalizeBudgetSplitMethod(splitMethod),
    amountMinor,
    currency,
    participants,
    splits,
  }).map((row) => ({
    user_id: row.user_id,
    amount: sign * Number(minorToDecimal(row.amount_minor, currency)),
    amount_minor: sign * row.amount_minor,
    currency,
  }));
}

function budgetAssignmentsToExpenseSplits({ amount, currency = 'EUR', splitMethod = 'equal', assignments = [] }) {
  const normalized = normalizeBudgetAssignments(assignments);
  if (!normalized.length) return [];
  const amountMinor = parseMoneyToMinor(Math.abs(Number(amount || 0)).toFixed(2), currency, 'amount');
  const participants = normalized.map((row) => row.user_id);
  if (normalized.length === 1) {
    return [{ user_id: normalized[0].user_id, amount_minor: amountMinor, currency }];
  }

  const method = normalizeBudgetSplitMethod(splitMethod);
  const splits = method === 'equal'
    ? []
    : normalized.map((row) => method === 'exact'
      ? { user_id: row.user_id, amount: Math.abs(Number(row.share_amount || 0)).toFixed(2) }
      : { user_id: row.user_id, percentage: Number(row.share_percentage || 0).toFixed(2) });

  return buildSplits({
    method,
    amountMinor,
    currency,
    participants,
    splits,
  });
}

export {
  BUDGET_SPLIT_METHODS,
  normalizeBudgetAssignments,
  normalizeBudgetSplitMethod,
  buildBudgetAssignmentShares,
  budgetAssignmentsToExpenseSplits,
};
