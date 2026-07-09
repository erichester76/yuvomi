function aggregateBudgetRows(rows, bucketKeys, granularity) {
  const totals = { income: 0, expenses: 0, balance: 0 };
  const byCategoryMap = new Map();
  const byPeriodMap = new Map();
  for (const key of bucketKeys) byPeriodMap.set(key, { period: key, income: 0, expenses: 0, balance: 0 });

  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (amount > 0) totals.income += amount;
    if (amount < 0) totals.expenses += amount;
    totals.balance += amount;

    const category = row.category || '';
    const current = byCategoryMap.get(category) || { category, income: 0, expenses: 0, total: 0 };
    if (amount > 0) current.income += amount;
    if (amount < 0) current.expenses += amount;
    current.total += amount;
    byCategoryMap.set(category, current);

    const period = granularity === 'month' ? String(row.date || '').slice(0, 7) : row.date;
    const bucket = byPeriodMap.get(period);
    if (bucket) {
      if (amount > 0) bucket.income += amount;
      if (amount < 0) bucket.expenses += amount;
      bucket.balance += amount;
    }
  }

  return {
    totals,
    byCategory: [...byCategoryMap.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    series: bucketKeys.map((key) => byPeriodMap.get(key) || { period: key, income: 0, expenses: 0, balance: 0 }),
  };
}

function loadPersonalBudgetRows(database, from, to, viewerId) {
  return database.prepare(`
    SELECT b.*,
           CASE WHEN a.id IS NOT NULL THEN COALESCE(a.share_amount, b.amount) ELSE b.amount END AS effective_amount,
           a.share_percentage,
           u.display_name AS creator_name,
           owner.display_name AS owner_name,
           CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS is_assigned_share,
           (SELECT COUNT(*) FROM budget_entry_assignments ba WHERE ba.budget_entry_id = b.id) AS assignee_count
    FROM budget_entries b
    LEFT JOIN budget_entry_assignments a ON a.budget_entry_id = b.id AND a.user_id = ?
    LEFT JOIN users u ON u.id = b.created_by
    LEFT JOIN users owner ON owner.id = COALESCE(b.owner_user_id, b.created_by)
    WHERE b.date BETWEEN ? AND ?
      AND (
        COALESCE(b.owner_user_id, b.created_by) = ?
        OR
        a.id IS NOT NULL
        OR (
          NOT EXISTS (SELECT 1 FROM budget_entry_assignments ba WHERE ba.budget_entry_id = b.id)
          AND COALESCE(b.owner_user_id, b.created_by) = ?
        )
      )
    ORDER BY b.date DESC, b.created_at DESC
  `).all(viewerId, from, to, viewerId, viewerId).map((row) => ({
    ...row,
    amount: Number(row.effective_amount),
    source_type: 'budget',
    source_id: row.id,
    is_readonly: Number(row.owner_user_id || row.created_by) !== Number(viewerId) ? 1 : 0,
  }));
}

function resolveBudgetOwnerUserId(createdBy, assignments = []) {
  const normalized = Array.isArray(assignments) ? assignments.filter((row) => Number.isInteger(Number(row?.user_id)) && Number(row.user_id) > 0) : [];
  if (normalized.length === 1) return Number(normalized[0].user_id);
  return Number(createdBy);
}

export { aggregateBudgetRows, loadPersonalBudgetRows, resolveBudgetOwnerUserId };
