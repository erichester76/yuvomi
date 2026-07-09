const RECURRENCE_INTERVAL_KEYS = ['monthly', 'half_year', 'yearly'];

function monthsPerInterval(interval) {
  return interval === 'yearly' ? 12 : interval === 'half_year' ? 6 : 1;
}

function effectiveMonthly(amount, interval) {
  return cents(Number(amount || 0) / monthsPerInterval(interval));
}

function cents(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function generateRecurringInstances(database, month) {
  const [y, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd   = `${month}-31`;
  const originals = database.prepare(`
    SELECT * FROM budget_entries
    WHERE is_recurring = 1 AND recurrence_parent_id IS NULL
      AND strftime('%Y-%m', date) < ?
  `).all(month);

  for (const orig of originals) {
    const skipped = database.prepare(
      'SELECT 1 FROM budget_recurrence_skipped WHERE parent_id = ? AND month = ?'
    ).get(orig.id, month);
    if (skipped) continue;

    const existing = database.prepare(`
      SELECT id FROM budget_entries
      WHERE recurrence_parent_id = ? AND date BETWEEN ? AND ?
    `).get(orig.id, monthStart, monthEnd);
    if (existing) continue;

    const interval = orig.recurrence_interval || 'monthly';
    if (!orig.recurrence_virtual) {
      const [oy, om] = orig.date.split('-').map(Number);
      const monthsDiff = (y - oy) * 12 + (m - om);
      if (monthsDiff < 1 || monthsDiff % monthsPerInterval(interval) !== 0) continue;
    }

    const origDay    = parseInt(orig.date.split('-')[2], 10);
    const lastDay    = new Date(y, m, 0).getDate();
    const instanceDay = Math.min(origDay, lastDay);
    const instanceDate = `${month}-${String(instanceDay).padStart(2, '0')}`;

    database.prepare(`
      INSERT INTO budget_entries
        (title, amount, category, subcategory, date, is_recurring, recurrence_parent_id, created_by)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(orig.title, orig.amount, orig.category, orig.subcategory || '', instanceDate, orig.id, orig.created_by);
  }
}

export { RECURRENCE_INTERVAL_KEYS, monthsPerInterval, effectiveMonthly, generateRecurringInstances };
