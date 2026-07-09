import { buildBudgetAssignmentShares, normalizeBudgetAssignments } from './budget-shares.js';

function loadBudgetAssignments(database, entryId) {
  return database.prepare(`
    SELECT a.*, u.display_name, u.avatar_color, u.avatar_data
    FROM budget_entry_assignments a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.budget_entry_id = ?
    ORDER BY u.display_name COLLATE NOCASE ASC
  `).all(entryId);
}

function deleteBudgetAssignments(database, entryId) {
  database.prepare('DELETE FROM budget_entry_assignments WHERE budget_entry_id = ?').run(entryId);
}

function saveBudgetAssignments(database, entryId, amount, splitMethod, assignments) {
  deleteBudgetAssignments(database, entryId);
  const normalized = normalizeBudgetAssignments(assignments);
  if (!normalized.length) return [];
  const shares = normalized.length === 1
    ? [{ user_id: normalized[0].user_id, amount: Number(amount), amount_minor: 0, currency: 'EUR' }]
    : buildBudgetAssignmentShares({ amount, splitMethod, assignments: normalized });
  const shareMap = new Map(shares.map((share) => [share.user_id, share]));
  const insert = database.prepare(`
    INSERT INTO budget_entry_assignments (budget_entry_id, user_id, share_amount, share_percentage)
    VALUES (?, ?, ?, ?)
  `);
  for (const assignment of normalized) {
    const share = shareMap.get(assignment.user_id);
    insert.run(entryId, assignment.user_id, share?.amount ?? Number(amount), assignment.share_percentage);
  }
  return loadBudgetAssignments(database, entryId);
}

export { loadBudgetAssignments, deleteBudgetAssignments, saveBudgetAssignments };
