// What each permission group (the checkboxes in User Management) shows on the
// normal user dashboard.
//
// KEEP IN SYNC with PERMISSION_GROUPS in pages/SuperAdminDashboard.jsx and
// ALLOWED_PERMISSIONS in backend/config/permissions.js.
//
// To add a new section later:
//   1. add the permission key in backend/config/permissions.js
//   2. add the checkbox in PERMISSION_GROUPS (SuperAdminDashboard.jsx)
//   3. add an entry below. `kind` ('petty-cash', 'constructions', ...) renders a real screen;
//      anything else renders the demo card until you build the real screen.
export const PERMISSION_SECTIONS = [
  {
    key: 'constructions',
    label: 'Constructions',
    icon: 'constructions',
    kind: 'constructions',
    permissions: [
      { key: 'constructions_view', label: 'View' },
      { key: 'constructions_add', label: 'Add' },
      { key: 'constructions_edit', label: 'Edit' },
      { key: 'constructions_delete', label: 'Delete' },
    ],
  },
  {
    key: 'office-expenses',
    label: 'Office Expenses',
    icon: 'office-expenses',
    kind: 'office-expenses',
    permissions: [
      { key: 'office_expenses_view', label: 'View' },
      { key: 'office_expenses_add', label: 'Add' },
      { key: 'office_expenses_edit', label: 'Edit' },
      { key: 'office_expenses_delete', label: 'Delete' },
    ],
  },
  {
    key: 'petty-cash',
    label: 'Petty Cash',
    icon: 'petty-cash',
    kind: 'petty-cash',
    roles: ['accountant'], // an Accountant always has Petty Cash
    permissions: [{ key: 'petty_cash_manage', label: 'Manage Petty Cash (Accountant)' }],
  },
  {
    key: 'lecturer-salary',
    label: 'Lecturer Salary',
    icon: 'lecturer-salary',
    kind: 'lecturer-salary',
    permissions: [{ key: 'lecturer_salary_manage', label: 'Manage Lecturer Salary (Accountant)' }],
  },
  {
    key: 'staff-salary',
    label: 'Staff Salary',
    icon: 'staff-salary',
    kind: 'staff-salary',
    permissions: [{ key: 'staff_salary_manage', label: 'Manage Staff Salary (Accountant)' }],
  },
  {
    key: 'grand-total',
    label: 'Grand Total',
    icon: 'section-c',
    kind: 'grand-total',
    permissions: [{ key: 'grand_total_view', label: 'View Grand Total' }],
  },
];

// Old finance_* keys (saved before Constructions / Office Expenses had their own)
// count as the matching key of both areas.
export const withLegacyFinance = (owned) => {
  const out = [...owned];
  ['view', 'add', 'edit', 'delete'].forEach((action) => {
    if (owned.includes(`finance_${action}_payments`)) {
      out.push(`constructions_${action}`, `office_expenses_${action}`);
    }
  });
  return out;
};

// Does this user hold at least one permission of the section?
export const hasSectionAccess = (user, section) => {
  const owned = withLegacyFinance(user?.permissions || []);
  if (section.roles?.includes(user?.role)) return true;
  return section.permissions.some((p) => owned.includes(p.key));
};

// The sections this user may open = every group where they hold at least one permission.
export const sectionsForUser = (user) => {
  const owned = withLegacyFinance(user?.permissions || []);
  return PERMISSION_SECTIONS.filter((section) => section.permissions.some((p) => owned.includes(p.key)));
};