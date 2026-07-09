import { loadBudgetAssignments } from './budget-assignment-store.js';

function loadBudgetEntryWithMeta(database, id) {
  const row = database.prepare(`
    SELECT b.*, u.display_name AS creator_name,
           p.id AS loan_payment_id,
           p.loan_id AS loan_id,
           p.installment_number AS loan_installment_number,
           l.title AS loan_title,
           l.borrower AS loan_borrower
    FROM budget_entries b
    LEFT JOIN users u ON u.id = b.created_by
    LEFT JOIN budget_loan_payments p ON p.budget_entry_id = b.id
    LEFT JOIN budget_loans l ON l.id = p.loan_id
    WHERE b.id = ?
  `).get(id);
  if (!row) return null;
  return { ...row, assignments: loadBudgetAssignments(database, id) };
}

export { loadBudgetEntryWithMeta };
