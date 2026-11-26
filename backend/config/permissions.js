// The ONLY permission keys the system recognises. One place to change them.
//
// Keep this list in sync with PERMISSION_GROUPS in
// frontend/src/pages/SuperAdminDashboard.jsx (that list is what draws the
// checkboxes; this list is what the backend accepts). Any key that is not
// here is rejected when a super admin saves a user's permissions, so nobody
// can store made-up or wildcard ('*') permissions through the API.
const ALLOWED_PERMISSIONS = [
  // Constructions (contractors, payments, hardware, project summary)
  'constructions_view',
  'constructions_add',
  'constructions_edit',
  'constructions_delete',
  // Office Expenses
  'office_expenses_view',
  'office_expenses_add',
  'office_expenses_edit',
  'office_expenses_delete',
  // Grand Total (read-only overview of all the money)
  'grand_total_view',
  // Finance (OLD keys, kept so users saved before the Constructions / Office
  // Expenses split keep their access. The User Management screen converts
  // them into the new keys the next time the super admin saves that user.)
  'finance_add_payments',
  'finance_view_payments',
  'finance_edit_payments',
  'finance_delete_payments',
  // Petty Cash (accountant: records petty cash spending + issues vouchers)
  'petty_cash_manage',
  'lecturer_salary_manage',
  // Staff Salary (accountant: adds locations + staff and creates the monthly salaries)
  'staff_salary_manage',
];

module.exports = { ALLOWED_PERMISSIONS };