// The ONLY permission keys the system recognises. One place to change them.
//
// Keep this list in sync with PERMISSION_GROUPS in
// frontend/src/pages/SuperAdminDashboard.jsx (that list is what draws the
// checkboxes; this list is what the backend accepts). Any key that is not
// here is rejected when a super admin saves a user's permissions, so nobody
// can store made-up or wildcard ('*') permissions through the API.
const ALLOWED_PERMISSIONS = [
  // Audit
  'audit_view_calculations',
  'audit_add_comments',
  // Human Resources
  'hr_view_expenses',
  'hr_calculate_expenses',
  // Finance
  'finance_add_payments',
  'finance_view_payments',
  'finance_edit_payments',
  'finance_delete_payments',
  // Academic / Non-Academic Staff
  'staff_view_salary_receipts',
  // Petty Cash (accountant: records petty cash spending + issues vouchers)
  'petty_cash_manage',
];

module.exports = { ALLOWED_PERMISSIONS };