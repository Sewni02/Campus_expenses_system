// What each permission group (the checkboxes in User Management) shows on the
// normal user dashboard.
//
// KEEP IN SYNC with PERMISSION_GROUPS in pages/SuperAdminDashboard.jsx and
// ALLOWED_PERMISSIONS in backend/config/permissions.js.
//
// To add a new section later:
//   1. add the permission key in backend/config/permissions.js
//   2. add the checkbox in PERMISSION_GROUPS (SuperAdminDashboard.jsx)
//   3. add an entry below. `kind: 'petty-cash'` renders a real screen;
//      anything else renders the demo card until you build the real screen.
export const PERMISSION_SECTIONS = [
  {
    key: 'lecturer-salary',
    label: 'Lecturer Salary',
    kind: 'lecturer-salary',
    description: 'Add lecturers and bank details, enter attendance and submit salaries for verification.',
    permissions: [{ key: 'lecturer_salary_manage', label: 'Manage Lecturer Salary (Accountant)' }],
  },
  {
    key: 'staff-salary',
    label: 'Staff Salary',
    kind: 'staff-salary',
    description: 'Add staff by location and create their monthly salaries (allowances and deductions).',
    permissions: [{ key: 'staff_salary_manage', label: 'Manage Staff Salary (Accountant)' }],
  },
  {
    key: 'petty-cash',
    label: 'Petty Cash',
    kind: 'petty-cash',
    permissions: [{ key: 'petty_cash_manage', label: 'Manage Petty Cash (Accountant)' }],
  },
  {
    key: 'finance',
    label: 'Finance',
    kind: 'demo',
    description: 'Payments handled by the finance team.',
    permissions: [
      { key: 'finance_add_payments', label: 'Add Payments' },
      { key: 'finance_view_payments', label: 'View Payments' },
      { key: 'finance_edit_payments', label: 'Edit Payments' },
      { key: 'finance_delete_payments', label: 'Delete Payments' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit',
    kind: 'demo',
    description: 'Review calculations and leave audit comments.',
    permissions: [
      { key: 'audit_view_calculations', label: 'View Calculations' },
      { key: 'audit_add_comments', label: 'Add Comments' },
    ],
  },
  {
    key: 'hr',
    label: 'Human Resources',
    kind: 'demo',
    description: 'Staff expense information for HR.',
    permissions: [
      { key: 'hr_view_expenses', label: 'View Expenses' },
      { key: 'hr_calculate_expenses', label: 'Calculate Expenses' },
    ],
  },
  {
    key: 'staff',
    label: 'Academic / Non-Academic Staff',
    kind: 'demo',
    description: 'Staff self-service.',
    permissions: [{ key: 'staff_view_salary_receipts', label: 'View Salary Receipts' }],
  },
];

// The sections this user may see = every group where they hold at least one permission.
export const sectionsForUser = (user) => {
  const owned = user?.permissions || [];
  return PERMISSION_SECTIONS.filter((section) => section.permissions.some((p) => owned.includes(p.key)));
};