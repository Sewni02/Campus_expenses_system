import { useState, useEffect } from 'react';
import useTabState from '../hooks/useTabState';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './SuperAdminDashboard.css';

// ---------- Shared input sanitizers & formatters ----------
// Name fields: letters and spaces only (no digits, no special characters)
const sanitizeNameInput = (value) => value.replace(/[^A-Za-z\s]/g, '');

// Phone fields: digits only, capped at 10 digits
const sanitizePhoneInput = (value) => value.replace(/\D/g, '').slice(0, 10);

// Money fields: digits + a single decimal point only
const sanitizeAmountInput = (value) => {
  let cleaned = value.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
};

// Displays any number as "LKR 12,345.00"
const formatLKR = (value) => {
  const num = Number(value) || 0;
  return `LKR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Common Sri Lankan banks shown in every bank-name dropdown.
const SRI_LANKAN_BANKS = [
  'Bank of Ceylon',
  'People\'s Bank',
  'Commercial Bank of Ceylon',
  'Hatton National Bank',
  'Sampath Bank',
  'Seylan Bank',
  'National Savings Bank',
  'Nations Trust Bank',
  'DFCC Bank',
  'Pan Asia Banking Corporation',
  'Union Bank of Colombo',
  'NDB Bank',
  'Amana Bank',
  'Cargills Bank',
  'HSBC',
  'Standard Chartered Bank',
];

// A bank-name field: a dropdown of common Sri Lankan banks, with an
// "Other" option that reveals a text input for anything not listed
// (also used so an auto-filled value that isn't in the list still shows up).
function BankNameField({ value, onChange, required = false }) {
  const isKnownBank = value === '' || SRI_LANKAN_BANKS.includes(value);
  const [addingOther, setAddingOther] = useState(!isKnownBank);

  useEffect(() => {
    setAddingOther(!(value === '' || SRI_LANKAN_BANKS.includes(value)));
  }, [value]);

  const handleSelectChange = (e) => {
    if (e.target.value === '__other__') {
      setAddingOther(true);
      onChange('');
    } else {
      setAddingOther(false);
      onChange(e.target.value);
    }
  };

  if (addingOther) {
    return (
      <input
        type="text"
        placeholder="Bank name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    );
  }

  return (
    <select value={value} onChange={handleSelectChange} required={required}>
      <option value="">Select bank...</option>
      {SRI_LANKAN_BANKS.map((bank) => (
        <option key={bank} value={bank}>{bank}</option>
      ))}
      <option value="__other__">Other...</option>
    </select>
  );
}

// Every project name that currently exists anywhere in the system
// (estimation plans, contractor/hardware/other payments), sorted A-Z.
// Shared by every form that needs to tag something with a project.
function useProjectNames() {
  const [projectNames, setProjectNames] = useState([]);

  const refetch = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/projects`);
      setProjectNames(res.data.projectNames || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return [projectNames, refetch];
}

// A project-name field that lets the user pick from the existing,
// alphabetically-sorted list of projects, or add a brand new one inline.
function ProjectNameField({ value, onChange, projectNames, required = true }) {
  const isKnownProject = value === '' || projectNames.includes(value);
  const [addingNew, setAddingNew] = useState(!isKnownProject);

  const handleSelectChange = (e) => {
    if (e.target.value === '__new__') {
      setAddingNew(true);
      onChange('');
    } else {
      setAddingNew(false);
      onChange(e.target.value);
    }
  };

  if (addingNew) {
    return (
      <div className="project-name-field">
        <input
          type="text"
          placeholder="New project / construction name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus
        />
        {projectNames.length > 0 && (
          <button
            type="button"
            className="project-name-back-link"
            onClick={() => {
              setAddingNew(false);
              onChange('');
            }}
          >
            Choose existing project instead
          </button>
        )}
      </div>
    );
  }

  return (
    <select value={value} onChange={handleSelectChange} required={required}>
      <option value="">Select project...</option>
      {projectNames.map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
      <option value="__new__">+ Add new project...</option>
    </select>
  );
}

const PERMISSION_GROUPS = [
  {
    category: 'Audit',
    options: [
      { key: 'audit_view_calculations', label: 'View Calculations' },
      { key: 'audit_add_comments', label: 'Add Comments' },
    ],
  },
  {
    category: 'Human Resources',
    options: [
      { key: 'hr_view_expenses', label: 'View Expenses' },
      { key: 'hr_calculate_expenses', label: 'Calculate Expenses' },
    ],
  },
  {
    category: 'Finance',
    options: [
      { key: 'finance_add_payments', label: 'Add Payments' },
      { key: 'finance_view_payments', label: 'View Payments' },
      { key: 'finance_edit_payments', label: 'Edit Payments' },
      { key: 'finance_delete_payments', label: 'Delete Payments' },
    ],
  },
  {
    category: 'Academic / Non-Academic Staff',
    options: [
      { key: 'staff_view_salary_receipts', label: 'View Salary Receipts' },
    ],
  },
];

function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useTabState('tab', 'A');

  const sidebarItems = [
    { key: 'A', label: 'User Management' },
    { key: 'B', label: 'Constructions' },
    { key: 'C', label: 'Section C' },
    { key: 'D', label: 'Section D' },
  ];

  return (
    <div className="sa-container">
      <div className="sa-sidebar">
        <div className="sa-sidebar-header">
          <div className="sa-avatar" />
          <p>Super Admin</p>
        </div>
        {sidebarItems.map((item) => (
          <div
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`sa-sidebar-item ${activeTab === item.key ? 'active' : ''}`}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div className="sa-content">
        <div style={{ display: activeTab === 'A' ? 'block' : 'none' }}>
          <UserManagement />
        </div>
        <div style={{ display: activeTab === 'B' ? 'block' : 'none' }}>
          <Constructions />
        </div>
        {activeTab === 'C' && <ComingSoon label="Section C" />}
        {activeTab === 'D' && <ComingSoon label="Section D" />}
      </div>
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="sa-coming-soon">
      <h2>{label}</h2>
      <p>This section will be built later.</p>
    </div>
  );
}

// ---------- Section A: User Management ----------
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0 });
  const [managingUser, setManagingUser] = useState(null);
  const [checkedPermissions, setCheckedPermissions] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/stats`);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openManagePanel = (user) => {
    setManagingUser(user);
    setCheckedPermissions(user.permissions || []);
  };

  const closeManagePanel = () => {
    setManagingUser(null);
    setCheckedPermissions([]);
  };

  const togglePermission = (key) => {
    setCheckedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!managingUser) return;
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${managingUser._id}/approve`,
        { permissions: checkedPermissions }
      );
      closeManagePanel();
      fetchUsers();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!managingUser) return;
    try {
      await axios.put(`${API_BASE_URL}/api/admin/users/${managingUser._id}/reject`);
      closeManagePanel();
      fetchUsers();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sa-page">
      <h1 className="sa-page-title">User Management</h1>

      <div className="sa-stats-row">
        <div className="sa-stat-card sa-stat-total">
          <p>Total Users</p>
          <h2>{stats.total}</h2>
        </div>
        <div className="sa-stat-card sa-stat-approved">
          <p>Access Granted</p>
          <h2>{stats.approved}</h2>
        </div>
        <div className="sa-stat-card sa-stat-rejected">
          <p>Rejected</p>
          <h2>{stats.rejected}</h2>
        </div>
      </div>

      <div className="sa-table-panel-row">
        <table className={`sa-table ${managingUser ? 'shrink' : ''}`}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              {!managingUser && <th>Role</th>}
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user._id}
                className={managingUser?._id === user._id ? 'selected-row' : ''}
              >
                <td>{user.name}</td>
                <td>{user.email}</td>
                {!managingUser && <td>{user.role}</td>}
                <td>
                  <span className={`sa-badge sa-badge-${user.status}`}>
                    {user.status}
                  </span>
                </td>
                <td>
                  <button className="sa-manage-btn" onClick={() => openManagePanel(user)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {managingUser && (
          <div className="sa-permission-panel">
            <div className="sa-panel-header">
              <h3>{managingUser.name}</h3>
              <span className="sa-close-btn" onClick={closeManagePanel}>✕</span>
            </div>
            <p className="sa-panel-email">{managingUser.email}</p>

            <div className="sa-permission-list">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.category} className="sa-permission-group">
                  <p className="sa-group-title">{group.category}</p>
                  {group.options.map((opt) => {
                    const isChecked = checkedPermissions.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className={`sa-checkbox-row ${isChecked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(opt.key)}
                        />
                        <span className="sa-checkbox-custom">
                          {isChecked && '✓'}
                        </span>
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="sa-panel-actions">
              <button className="sa-save-btn" onClick={handleSave}>Save</button>
              <button className="sa-reject-btn" onClick={handleReject}>Reject Request</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Section B: Constructions ----------
function Constructions() {
  const [subTab, setSubTab] = useTabState('sub', 'contractors');

  const subTabs = [
    { key: 'contractors', label: 'Contractors' },
    { key: 'payments', label: 'Payments' },
    { key: 'hardware', label: 'Hardware' },
    { key: 'projects', label: 'Project Summary' },
  ];

  return (
    <div className="sa-page">
      <h1 className="sa-page-title">Constructions</h1>

      <div className="ge-tabs">
        {subTabs.map((tab) => (
          <div
            key={tab.key}
            className={`ge-tab ${subTab === tab.key ? 'active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div style={{ display: subTab === 'contractors' ? 'block' : 'none' }}>
        <Contractors />
      </div>
      <div style={{ display: subTab === 'payments' ? 'block' : 'none' }}>
        <ConstructionPayments />
      </div>
      <div style={{ display: subTab === 'hardware' ? 'block' : 'none' }}>
        <Hardware />
      </div>
      <div style={{ display: subTab === 'projects' ? 'block' : 'none' }}>
        <ProjectSummary />
      </div>
    </div>
  );
}

// ---------- Sub-section: Contractors ----------
function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [projectNames, refetchProjectNames] = useProjectNames();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', registrationDate: '', accountNumber: '', bankName: '', bankBranch: '' });

  const [viewingContractor, setViewingContractor] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', registrationDate: '', accountNumber: '', bankName: '', bankBranch: '' });
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Estimation plans for the contractor currently being viewed
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ projectName: '', totalEstimate: '', note: '' });
  const [planFile, setPlanFile] = useState(null);
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);

  const [editingPlan, setEditingPlan] = useState(null); // the plan object being edited
  const [editPlanForm, setEditPlanForm] = useState({ projectName: '', totalEstimate: '', note: '' });
  const [editPlanFile, setEditPlanFile] = useState(null);
  const [isEditPlanSubmitting, setIsEditPlanSubmitting] = useState(false);

  useEffect(() => {
    fetchContractors();
  }, [searchTerm]);

  const fetchContractors = async () => {
    try {
      const url = searchTerm
        ? `${API_BASE_URL}/api/contractors?search=${encodeURIComponent(searchTerm)}`
        : `${API_BASE_URL}/api/contractors`;
      const res = await axios.get(url);
      setContractors(res.data);

      if (viewingContractor) {
        const updated = res.data.find((c) => c._id === viewingContractor._id);
        if (updated) setViewingContractor(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddContractor = async (e) => {
    e.preventDefault();
    if (isAddSubmitting) return;
    setIsAddSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/contractors`, formData);
      setContractors((prev) => [res.data.contractor, ...prev]);
      setFormData({ name: '', phone: '', registrationDate: '', accountNumber: '', bankName: '', bankBranch: '' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const openProfile = (contractor) => {
    setViewingContractor(contractor);
    setIsEditing(false);
    setShowPlanForm(false);
  };

  const closeProfile = () => {
    setViewingContractor(null);
    setIsEditing(false);
    setShowPlanForm(false);
  };

  const startEdit = () => {
    setEditForm({
      name: viewingContractor.name,
      phone: viewingContractor.phone,
      accountNumber: viewingContractor.accountNumber || '',
      bankName: viewingContractor.bankName || '',
      bankBranch: viewingContractor.bankBranch || '',
      registrationDate: viewingContractor.registrationDate
        ? new Date(viewingContractor.registrationDate).toISOString().slice(0, 10)
        : '',
    });
    setIsEditing(true);
  };

  const handleUpdateContractor = async (e) => {
    e.preventDefault();
    if (isEditSubmitting) return;
    setIsEditSubmitting(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/contractors/${viewingContractor._id}`, editForm);
      const updated = res.data.contractor;
      setContractors((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setViewingContractor(updated);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteContractor = async () => {
    if (!window.confirm(`Delete ${viewingContractor.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/contractors/${viewingContractor._id}`);
      setContractors((prev) => prev.filter((c) => c._id !== viewingContractor._id));
      closeProfile();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the contractor. Please check the backend server is running and try again.');
    }
  };

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!viewingContractor || isPlanSubmitting) return;
    setIsPlanSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', planForm.projectName);
      data.append('totalEstimate', planForm.totalEstimate);
      data.append('note', planForm.note);
      if (planFile) data.append('plan', planFile);

      const res = await axios.post(
        `${API_BASE_URL}/api/contractors/${viewingContractor._id}/plans`,
        data,
      );
      const updated = res.data.contractor;
      setContractors((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setViewingContractor(updated);
      setPlanForm({ projectName: '', totalEstimate: '', note: '' });
      setPlanFile(null);
      setShowPlanForm(false);
      refetchProjectNames();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlanSubmitting(false);
    }
  };

  const startEditPlan = (plan) => {
    setEditingPlan(plan);
    setEditPlanForm({
      projectName: plan.projectName || '',
      totalEstimate: plan.totalEstimate || '',
      note: plan.note || '',
    });
    setEditPlanFile(null);
  };

  const cancelEditPlan = () => {
    setEditingPlan(null);
    setEditPlanFile(null);
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan || isEditPlanSubmitting) return;
    setIsEditPlanSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', editPlanForm.projectName);
      data.append('totalEstimate', editPlanForm.totalEstimate);
      data.append('note', editPlanForm.note);
      if (editPlanFile) data.append('plan', editPlanFile);

      const res = await axios.put(
        `${API_BASE_URL}/api/contractors/${viewingContractor._id}/plans/${editingPlan._id}`,
        data,
      );
      const updated = res.data.contractor;
      setContractors((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setViewingContractor(updated);
      setEditingPlan(null);
      setEditPlanFile(null);
      refetchProjectNames();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditPlanSubmitting(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Delete this estimation plan? This cannot be undone.')) return;
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/contractors/${viewingContractor._id}/plans/${planId}`
      );
      const updated = res.data.contractor;
      setContractors((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setViewingContractor(updated);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the plan. Please check the backend server is running and try again.');
    }
  };

  const totalPaid = (contractor) =>
    contractor.payments.reduce((sum, p) => sum + p.amount, 0);

  const totalEstimated = (contractor) =>
    contractor.estimationPlans.reduce((sum, p) => sum + p.totalEstimate, 0);

  return (
    <div>
      <div className="ge-header">
        <h3 className="hw-inline-heading">Registered Contractors</h3>
        <button className="ge-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Contractor'}
        </button>
      </div>

      <div className="ge-form-row contractor-search-row">
        <input
          type="text"
          placeholder="Search contractor by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showForm && (
        <form className="ge-form" onSubmit={handleAddContractor}>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Contractor name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: sanitizeNameInput(e.target.value) })}
              required
            />
            <input
              type="text"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: sanitizePhoneInput(e.target.value) })}
              maxLength={10}
              required
            />
            <input
              type="date"
              value={formData.registrationDate}
              onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <input type="text" placeholder="Account number" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
            <BankNameField value={formData.bankName} onChange={(val) => setFormData({ ...formData, bankName: val })} />
            <input type="text" placeholder="Branch" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} />
          </div>
          <button type="submit" className="ge-save-btn" disabled={isAddSubmitting}>
            {isAddSubmitting ? 'Saving...' : 'Save Contractor'}
          </button>
        </form>
      )}

      <div className="sa-table-panel-row">
        <table className={`sa-table ${viewingContractor ? 'shrink' : ''}`}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              {!viewingContractor && <th>Registered On</th>}
              <th>Total Paid (LKR)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {contractors.length === 0 ? (
              <tr>
                <td colSpan="5" className="hw-empty-text">
                  No contractors found
                </td>
              </tr>
            ) : (
              contractors.map((c) => (
                <tr
                  key={c._id}
                  className={viewingContractor?._id === c._id ? 'selected-row' : ''}
                >
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  {!viewingContractor && <td>{new Date(c.registrationDate).toLocaleDateString()}</td>}
                  <td>{formatLKR(totalPaid(c))}</td>
                  <td>
                    <button className="sa-manage-btn" onClick={() => openProfile(c)}>
                      View Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* PROFILE PANEL - view / update / delete + estimation plans */}
        {viewingContractor && (
          <div className="sa-permission-panel">
            <div className="sa-panel-header">
              <h3>{isEditing ? 'Edit Contractor' : viewingContractor.name}</h3>
              <span className="sa-close-btn" onClick={closeProfile}>✕</span>
            </div>

            {!isEditing ? (
              <>
                <p className="sa-panel-email">{viewingContractor.phone}</p>
                <div className="ge-summary"><span>Account Number</span><span>{viewingContractor.accountNumber || '-'}</span></div>
                <div className="ge-summary"><span>Bank</span><span>{viewingContractor.bankName || '-'}</span></div>
                <div className="ge-summary"><span>Branch</span><span>{viewingContractor.bankBranch || '-'}</span></div>
                <div className="ge-summary contractor-summary-row">
                  <span>Registered On</span>
                  <span>{new Date(viewingContractor.registrationDate).toLocaleDateString()}</span>
                </div>
                <div className="ge-summary">
                  <span>Total Estimated (all plans)</span>
                  <span>{formatLKR(totalEstimated(viewingContractor))}</span>
                </div>
                <div className="ge-summary">
                  <span>Total Paid</span>
                  <span>{formatLKR(totalPaid(viewingContractor))}</span>
                </div>

                <div className="sa-panel-actions">
                  <button className="sa-save-btn" onClick={startEdit}>Update</button>
                  <button className="sa-reject-btn" onClick={handleDeleteContractor}>Delete</button>
                </div>

                {/* ---------- Estimation Plans ---------- */}
                <div className="plan-section">
                  <div className="ge-header plan-section-header">
                    <p className="sa-group-title plan-section-title">Estimation Plans</p>
                    <button
                      type="button"
                      className="hw-finder-add-btn"
                      onClick={() => setShowPlanForm(!showPlanForm)}
                    >
                      {showPlanForm ? 'Cancel' : '+ Add Plan'}
                    </button>
                  </div>

                  {showPlanForm && (
                    <form onSubmit={handleAddPlan} className="hw-item-form">
                      <div className="ge-form-row">
                        <ProjectNameField
                          value={planForm.projectName}
                          onChange={(val) => setPlanForm({ ...planForm, projectName: val })}
                          projectNames={projectNames}
                        />
                        <input
                          type="number"
                          placeholder="Total estimate (LKR)"
                          value={planForm.totalEstimate}
                          onChange={(e) => setPlanForm({ ...planForm, totalEstimate: sanitizeAmountInput(e.target.value) })}
                          required
                        />
                      </div>
                      <div className="ge-form-row">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => setPlanFile(e.target.files[0])}
                        />
                      </div>
                      <textarea
                        placeholder="Note (optional)"
                        value={planForm.note}
                        onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })}
                        rows={2}
                      />
                      <button type="submit" className="ge-save-btn" disabled={isPlanSubmitting}>
                        {isPlanSubmitting ? 'Saving...' : 'Save Plan'}
                      </button>
                    </form>
                  )}

                  {viewingContractor.estimationPlans.length === 0 ? (
                    <p className="hw-empty-text hw-empty-text-inline">No estimation plans uploaded yet.</p>
                  ) : (
                    <div className="plan-list">
                      {[...viewingContractor.estimationPlans]
                        .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }))
                        .map((plan) => (
                        <div key={plan._id} className="plan-card">
                          {editingPlan?._id === plan._id ? (
                            <form onSubmit={handleUpdatePlan} className="hw-item-form">
                              <div className="ge-form-row">
                                <ProjectNameField
                                  value={editPlanForm.projectName}
                                  onChange={(val) => setEditPlanForm({ ...editPlanForm, projectName: val })}
                                  projectNames={projectNames}
                                />
                                <input
                                  type="number"
                                  placeholder="Total estimate (LKR)"
                                  value={editPlanForm.totalEstimate}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, totalEstimate: e.target.value })}
                                  required
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Note (optional)"
                                value={editPlanForm.note}
                                onChange={(e) => setEditPlanForm({ ...editPlanForm, note: e.target.value })}
                              />
                              <input
                                type="file"
                                onChange={(e) => setEditPlanFile(e.target.files[0])}
                              />
                              <div className="sa-panel-actions">
                                <button type="submit" className="sa-save-btn" disabled={isEditPlanSubmitting}>
                                  {isEditPlanSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button type="button" className="sa-reject-btn" onClick={cancelEditPlan}>
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="plan-card-top">
                                <span className="plan-card-project">{plan.projectName}</span>
                                <span className="plan-card-amount">{formatLKR(plan.totalEstimate)}</span>
                              </div>
                              <div className="plan-card-bottom">
                                <span>{new Date(plan.uploadedDate).toLocaleDateString()}</span>
                                {plan.planFileUrl && (
                                  <a href={plan.planFileUrl} target="_blank" rel="noreferrer" className="ge-slip-link">
                                    View Plan
                                  </a>
                                )}
                                <button className="hw-edit-btn" onClick={() => startEditPlan(plan)}>
                                  Edit
                                </button>
                                <button className="hw-delete-btn" onClick={() => handleDeletePlan(plan._id)}>
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <form onSubmit={handleUpdateContractor}>
                <div className="auth-field contractor-edit-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: sanitizeNameInput(e.target.value) })}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: sanitizePhoneInput(e.target.value) })}
                    maxLength={10}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Registration Date</label>
                  <input
                    type="date"
                    value={editForm.registrationDate}
                    onChange={(e) => setEditForm({ ...editForm, registrationDate: e.target.value })}
                  />
                </div>
                <div className="auth-field">
                  <label>Account Number</label>
                  <input type="text" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} />
                </div>
                <div className="auth-field">
                  <label>Bank Name</label>
                  <BankNameField value={editForm.bankName} onChange={(val) => setEditForm({ ...editForm, bankName: val })} />
                </div>
                <div className="auth-field">
                  <label>Branch</label>
                  <input type="text" value={editForm.bankBranch} onChange={(e) => setEditForm({ ...editForm, bankBranch: e.target.value })} />
                </div>

                <div className="sa-panel-actions">
                  <button type="submit" className="sa-save-btn" disabled={isEditSubmitting}>
                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" className="sa-reject-btn" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Sub-section: Payments (general construction payments + contractor payments) ----------
function ConstructionPayments() {
  const [projectNames, refetchProjectNames] = useProjectNames();

  // Construction payments now go through an "invoice first" flow, same as
  // contractor and hardware payments: an invoice is raised (status
  // 'pending') and only gets its bank/payment details once finance
  // actually settles it (status flips to 'paid').
  const [payments, setPayments] = useState([]);
  const [invoiceTab, setInvoiceTab] = useTabState('inv', 'pending'); // 'pending' | 'paid'

  // Step 1: raise a new invoice - invoice-side details only, no bank info yet
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ title: '', amount: '', paidTo: '', projectName: '', date: '', description: '' });
  const [invoiceBillFile, setInvoiceBillFile] = useState(null);
  const [isInvoiceSubmitting, setIsInvoiceSubmitting] = useState(false);

  // Step 2: record the actual bank payment against a pending invoice
  const [payingInvoice, setPayingInvoice] = useState(null); // { paymentId, title }
  const [payDate, setPayDate] = useState('');
  const [payReferenceNo, setPayReferenceNo] = useState('');
  const [payAccountNumber, setPayAccountNumber] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payBankBranch, setPayBankBranch] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySlipFile, setPaySlipFile] = useState(null);
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);

  const [editingInvoice, setEditingInvoice] = useState(null); // { paymentId, status, title }
  const [editInvoiceForm, setEditInvoiceForm] = useState({
    title: '', amount: '', paidTo: '', projectName: '', date: '', description: '',
    referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', paymentDate: '', paymentNote: '',
  });
  const [isEditInvoiceSubmitting, setIsEditInvoiceSubmitting] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/construction-payments`);
      setPayments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({ title: '', amount: '', paidTo: '', projectName: '', date: '', description: '' });
    setInvoiceBillFile(null);
  };

  const resetPayForm = () => {
    setPayingInvoice(null);
    setPayDate('');
    setPayReferenceNo('');
    setPayAccountNumber('');
    setPayBankName('');
    setPayBankBranch('');
    setPayNote('');
    setPaySlipFile(null);
  };

  // STEP 1: raise an invoice for a general construction payment. No
  // payment/bank details are collected here - the invoice is created as
  // 'pending' and only gets paid details once it's actually settled.
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (isInvoiceSubmitting) return;
    setIsInvoiceSubmitting(true);
    try {
      const data = new FormData();
      data.append('title', invoiceForm.title);
      data.append('amount', invoiceForm.amount);
      data.append('paidTo', invoiceForm.paidTo);
      data.append('projectName', invoiceForm.projectName);
      if (invoiceForm.date) data.append('date', invoiceForm.date);
      data.append('description', invoiceForm.description);
      if (invoiceBillFile) data.append('bill', invoiceBillFile);

      await axios.post(`${API_BASE_URL}/api/construction-payments`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      resetInvoiceForm();
      setShowInvoiceForm(false);
      setInvoiceTab('pending');
      refetchProjectNames();
      fetchPayments();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not create the invoice. Please try again.');
    } finally {
      setIsInvoiceSubmitting(false);
    }
  };

  // Open the "record payment" form for a specific pending invoice.
  const startPayingInvoice = (payment) => {
    resetPayForm();
    setPayingInvoice({ paymentId: payment._id, title: payment.title });
    setPayAccountNumber(payment.accountNumber || '');
    setPayBankName(payment.bankName || '');
    setPayBankBranch(payment.bankBranch || '');
  };

  // STEP 2: record the actual bank payment made against a pending invoice.
  // This attaches the payment/bank details to that invoice and marks it paid.
  const handlePayInvoice = async (e) => {
    e.preventDefault();
    if (!payingInvoice || isPaySubmitting) return;
    setIsPaySubmitting(true);
    try {
      const data = new FormData();
      if (payDate) data.append('date', payDate);
      data.append('referenceNo', payReferenceNo);
      data.append('accountNumber', payAccountNumber);
      data.append('bankName', payBankName);
      data.append('bankBranch', payBankBranch);
      data.append('note', payNote);
      if (paySlipFile) data.append('slip', paySlipFile);

      await axios.put(
        `${API_BASE_URL}/api/construction-payments/${payingInvoice.paymentId}/pay`,
        data,
      );

      resetPayForm();
      setInvoiceTab('paid');
      fetchPayments();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not record the payment. Please try again.');
    } finally {
      setIsPaySubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/construction-payments/${paymentId}`);
      setPayments((prev) => prev.filter((p) => p._id !== paymentId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the invoice. Please check the backend server is running and try again.');
    }
  };

  const startEditInvoice = (payment) => {
    setEditingInvoice({
      paymentId: payment._id,
      status: payment.status,
      title: payment.title,
    });
    setEditInvoiceForm({
      title: payment.title || '',
      amount: payment.amount ?? '',
      paidTo: payment.paidTo || '',
      projectName: payment.projectName || '',
      date: payment.date ? new Date(payment.date).toISOString().slice(0, 10) : '',
      description: payment.description || '',
      referenceNo: payment.referenceNo || '',
      accountNumber: payment.accountNumber || '',
      bankName: payment.bankName || '',
      bankBranch: payment.bankBranch || '',
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0, 10) : '',
      paymentNote: payment.paymentNote || '',
    });
  };

  const closeEditInvoice = () => {
    setEditingInvoice(null);
    setEditInvoiceForm({
      title: '', amount: '', paidTo: '', projectName: '', date: '', description: '',
      referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', paymentDate: '', paymentNote: '',
    });
  };

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();
    if (!editingInvoice || isEditInvoiceSubmitting) return;
    setIsEditInvoiceSubmitting(true);
    try {
      const payload = {
        title: editInvoiceForm.title,
        amount: editInvoiceForm.amount,
        paidTo: editInvoiceForm.paidTo,
        projectName: editInvoiceForm.projectName,
        date: editInvoiceForm.date,
        description: editInvoiceForm.description,
      };
      if (editingInvoice.status === 'paid') {
        payload.referenceNo = editInvoiceForm.referenceNo;
        payload.accountNumber = editInvoiceForm.accountNumber;
        payload.bankName = editInvoiceForm.bankName;
        payload.bankBranch = editInvoiceForm.bankBranch;
        payload.paymentDate = editInvoiceForm.paymentDate;
        payload.paymentNote = editInvoiceForm.paymentNote;
      }
      await axios.put(
        `${API_BASE_URL}/api/construction-payments/${editingInvoice.paymentId}`,
        payload
      );
      closeEditInvoice();
      refetchProjectNames();
      fetchPayments();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not update the invoice. Please try again.');
    } finally {
      setIsEditInvoiceSubmitting(false);
    }
  };

  // A record is "paid" once it has been explicitly settled. Invoices
  // created before this status field existed have no status at all but
  // already carry full payment details, so treat those as paid too.
  const isInvoicePaid = (invoice) => invoice.status !== 'pending';

  const sortByProject = (a, b) =>
    (a.projectName || '').localeCompare(b.projectName || '', undefined, { sensitivity: 'base' });
  const pendingInvoices = payments.filter((p) => !isInvoicePaid(p)).sort(sortByProject);
  const paidInvoices = payments.filter((p) => isInvoicePaid(p)).sort(sortByProject);
  const totalPaid = paidInvoices.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      {/* CONSTRUCTION PAYMENT INVOICES - every payment now goes through
          raise-invoice -> send to finance -> mark paid. Pending vs paid
          invoices are shown as two separate views since a pending invoice
          has no payment details yet. */}
      <div className="ge-header">
        <h3 className="hw-inline-heading">Construction Payments</h3>
        <button className="ge-add-btn" onClick={() => setShowInvoiceForm(!showInvoiceForm)}>
          {showInvoiceForm ? 'Cancel' : '+ Raise Invoice'}
        </button>
      </div>

      <div className="ge-summary">
        <span>{payments.length} invoice(s)</span>
        <span>Total Paid: {formatLKR(totalPaid)}</span>
      </div>

      {showInvoiceForm && (
        <form className="ge-form" onSubmit={handleCreateInvoice}>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Payment title"
              value={invoiceForm.title}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Invoice amount (LKR)"
              value={invoiceForm.amount}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: sanitizeAmountInput(e.target.value) })}
              required
            />
            <input
              type="text"
              placeholder="Paid to"
              value={invoiceForm.paidTo}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, paidTo: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <ProjectNameField
              value={invoiceForm.projectName}
              onChange={(val) => setInvoiceForm({ ...invoiceForm, projectName: val })}
              projectNames={projectNames}
            />
            <input
              type="date"
              value={invoiceForm.date}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
            />
          </div>

          <div className="ge-form-row upload-row">
            <div className="upload-field">
              <label className="upload-field-label">Bill / invoice</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setInvoiceBillFile(e.target.files[0])}
              />
            </div>
          </div>

          <textarea
            placeholder="Description (optional)"
            value={invoiceForm.description}
            onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
            rows={2}
          />
          <button type="submit" className="ge-save-btn" disabled={isInvoiceSubmitting}>
            {isInvoiceSubmitting ? 'Saving...' : 'Raise Invoice'}
          </button>
        </form>
      )}

      {editingInvoice && (
        <form className="ge-form pay-invoice-form" onSubmit={handleUpdateInvoice}>
          <p className="sa-group-title plan-preview-title">
            Edit Invoice - {editingInvoice.title}
          </p>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Payment title"
              value={editInvoiceForm.title}
              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, title: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Invoice amount (LKR)"
              value={editInvoiceForm.amount}
              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, amount: sanitizeAmountInput(e.target.value) })}
              required
            />
          </div>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Paid to"
              value={editInvoiceForm.paidTo}
              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, paidTo: e.target.value })}
            />
            <ProjectNameField
              value={editInvoiceForm.projectName}
              onChange={(val) => setEditInvoiceForm({ ...editInvoiceForm, projectName: val })}
              projectNames={projectNames}
            />
            <input
              type="date"
              value={editInvoiceForm.date}
              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, date: e.target.value })}
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={editInvoiceForm.description}
            onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, description: e.target.value })}
            rows={2}
            className="payment-note-textarea"
          />

          {editingInvoice.status === 'paid' && (
            <>
              <p className="sa-group-title plan-preview-title">Payment details</p>
              <div className="ge-form-row">
                <input
                  type="date"
                  value={editInvoiceForm.paymentDate}
                  onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, paymentDate: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Cheque / Reference No."
                  value={editInvoiceForm.referenceNo}
                  onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, referenceNo: e.target.value })}
                  required
                />
              </div>
              <div className="ge-form-row">
                <input type="text" placeholder="Payee account number" value={editInvoiceForm.accountNumber} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, accountNumber: e.target.value })} />
                <BankNameField value={editInvoiceForm.bankName} onChange={(val) => setEditInvoiceForm({ ...editInvoiceForm, bankName: val })} />
                <input type="text" placeholder="Payee branch" value={editInvoiceForm.bankBranch} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, bankBranch: e.target.value })} />
              </div>
              <textarea
                placeholder="Payment note (optional)"
                value={editInvoiceForm.paymentNote}
                onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, paymentNote: e.target.value })}
                rows={2}
                className="payment-note-textarea"
              />
            </>
          )}

          <div className="sa-panel-actions">
            <button type="submit" className="ge-save-btn" disabled={isEditInvoiceSubmitting}>
              {isEditInvoiceSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="sa-reject-btn" onClick={closeEditInvoice}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Step 2 form - only shown while recording the payment for one
          specific pending invoice (opened via "Mark as Paid" in the table below) */}
      {payingInvoice && (
        <form className="ge-form pay-invoice-form" onSubmit={handlePayInvoice}>
          <p className="sa-group-title plan-preview-title">
            Record Payment for Invoice - {payingInvoice.title}
          </p>
          <div className="ge-form-row">
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <input
              type="text"
              placeholder="Cheque / Reference No."
              value={payReferenceNo}
              onChange={(e) => setPayReferenceNo(e.target.value)}
              required
            />
          </div>
          <div className="ge-form-row">
            <input type="text" placeholder="Payee account number" value={payAccountNumber} onChange={(e) => setPayAccountNumber(e.target.value)} />
            <BankNameField value={payBankName} onChange={setPayBankName} />
            <input type="text" placeholder="Payee branch" value={payBankBranch} onChange={(e) => setPayBankBranch(e.target.value)} />
          </div>

          <div className="ge-form-row upload-row">
            <div className="upload-field">
              <label className="upload-field-label">Bank payment slip</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setPaySlipFile(e.target.files[0])}
              />
            </div>
          </div>

          <textarea
            placeholder="Note (optional)"
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            rows={2}
            className="payment-note-textarea"
          />
          <div className="sa-panel-actions">
            <button type="submit" className="ge-save-btn" disabled={isPaySubmitting}>
              {isPaySubmitting ? 'Saving...' : 'Mark as Paid'}
            </button>
            <button type="button" className="sa-reject-btn" onClick={resetPayForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="hw-subtabs">
        <button
          type="button"
          className={`hw-subtab-btn ${invoiceTab === 'pending' ? 'active' : ''}`}
          onClick={() => setInvoiceTab('pending')}
        >
          Pending Invoices ({pendingInvoices.length})
        </button>
        <button
          type="button"
          className={`hw-subtab-btn ${invoiceTab === 'paid' ? 'active' : ''}`}
          onClick={() => setInvoiceTab('paid')}
        >
          Paid Invoices ({paidInvoices.length})
        </button>
      </div>

      {invoiceTab === 'pending' ? (
        // Pending invoices only carry invoice-side details - there is no
        // payment/bank info yet, so those columns don't apply here.
        <table className="sa-table hw-items-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Title</th>
              <th>Paid To</th>
              <th>Project</th>
              <th>Amount (LKR)</th>
              <th>Invoice Date</th>
              <th>Bill</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pendingInvoices.length === 0 ? (
              <tr>
                <td colSpan="9" className="hw-empty-text">
                  No pending invoices
                </td>
              </tr>
            ) : (
              pendingInvoices.map((p) => (
                <tr key={p._id}>
                  <td>{p.invoiceNo || '-'}</td>
                  <td>{p.title}</td>
                  <td>{p.paidTo || '-'}</td>
                  <td>{p.projectName || '-'}</td>
                  <td>{formatLKR(p.amount)}</td>
                  <td>{p.date ? new Date(p.date).toLocaleDateString() : '-'}</td>
                  <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td><span className="sa-badge sa-badge-pending">Pending</span></td>
                  <td>
                    <div className="hw-supplier-actions">
                      <button className="sa-manage-btn" onClick={() => startPayingInvoice(p)}>
                        Mark as Paid
                      </button>
                      <button className="hw-edit-btn" onClick={() => startEditInvoice(p)}>
                        Edit
                      </button>
                      <button className="hw-delete-btn" onClick={() => handleDeletePayment(p._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        // Paid invoices show everything together - the original invoice
        // details plus the bank/payment details recorded once it was settled.
        <table className="sa-table hw-items-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Title</th>
              <th>Paid To</th>
              <th>Project</th>
              <th>Amount (LKR)</th>
              <th>Invoice Date</th>
              <th>Payment Date</th>
              <th>Reference No.</th>
              <th>Account No.</th>
              <th>Bank / Branch</th>
              <th>Bill</th>
              <th>Slip</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paidInvoices.length === 0 ? (
              <tr>
                <td colSpan="14" className="hw-empty-text">
                  No paid invoices yet
                </td>
              </tr>
            ) : (
              paidInvoices.map((p) => (
                <tr key={p._id}>
                  <td>{p.invoiceNo || '-'}</td>
                  <td>{p.title}</td>
                  <td>{p.paidTo || '-'}</td>
                  <td>{p.projectName || '-'}</td>
                  <td>{formatLKR(p.amount)}</td>
                  <td>{p.date ? new Date(p.date).toLocaleDateString() : '-'}</td>
                  <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}</td>
                  <td>{p.referenceNo || '-'}</td>
                  <td>{p.accountNumber || '-'}</td>
                  <td>{[p.bankName, p.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                  <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td><span className="sa-badge sa-badge-approved">Paid</span></td>
                  <td>
                    <div className="hw-supplier-actions">
                      <button className="hw-edit-btn" onClick={() => startEditInvoice(p)}>
                        Edit
                      </button>
                      <button className="hw-delete-btn" onClick={() => handleDeletePayment(p._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Sub-section: Hardware ----------
function Hardware() {
  const [hwTab, setHwTab] = useTabState('hw', 'suppliers'); // 'suppliers' | 'finder'
  const [projectNames, refetchProjectNames] = useProjectNames();

  const [hardwareList, setHardwareList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ supplierName: '', phone: '', accountNumber: '', bankName: '', bankBranch: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [editSupplierForm, setEditSupplierForm] = useState({ supplierName: '', phone: '', accountNumber: '', bankName: '', bankBranch: '' });
  const [isEditSupplierSubmitting, setIsEditSupplierSubmitting] = useState(false);

  const [addingItemTo, setAddingItemTo] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', unitPrice: '', quantity: '' });
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);

  const [editingItem, setEditingItem] = useState(null); // { hwId, itemId, name, unitPrice, quantity }
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Order form state: hardwareId -> { itemId: { checked, quantity } }
  const [orderingFor, setOrderingFor] = useState(null);
  const [orderSelections, setOrderSelections] = useState({});
  const [lastOrderTotal, setLastOrderTotal] = useState(null);
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);

  // Hardware invoices - same invoice-first flow as Contractor Invoices
  // (Payments tab): raise an invoice against a supplier for a project,
  // send it to finance, then mark it paid once settled.
  const [hwInvoiceTab, setHwInvoiceTab] = useTabState('hwinv', 'pending'); // 'pending' | 'paid'

  const [showHwInvoiceForm, setShowHwInvoiceForm] = useState(false);
  const [hardwareId, setHardwareId] = useState('');
  const [hwInvoiceProjectName, setHwInvoiceProjectName] = useState('');
  const [hwInvoiceAmount, setHwInvoiceAmount] = useState('');
  const [hwInvoiceDate, setHwInvoiceDate] = useState('');
  const [hwInvoiceReason, setHwInvoiceReason] = useState('');
  const [hwInvoiceNote, setHwInvoiceNote] = useState('');
  const [hwInvoiceBillFiles, setHwInvoiceBillFiles] = useState([]);
  const [isHwInvoiceSubmitting, setIsHwInvoiceSubmitting] = useState(false);

  // Optional: build the invoice amount from the supplier's own item
  // catalog instead of typing it manually - pick items + quantities and
  // the total is calculated for you.
  const [showHwInvoiceItemPicker, setShowHwInvoiceItemPicker] = useState(false);
  const [hwInvoiceItemPicks, setHwInvoiceItemPicks] = useState({}); // itemId -> quantity


  const [payingHwInvoice, setPayingHwInvoice] = useState(null); // { hardwareId, invoiceId, supplierName }
  const [hwPayDate, setHwPayDate] = useState('');
  const [hwPayReferenceNo, setHwPayReferenceNo] = useState('');
  const [hwPayAccountNumber, setHwPayAccountNumber] = useState('');
  const [hwPayBankName, setHwPayBankName] = useState('');
  const [hwPayBankBranch, setHwPayBankBranch] = useState('');
  const [hwPayNote, setHwPayNote] = useState('');
  const [hwPaySlipFile, setHwPaySlipFile] = useState(null);
  const [isHwPaySubmitting, setIsHwPaySubmitting] = useState(false);

  const [editingHwInvoice, setEditingHwInvoice] = useState(null); // { hardwareId, invoiceId, status, supplierName }
  const [editHwInvoiceForm, setEditHwInvoiceForm] = useState({
    amount: '', reason: '', date: '', note: '', projectName: '',
    referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', paymentDate: '', paymentNote: '',
  });
  const [isEditHwInvoiceSubmitting, setIsEditHwInvoiceSubmitting] = useState(false);

  useEffect(() => {
    fetchHardware();
  }, []);

  const fetchHardware = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hardware`);
      setHardwareList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Hardware invoices ----
  const resetHwInvoiceForm = () => {
    setHardwareId('');
    setHwInvoiceProjectName('');
    setHwInvoiceAmount('');
    setHwInvoiceDate('');
    setHwInvoiceReason('');
    setHwInvoiceNote('');
    setHwInvoiceBillFiles([]);
    setShowHwInvoiceItemPicker(false);
    setHwInvoiceItemPicks({});
  };

  const resetHwPayForm = () => {
    setPayingHwInvoice(null);
    setHwPayDate('');
    setHwPayReferenceNo('');
    setHwPayAccountNumber('');
    setHwPayBankName('');
    setHwPayBankBranch('');
    setHwPayNote('');
    setHwPaySlipFile(null);
  };

  const selectedHardware = hardwareList.find((h) => h._id === hardwareId);

  // ---- Build the invoice amount from the supplier's item catalog ----
  const toggleHwInvoiceItem = (itemId) => {
    setHwInvoiceItemPicks((prev) => {
      if (prev[itemId] !== undefined) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: 1 };
    });
  };

  const updateHwInvoiceItemQty = (itemId, quantity) => {
    setHwInvoiceItemPicks((prev) => ({ ...prev, [itemId]: Number(quantity) || 0 }));
  };

  const calcHwInvoiceItemsTotal = () => {
    if (!selectedHardware) return 0;
    return Object.entries(hwInvoiceItemPicks).reduce((sum, [itemId, qty]) => {
      const item = selectedHardware.items.find((i) => i._id === itemId);
      if (!item) return sum;
      return sum + item.unitPrice * (qty || 0);
    }, 0);
  };

  const applyHwInvoiceItemsTotal = () => {
    setHwInvoiceAmount(String(calcHwInvoiceItemsTotal()));
  };

  // STEP 1: raise an invoice against a hardware supplier for a project.
  // No payment/bank details are collected here - the invoice is created as
  // 'pending' and only gets paid details once it's actually settled.
  const handleCreateHwInvoice = async (e) => {
    e.preventDefault();
    if (!hardwareId || !hwInvoiceProjectName || isHwInvoiceSubmitting) return;
    setIsHwInvoiceSubmitting(true);
    try {
      const data = new FormData();
      data.append('amount', hwInvoiceAmount);
      if (hwInvoiceDate) data.append('date', hwInvoiceDate);
      data.append('reason', hwInvoiceReason);
      data.append('note', hwInvoiceNote);
      data.append('projectName', hwInvoiceProjectName);
      hwInvoiceBillFiles.forEach((file) => data.append('bills', file));

      await axios.post(
        `${API_BASE_URL}/api/hardware/${hardwareId}/invoices`,
        data,
      );

      resetHwInvoiceForm();
      setShowHwInvoiceForm(false);
      setHwInvoiceTab('pending');
      fetchHardware();
      refetchProjectNames();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not create the invoice. Please try again.');
    } finally {
      setIsHwInvoiceSubmitting(false);
    }
  };

  // Open the "record payment" form for a specific pending invoice, prefilling
  // the supplier's own bank details as a starting point.
  const startPayingHwInvoice = (hardware, invoice) => {
    resetHwPayForm();
    setPayingHwInvoice({ hardwareId: hardware._id, invoiceId: invoice._id, supplierName: hardware.supplierName });
    setHwPayAccountNumber(hardware.accountNumber || '');
    setHwPayBankName(hardware.bankName || '');
    setHwPayBankBranch(hardware.bankBranch || '');
  };

  // STEP 2: record the actual bank payment made against a pending invoice.
  // This attaches the payment/bank details to that invoice and marks it paid.
  const handlePayHwInvoice = async (e) => {
    e.preventDefault();
    if (!payingHwInvoice || isHwPaySubmitting) return;
    setIsHwPaySubmitting(true);
    try {
      const data = new FormData();
      if (hwPayDate) data.append('date', hwPayDate);
      data.append('referenceNo', hwPayReferenceNo);
      data.append('accountNumber', hwPayAccountNumber);
      data.append('bankName', hwPayBankName);
      data.append('bankBranch', hwPayBankBranch);
      data.append('note', hwPayNote);
      if (hwPaySlipFile) data.append('slip', hwPaySlipFile);

      await axios.put(
        `${API_BASE_URL}/api/hardware/${payingHwInvoice.hardwareId}/invoices/${payingHwInvoice.invoiceId}/pay`,
        data,
      );

      resetHwPayForm();
      setHwInvoiceTab('paid');
      fetchHardware();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not record the payment. Please try again.');
    } finally {
      setIsHwPaySubmitting(false);
    }
  };

  const handleDeleteHwInvoice = async (hardwareId, invoiceId) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/hardware/${hardwareId}/invoices/${invoiceId}`);
      const updated = res.data.hardware;
      setHardwareList((prev) => prev.map((h) => (h._id === updated._id ? updated : h)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the invoice. Please check the backend server is running and try again.');
    }
  };

  const startEditHwInvoice = (hardware, invoice) => {
    setEditingHwInvoice({
      hardwareId: hardware._id,
      invoiceId: invoice._id,
      status: invoice.status,
      supplierName: hardware.supplierName,
    });
    setEditHwInvoiceForm({
      amount: invoice.amount ?? '',
      reason: invoice.reason || '',
      date: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().slice(0, 10) : '',
      note: invoice.note || '',
      projectName: invoice.projectName || '',
      referenceNo: invoice.referenceNo || '',
      accountNumber: invoice.accountNumber || '',
      bankName: invoice.bankName || '',
      bankBranch: invoice.bankBranch || '',
      paymentDate: invoice.paymentDate ? new Date(invoice.paymentDate).toISOString().slice(0, 10) : '',
      paymentNote: invoice.paymentNote || '',
    });
  };

  const closeEditHwInvoice = () => {
    setEditingHwInvoice(null);
    setEditHwInvoiceForm({
      amount: '', reason: '', date: '', note: '', projectName: '',
      referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', paymentDate: '', paymentNote: '',
    });
  };

  const handleUpdateHwInvoice = async (e) => {
    e.preventDefault();
    if (!editingHwInvoice || isEditHwInvoiceSubmitting) return;
    setIsEditHwInvoiceSubmitting(true);
    try {
      const payload = {
        amount: editHwInvoiceForm.amount,
        reason: editHwInvoiceForm.reason,
        date: editHwInvoiceForm.date,
        note: editHwInvoiceForm.note,
        projectName: editHwInvoiceForm.projectName,
      };
      if (editingHwInvoice.status === 'paid') {
        payload.referenceNo = editHwInvoiceForm.referenceNo;
        payload.accountNumber = editHwInvoiceForm.accountNumber;
        payload.bankName = editHwInvoiceForm.bankName;
        payload.bankBranch = editHwInvoiceForm.bankBranch;
        payload.paymentDate = editHwInvoiceForm.paymentDate;
        payload.paymentNote = editHwInvoiceForm.paymentNote;
      }
      await axios.put(
        `${API_BASE_URL}/api/hardware/${editingHwInvoice.hardwareId}/invoices/${editingHwInvoice.invoiceId}`,
        payload
      );
      closeEditHwInvoice();
      fetchHardware();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not update the invoice. Please try again.');
    } finally {
      setIsEditHwInvoiceSubmitting(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/hardware`, formData);
      setHardwareList((prev) => [...prev, res.data.hardware]);
      setFormData({ supplierName: '', phone: '', accountNumber: '', bankName: '', bankBranch: '' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openItemForm = (hardware) => {
    setAddingItemTo(hardware);
    setItemForm({ name: '', unitPrice: '', quantity: '' });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!addingItemTo || isItemSubmitting) return;
    setIsItemSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/hardware/${addingItemTo._id}/items`, itemForm);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
      setAddingItemTo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsItemSubmitting(false);
    }
  };

  const openEditItem = (hardwareId, item) => {
    setEditingItem({
      hwId: hardwareId,
      itemId: item._id,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    });
  };

  const closeEditItem = () => setEditingItem(null);

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem || isEditSubmitting) return;
    setIsEditSubmitting(true);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/hardware/${editingItem.hwId}/items/${editingItem.itemId}`,
        {
          name: editingItem.name,
          unitPrice: editingItem.unitPrice,
          quantity: editingItem.quantity,
        }
      );
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
      closeEditItem();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteItem = async (hardwareId, itemId) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/hardware/${hardwareId}/items/${itemId}`);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the item. Please check the backend server is running and try again.');
    }
  };

  const startEditSupplier = (hw) => {
    setEditingSupplierId(hw._id);
    setEditSupplierForm({ supplierName: hw.supplierName, phone: hw.phone, accountNumber: hw.accountNumber || '', bankName: hw.bankName || '', bankBranch: hw.bankBranch || '' });
  };

  const cancelEditSupplier = () => {
    setEditingSupplierId(null);
    setEditSupplierForm({ supplierName: '', phone: '', accountNumber: '', bankName: '', bankBranch: '' });
  };

  const handleUpdateSupplier = async (e, hardwareId) => {
    e.preventDefault();
    if (isEditSupplierSubmitting) return;
    setIsEditSupplierSubmitting(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/hardware/${hardwareId}`, editSupplierForm);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
      cancelEditSupplier();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not update the supplier. Please check the backend server is running and try again.');
    } finally {
      setIsEditSupplierSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (hardwareId) => {
    if (!window.confirm('Delete this hardware supplier? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/hardware/${hardwareId}`);
      setHardwareList((prev) => prev.filter((hw) => hw._id !== hardwareId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the supplier. Please check the backend server is running and try again.');
    }
  };

  const handleDeleteHardwarePayment = async (hardwareId, paymentId) => {
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/hardware/${hardwareId}/payments/${paymentId}`);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the payment. Please check the backend server is running and try again.');
    }
  };

  // A recorded payment with no status at all was saved before this field
  // existed and already carries its full bill + bank slip, so treat it as
  // already confirmed/paid. Only an explicit 'pending' status is pending.
  const isPaymentConfirmed = (p) => p.status !== 'pending';

  const handleConfirmHardwarePayment = async (hardwareId, paymentId) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/api/hardware/${hardwareId}/payments/${paymentId}/confirm`);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not confirm the payment. Please check the backend server is running and try again.');
    }
  };

  const itemTotal = (item) => item.unitPrice * item.quantity;
  const hardwareTotal = (hw) => hw.items.reduce((sum, i) => sum + itemTotal(i), 0);
  // Everything actually paid to this supplier: legacy bill/slip records that
  // were already settled (a missing status = pre-existing, already settled -
  // see the paymentSchema note in the model), plus every invoice raised via
  // "+ Raise Invoice" that has since been marked paid.
  const paymentsTotal = (hw) => {
    const legacyPaid = hw.payments
      .filter((p) => p.status !== 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    const invoicesPaid = (hw.invoices || [])
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
    return legacyPaid + invoicesPaid;
  };
  const paidCount = (hw) =>
    hw.payments.filter((p) => p.status !== 'pending').length +
    (hw.invoices || []).filter((inv) => inv.status === 'paid').length;

  // ---------- Order form logic ----------
  const openOrderForm = (hardware) => {
    setOrderingFor(hardware);
    setOrderSelections({});
    setLastOrderTotal(null);
  };

  const toggleOrderItem = (itemId) => {
    setOrderSelections((prev) => {
      const existing = prev[itemId];
      if (existing) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: { quantity: 1 } };
    });
  };

  const updateOrderQuantity = (itemId, quantity) => {
    setOrderSelections((prev) => ({
      ...prev,
      [itemId]: { quantity: Number(quantity) || 0 },
    }));
  };

  const calcLiveOrderTotal = (hardware) => {
    return Object.entries(orderSelections).reduce((sum, [itemId, sel]) => {
      const item = hardware.items.find((i) => i._id === itemId);
      if (!item) return sum;
      return sum + item.unitPrice * (sel.quantity || 0);
    }, 0);
  };

  const handleSubmitOrder = async (e, hardware) => {
    e.preventDefault();
    if (isOrderSubmitting) return;

    const items = Object.entries(orderSelections)
      .filter(([, sel]) => sel.quantity > 0)
      .map(([itemId, sel]) => ({ itemId, quantity: sel.quantity }));

    if (items.length === 0) return;

    setIsOrderSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/hardware/${hardware._id}/order`, { items });
      const updatedHardware = res.data.hardware;
      setLastOrderTotal(res.data.order.total);
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
      setOrderSelections({});
    } catch (err) {
      console.error(err);
    } finally {
      setIsOrderSubmitting(false);
    }
  };

  return (
    <div>
      <div className="hw-subtabs">
        <button
          type="button"
          className={`hw-subtab-btn ${hwTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setHwTab('suppliers')}
        >
          Hardware Suppliers
        </button>
        <button
          type="button"
          className={`hw-subtab-btn ${hwTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setHwTab('invoices')}
        >
          Hardware Invoices
        </button>
        <button
          type="button"
          className={`hw-subtab-btn ${hwTab === 'finder' ? 'active' : ''}`}
          onClick={() => setHwTab('finder')}
        >
          Best Price Finder
        </button>
      </div>

      {hwTab === 'invoices' && (
        <>
        {/* HARDWARE INVOICES - same raise-invoice -> send to finance -> mark
            paid flow as Contractor Invoices above, but against a hardware
            supplier for a project instead of an estimation plan. */}
        <div className="ge-header contractor-payments-header">
          <h3 className="hw-inline-heading">Hardware Invoices</h3>
          <button className="ge-add-btn" onClick={() => setShowHwInvoiceForm(!showHwInvoiceForm)}>
            {showHwInvoiceForm ? 'Cancel' : '+ Raise Invoice'}
          </button>
        </div>

        {showHwInvoiceForm && (
          <form className="ge-form" onSubmit={handleCreateHwInvoice}>
            <div className="ge-form-row">
              <select
                value={hardwareId}
                onChange={(e) => {
                  setHardwareId(e.target.value);
                  setShowHwInvoiceItemPicker(false);
                  setHwInvoiceItemPicks({});
                }}
                required
              >
                <option value="">Select hardware supplier...</option>
                {hardwareList.map((h) => (
                  <option key={h._id} value={h._id}>{h.supplierName}</option>
                ))}
              </select>

              <ProjectNameField
                value={hwInvoiceProjectName}
                onChange={setHwInvoiceProjectName}
                projectNames={projectNames}
              />
            </div>

            {selectedHardware && (
              <div className="ge-summary plan-preview-summary">
                <span>Supplier: {selectedHardware.supplierName}</span>
                <span>Phone: {selectedHardware.phone}</span>
              </div>
            )}

            {selectedHardware && selectedHardware.items.length > 0 && (
              <div className="hw-item-form">
                <div className="ge-header">
                  <p className="sa-group-title">Add items from {selectedHardware.supplierName}'s store</p>
                  <button
                    type="button"
                    className="hw-finder-add-btn"
                    onClick={() => setShowHwInvoiceItemPicker((prev) => !prev)}
                  >
                    {showHwInvoiceItemPicker ? 'Hide' : '+ Pick Items'}
                  </button>
                </div>

                {showHwInvoiceItemPicker && (
                  <>
                    <table className="sa-table hw-items-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Item</th>
                          <th>Unit Price (LKR)</th>
                          <th>Quantity</th>
                          <th>Line Total (LKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedHardware.items.map((item) => {
                          const picked = hwInvoiceItemPicks[item._id];
                          return (
                            <tr key={item._id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={picked !== undefined}
                                  onChange={() => toggleHwInvoiceItem(item._id)}
                                />
                              </td>
                              <td>{item.name}</td>
                              <td>{formatLKR(item.unitPrice)}</td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  value={picked !== undefined ? picked : ''}
                                  disabled={picked === undefined}
                                  onChange={(e) => updateHwInvoiceItemQty(item._id, e.target.value)}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              <td>{formatLKR(item.unitPrice * (picked || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="ge-summary hw-total-summary">
                      <span>Calculated Total: {formatLKR(calcHwInvoiceItemsTotal())}</span>
                      <button type="button" className="sa-manage-btn" onClick={applyHwInvoiceItemsTotal}>
                        Use This as Invoice Amount
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="ge-form-row">
              <input
                type="number"
                placeholder="Invoice amount (LKR)"
                value={hwInvoiceAmount}
                onChange={(e) => setHwInvoiceAmount(sanitizeAmountInput(e.target.value))}
                required
              />
              <input
                type="date"
                value={hwInvoiceDate}
                onChange={(e) => setHwInvoiceDate(e.target.value)}
              />
            </div>

            <div className="ge-form-row">
              <input
                type="text"
                placeholder="Reason for this invoice"
                value={hwInvoiceReason}
                onChange={(e) => setHwInvoiceReason(e.target.value)}
                required
              />
            </div>

            <div className="ge-form-row upload-row">
              <div className="upload-field">
                <label className="upload-field-label">Bill(s) / invoice from supplier (select one or more)</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length) {
                      setHwInvoiceBillFiles((prev) => {
                        const merged = [...prev, ...selected];
                        const seen = new Set();
                        return merged.filter((file) => {
                          const key = `${file.name}-${file.size}-${file.lastModified}`;
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                      });
                    }
                    e.target.value = '';
                  }}
                />
                {hwInvoiceBillFiles.length > 0 && (
                  <div className="selected-file-list">
                    <small>{hwInvoiceBillFiles.length} bill(s) selected</small>
                    {hwInvoiceBillFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="selected-file-row">
                        <span>{index + 1}. {file.name}</span>
                        <button
                          type="button"
                          onClick={() => setHwInvoiceBillFiles((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={`Remove ${file.name}`}
                        >Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <textarea
              placeholder="Note (optional)"
              value={hwInvoiceNote}
              onChange={(e) => setHwInvoiceNote(e.target.value)}
              rows={2}
              className="payment-note-textarea"
            />
            <button type="submit" className="ge-save-btn" disabled={isHwInvoiceSubmitting}>
              {isHwInvoiceSubmitting ? 'Saving...' : 'Raise Invoice'}
            </button>
          </form>
        )}

        {editingHwInvoice && (
          <form className="ge-form pay-invoice-form" onSubmit={handleUpdateHwInvoice}>
            <p className="sa-group-title plan-preview-title">
              Edit Invoice - {editingHwInvoice.supplierName}
            </p>
            <div className="ge-form-row">
              <input
                type="number"
                placeholder="Invoice amount (LKR)"
                value={editHwInvoiceForm.amount}
                onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, amount: sanitizeAmountInput(e.target.value) })}
                required
              />
              <input
                type="date"
                value={editHwInvoiceForm.date}
                onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, date: e.target.value })}
              />
            </div>
            <div className="ge-form-row">
              <input
                type="text"
                placeholder="Reason for this invoice"
                value={editHwInvoiceForm.reason}
                onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, reason: e.target.value })}
                required
              />
              <ProjectNameField
                value={editHwInvoiceForm.projectName}
                onChange={(val) => setEditHwInvoiceForm({ ...editHwInvoiceForm, projectName: val })}
                projectNames={projectNames}
              />
            </div>
            <textarea
              placeholder="Note (optional)"
              value={editHwInvoiceForm.note}
              onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, note: e.target.value })}
              rows={2}
              className="payment-note-textarea"
            />

            {editingHwInvoice.status === 'paid' && (
              <>
                <p className="sa-group-title plan-preview-title">Payment details</p>
                <div className="ge-form-row">
                  <input
                    type="date"
                    value={editHwInvoiceForm.paymentDate}
                    onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, paymentDate: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Cheque / Reference No."
                    value={editHwInvoiceForm.referenceNo}
                    onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, referenceNo: e.target.value })}
                    required
                  />
                </div>
                <div className="ge-form-row">
                  <input type="text" placeholder="Payee account number" value={editHwInvoiceForm.accountNumber} onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, accountNumber: e.target.value })} />
                  <BankNameField value={editHwInvoiceForm.bankName} onChange={(val) => setEditHwInvoiceForm({ ...editHwInvoiceForm, bankName: val })} />
                  <input type="text" placeholder="Payee branch" value={editHwInvoiceForm.bankBranch} onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, bankBranch: e.target.value })} />
                </div>
                <textarea
                  placeholder="Payment note (optional)"
                  value={editHwInvoiceForm.paymentNote}
                  onChange={(e) => setEditHwInvoiceForm({ ...editHwInvoiceForm, paymentNote: e.target.value })}
                  rows={2}
                  className="payment-note-textarea"
                />
              </>
            )}

            <div className="sa-panel-actions">
              <button type="submit" className="ge-save-btn" disabled={isEditHwInvoiceSubmitting}>
                {isEditHwInvoiceSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="sa-reject-btn" onClick={closeEditHwInvoice}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Step 2 form - only shown while recording the payment for one specific
            pending hardware invoice (opened via "Mark as Paid" in the table below) */}
        {payingHwInvoice && (
          <form className="ge-form pay-invoice-form" onSubmit={handlePayHwInvoice}>
            <p className="sa-group-title plan-preview-title">
              Record Payment for Invoice - {payingHwInvoice.supplierName}
            </p>
            <div className="ge-form-row">
              <input
                type="date"
                value={hwPayDate}
                onChange={(e) => setHwPayDate(e.target.value)}
              />
              <input
                type="text"
                placeholder="Cheque / Reference No."
                value={hwPayReferenceNo}
                onChange={(e) => setHwPayReferenceNo(e.target.value)}
                required
              />
            </div>
            <div className="ge-form-row">
              <input type="text" placeholder="Payee account number" value={hwPayAccountNumber} onChange={(e) => setHwPayAccountNumber(e.target.value)} />
              <BankNameField value={hwPayBankName} onChange={setHwPayBankName} />
              <input type="text" placeholder="Payee branch" value={hwPayBankBranch} onChange={(e) => setHwPayBankBranch(e.target.value)} />
            </div>

            <div className="ge-form-row upload-row">
              <div className="upload-field">
                <label className="upload-field-label">Bank payment slip</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setHwPaySlipFile(e.target.files[0])}
                />
              </div>
            </div>

            <textarea
              placeholder="Note (optional)"
              value={hwPayNote}
              onChange={(e) => setHwPayNote(e.target.value)}
              rows={2}
              className="payment-note-textarea"
            />
            <div className="sa-panel-actions">
              <button type="submit" className="ge-save-btn" disabled={isHwPaySubmitting}>
                {isHwPaySubmitting ? 'Saving...' : 'Mark as Paid'}
              </button>
              <button type="button" className="sa-reject-btn" onClick={resetHwPayForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {(() => {
          // Merge the two sources of hardware payments into one unified list:
          // - true invoices (raised via "+ Raise Invoice" above, in `invoices`)
          // - direct bill+payment records (via "+ Record Payment" on a
          //   supplier card below, in `payments`) - these already carry full
          //   bill/slip/bank details, so they only ever need a "Confirm" step,
          //   never the separate "Mark as Paid" form.
          // Every paid record from either source shows up under Paid
          // Invoices, and every unconfirmed one under Pending Invoices.
          const invoiceEntries = hardwareList.flatMap((h) =>
            (h.invoices || []).map((inv) => ({
              ...inv,
              supplierName: h.supplierName,
              hardwareId: h._id,
              hardwareObj: h,
              _source: 'invoice',
              _isPaid: inv.status === 'paid',
            }))
          );
          const paymentEntries = hardwareList.flatMap((h) =>
            (h.payments || []).map((p) => ({
              ...p,
              supplierName: h.supplierName,
              hardwareId: h._id,
              hardwareObj: h,
              _source: 'payment',
              _isPaid: p.status !== 'pending', // missing status = pre-existing, already settled
              invoiceDate: p.date,
              paymentDate: p.date,
            }))
          );
          const allHwEntries = [...invoiceEntries, ...paymentEntries];

          const sortByProject = (a, b) =>
            (a.projectName || '').localeCompare(b.projectName || '', undefined, { sensitivity: 'base' });
          const pendingHwInvoices = allHwEntries.filter((e) => !e._isPaid).sort(sortByProject);
          const paidHwInvoices = allHwEntries.filter((e) => e._isPaid).sort(sortByProject);

          // A payment-sourced record can carry several bills (`bills[]`) or
          // just the old single `billUrl`; an invoice-sourced record only
          // ever has one `billUrl`.
          const renderBills = (e) => {
            if (e.bills?.length > 0) {
              return (
                <span>{e.bills.length} bill(s) — {e.bills.map((b, i) => (
                  <span key={b.url || i}>{i > 0 ? ', ' : ''}<a href={b.url} target="_blank" rel="noreferrer" className="ge-slip-link">View {i + 1}</a></span>
                ))}</span>
              );
            }
            return e.billUrl ? <a href={e.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-';
          };

          return (
            <>
              <div className="hw-subtabs">
                <button
                  type="button"
                  className={`hw-subtab-btn ${hwInvoiceTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setHwInvoiceTab('pending')}
                >
                  Pending Invoices ({pendingHwInvoices.length})
                </button>
                <button
                  type="button"
                  className={`hw-subtab-btn ${hwInvoiceTab === 'paid' ? 'active' : ''}`}
                  onClick={() => setHwInvoiceTab('paid')}
                >
                  Paid Invoices ({paidHwInvoices.length})
                </button>
              </div>

              {hwInvoiceTab === 'pending' ? (
                <div className="hw-table-scroll">
                <table className="sa-table hw-items-table">
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Supplier</th>
                      <th>Project</th>
                      <th>Amount (LKR)</th>
                      <th>Reason</th>
                      <th>Invoice Date</th>
                      <th>Bill</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingHwInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="hw-empty-text">
                          No pending invoices
                        </td>
                      </tr>
                    ) : (
                      pendingHwInvoices.map((inv) => (
                        <tr key={`${inv._source}-${inv.hardwareId}-${inv._id}`}>
                          <td>{inv.invoiceNo || '-'}</td>
                          <td>{inv.supplierName}</td>
                          <td>{inv.projectName || '-'}</td>
                          <td>{formatLKR(inv.amount)}</td>
                          <td>{inv.reason || inv.note || '-'}</td>
                          <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                          <td>{renderBills(inv)}</td>
                          <td><span className="sa-badge sa-badge-pending">Pending</span></td>
                          <td>
                            <div className="hw-supplier-actions">
                              {inv._source === 'invoice' ? (
                                <button className="sa-manage-btn" onClick={() => startPayingHwInvoice(inv.hardwareObj, inv)}>
                                  Mark Paid
                                </button>
                              ) : (
                                <button className="sa-manage-btn" onClick={() => handleConfirmHardwarePayment(inv.hardwareId, inv._id)}>
                                  Confirm
                                </button>
                              )}
                              {inv._source === 'invoice' && (
                                <button className="hw-edit-btn" onClick={() => startEditHwInvoice(inv.hardwareObj, inv)}>
                                  Edit
                                </button>
                              )}
                              <button
                                className="hw-delete-btn"
                                onClick={() => (inv._source === 'invoice'
                                  ? handleDeleteHwInvoice(inv.hardwareId, inv._id)
                                  : handleDeleteHardwarePayment(inv.hardwareId, inv._id))}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              ) : (
                <div className="hw-table-scroll">
                <table className="sa-table hw-items-table">
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Supplier</th>
                      <th>Project</th>
                      <th>Amount (LKR)</th>
                      <th>Reason</th>
                      <th>Invoice Date</th>
                      <th>Payment Date</th>
                      <th>Reference No.</th>
                      <th>Account No.</th>
                      <th>Bank / Branch</th>
                      <th>Bill</th>
                      <th>Slip</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidHwInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="14" className="hw-empty-text">
                          No paid invoices yet
                        </td>
                      </tr>
                    ) : (
                      paidHwInvoices.map((inv) => (
                        <tr key={`${inv._source}-${inv.hardwareId}-${inv._id}`}>
                          <td>{inv.invoiceNo || '-'}</td>
                          <td>{inv.supplierName}</td>
                          <td>{inv.projectName || '-'}</td>
                          <td>{formatLKR(inv.amount)}</td>
                          <td>{inv.reason || inv.note || '-'}</td>
                          <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                          <td>{inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}</td>
                          <td>{inv.referenceNo || '-'}</td>
                          <td>{inv.accountNumber || '-'}</td>
                          <td>{[inv.bankName, inv.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                          <td>{renderBills(inv)}</td>
                          <td>{inv.slipUrl ? <a href={inv.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td><span className="sa-badge sa-badge-approved">Paid</span></td>
                          <td>
                            <div className="hw-supplier-actions">
                              {inv._source === 'invoice' && (
                                <button className="hw-edit-btn" onClick={() => startEditHwInvoice(inv.hardwareObj, inv)}>
                                  Edit
                                </button>
                              )}
                              <button
                                className="hw-delete-btn"
                                onClick={() => (inv._source === 'invoice'
                                  ? handleDeleteHwInvoice(inv.hardwareId, inv._id)
                                  : handleDeleteHardwarePayment(inv.hardwareId, inv._id))}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </>
          );
        })()}
        </>
      )}

      {hwTab === 'finder' ? (
        <HardwarePriceFinder />
      ) : hwTab === 'invoices' ? null : (
        <>
          <div className="ge-header">
            <h3 className="hw-inline-heading">Hardware Suppliers</h3>
            <button className="ge-add-btn" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Add Hardware Supplier'}
            </button>
          </div>

          {showForm && (
            <form className="ge-form" onSubmit={handleAddSupplier}>
              <div className="ge-form-row">
                <input
                  type="text"
                  placeholder="Hardware name"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: sanitizeNameInput(e.target.value) })}
                  required
                />
                <input
                  type="text"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: sanitizePhoneInput(e.target.value) })}
                  maxLength={10}
                  required
                />
              </div>
              <div className="ge-form-row">
                <input type="text" placeholder="Account number" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
                <BankNameField value={formData.bankName} onChange={(val) => setFormData({ ...formData, bankName: val })} />
                <input type="text" placeholder="Branch" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} />
              </div>
              <button type="submit" className="ge-save-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Hardware'}
              </button>
            </form>
          )}

          {hardwareList.length === 0 && (
            <p className="hw-empty-text">No hardware suppliers found</p>
          )}

          {hardwareList.map((hw) => (
            <div key={hw._id} className="ge-form hw-supplier-card">
              {editingSupplierId === hw._id ? (
                <form onSubmit={(e) => handleUpdateSupplier(e, hw._id)} className="hw-item-form">
                  <div className="ge-form-row">
                    <input
                      type="text"
                      placeholder="Supplier name"
                      value={editSupplierForm.supplierName}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, supplierName: sanitizeNameInput(e.target.value) })}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editSupplierForm.phone}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, phone: sanitizePhoneInput(e.target.value) })}
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="ge-form-row">
                    <input type="text" placeholder="Account number" value={editSupplierForm.accountNumber} onChange={(e) => setEditSupplierForm({ ...editSupplierForm, accountNumber: e.target.value })} />
                    <BankNameField value={editSupplierForm.bankName} onChange={(val) => setEditSupplierForm({ ...editSupplierForm, bankName: val })} />
                    <input type="text" placeholder="Branch" value={editSupplierForm.bankBranch} onChange={(e) => setEditSupplierForm({ ...editSupplierForm, bankBranch: e.target.value })} />
                  </div>
                  <div className="sa-panel-actions">
                    <button type="submit" className="sa-save-btn" disabled={isEditSupplierSubmitting}>
                      {isEditSupplierSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" className="sa-reject-btn" onClick={cancelEditSupplier}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="ge-header">
                  <div>
                    <h4 className="hw-inline-heading">{hw.supplierName}</h4>
                    <p className="hw-supplier-phone">{hw.phone}</p>
                    <p className="hw-supplier-phone">A/C: {hw.accountNumber || '-'} &nbsp; | &nbsp; Bank: {hw.bankName || '-'} &nbsp; | &nbsp; Branch: {hw.bankBranch || '-'}</p>
                  </div>
                  <div className="hw-supplier-actions">
                    <button className="sa-manage-btn" onClick={() => openItemForm(hw)}>+ Add Item</button>
                    <button className="sa-manage-btn" onClick={() => openOrderForm(hw)}>Place Order</button>
                    <button className="sa-manage-btn" onClick={() => startEditSupplier(hw)}>Edit</button>
                    <button className="hw-delete-btn" onClick={() => handleDeleteSupplier(hw._id)}>Delete</button>
                  </div>
                </div>
              )}

              {/* ADD NEW ITEM TO CATALOG */}
              {addingItemTo?._id === hw._id && (
                <form onSubmit={handleAddItem} className="hw-item-form">
                  <div className="ge-form-row">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Unit price (LKR)"
                      value={itemForm.unitPrice}
                      onChange={(e) => setItemForm({ ...itemForm, unitPrice: sanitizeAmountInput(e.target.value) })}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="ge-save-btn" disabled={isItemSubmitting}>
                    {isItemSubmitting ? 'Saving...' : 'Save Item'}
                  </button>
                </form>
              )}

              {/* EDIT EXISTING ITEM */}
              {editingItem?.hwId === hw._id && (
                <form onSubmit={handleUpdateItem} className="hw-item-form">
                  <p className="sa-group-title">Edit item</p>
                  <div className="ge-form-row">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Unit price (LKR)"
                      value={editingItem.unitPrice}
                      onChange={(e) => setEditingItem({ ...editingItem, unitPrice: sanitizeAmountInput(e.target.value) })}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={editingItem.quantity}
                      onChange={(e) => setEditingItem({ ...editingItem, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="hw-edit-actions">
                    <button type="submit" className="ge-save-btn" disabled={isEditSubmitting}>
                      {isEditSubmitting ? 'Updating...' : 'Update Item'}
                    </button>
                    <button type="button" className="sa-reject-btn" onClick={closeEditItem}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* PLACE ORDER - checklist of existing items with quantity, live total below */}
              {orderingFor?._id === hw._id && (
                <form onSubmit={(e) => handleSubmitOrder(e, hw)} className="ge-form hw-item-form">
                  <p className="sa-group-title">Select items and quantities to order</p>

                  {hw.items.length === 0 ? (
                    <p className="hw-empty-text hw-empty-text-inline">No items yet — add items to the catalog first.</p>
                  ) : (
                    hw.items.map((item) => {
                      const sel = orderSelections[item._id];
                      const isChecked = !!sel;
                      return (
                        <div
                          key={item._id}
                          className={`sa-checkbox-row hw-order-row ${isChecked ? 'checked' : ''}`}
                        >
                          <div
                            className="hw-order-row-label"
                            onClick={() => toggleOrderItem(item._id)}
                          >
                            <span className="sa-checkbox-custom">{isChecked && '✓'}</span>
                            {item.name} ({formatLKR(item.unitPrice)}/unit)
                          </div>
                          {isChecked && (
                            <input
                              type="number"
                              min="1"
                              value={sel.quantity}
                              onChange={(e) => updateOrderQuantity(item._id, e.target.value)}
                              className="hw-qty-input"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      );
                    })
                  )}

                  <div className="ge-summary hw-order-summary">
                    <span>Order Total</span>
                    <span>{formatLKR(calcLiveOrderTotal(hw))}</span>
                  </div>

                  <button type="submit" className="ge-save-btn hw-order-submit-btn" disabled={isOrderSubmitting}>
                    {isOrderSubmitting ? 'Submitting...' : 'Submit Order'}
                  </button>

                  {lastOrderTotal !== null && (
                    <div className="ge-summary hw-last-order">
                      <span>Last order submitted</span>
                      <span>{formatLKR(lastOrderTotal)}</span>
                    </div>
                  )}
                </form>
              )}

              {hw.items.length > 0 && (
                <table className="sa-table hw-items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit Price (LKR)</th>
                      <th>Quantity</th>
                      <th>Total (LKR)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hw.items.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>{formatLKR(item.unitPrice)}</td>
                        <td>{item.quantity}</td>
                        <td>{formatLKR(itemTotal(item))}</td>
                        <td className="hw-item-actions-cell">
                          <button className="hw-edit-btn" onClick={() => openEditItem(hw._id, item)}>
                            Edit
                          </button>
                          <button className="hw-delete-btn" onClick={() => handleDeleteItem(hw._id, item._id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {hw.items.length > 0 && (
                <div className="ge-summary hw-total-summary">
                  <span>{hw.items.length} item(s)</span>
                  <span>Overall Price: {formatLKR(hardwareTotal(hw))}</span>
                </div>
              )}

              {/* This supplier's own invoices (raised via "+ Raise Invoice"
                  in the Hardware Invoices section above) - shown right here
                  too, all together with a Status column instead of split
                  into Pending/Paid tabs, so you can see everything for this
                  supplier in one place. */}
              {hw.invoices?.length > 0 && (
                <>
                  <p className="sa-group-title hw-payments-title">Invoices</p>
                  <div className="hw-table-scroll">
                  <table className="sa-table hw-items-table">
                    <thead>
                      <tr>
                        <th>Invoice No.</th>
                        <th>Project</th>
                        <th>Amount (LKR)</th>
                        <th>Reason</th>
                        <th>Invoice Date</th>
                        <th>Payment Date</th>
                        <th>Reference No.</th>
                        <th>Account No.</th>
                        <th>Bank / Branch</th>
                        <th>Bill</th>
                        <th>Slip</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...hw.invoices]
                        .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', undefined, { sensitivity: 'base' }))
                        .map((inv) => (
                        <tr key={inv._id}>
                          <td>{inv.invoiceNo || '-'}</td>
                          <td>{inv.projectName || '-'}</td>
                          <td>{formatLKR(inv.amount)}</td>
                          <td>{inv.reason || '-'}</td>
                          <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                          <td>{inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}</td>
                          <td>{inv.referenceNo || '-'}</td>
                          <td>{inv.accountNumber || '-'}</td>
                          <td>{[inv.bankName, inv.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                          <td>{inv.billUrl ? <a href={inv.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td>{inv.slipUrl ? <a href={inv.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td>
                            {inv.status === 'paid' ? (
                              <span className="sa-badge sa-badge-approved">Paid</span>
                            ) : (
                              <span className="sa-badge sa-badge-pending">Pending</span>
                            )}
                          </td>
                          <td>
                            <div className="hw-supplier-actions">
                              {inv.status !== 'paid' && (
                                <button className="sa-manage-btn" onClick={() => startPayingHwInvoice(hw, inv)}>
                                  Mark Paid
                                </button>
                              )}
                              <button className="hw-edit-btn" onClick={() => startEditHwInvoice(hw, inv)}>
                                Edit
                              </button>
                              <button className="hw-delete-btn" onClick={() => handleDeleteHwInvoice(hw._id, inv._id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              )}

              {/* Everything actually paid to this supplier - both from legacy
                  bill/slip records and from invoices raised via "+ Raise
                  Invoice" that have since been marked paid. Manage/edit the
                  underlying records from the Hardware Invoices sub-tab. */}
              {(hw.payments.length > 0 || (hw.invoices || []).length > 0) && (
                <div className="ge-summary hw-total-summary">
                  <span>{paidCount(hw)} payment(s)</span>
                  <span>Total Paid: {formatLKR(paymentsTotal(hw))}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- Sub-section: Hardware Best Price Finder ----------
// Given a wishlist of items + quantities, shows which hardware suppliers can
// fulfil them for the lowest total, and which items each supplier is missing.
function HardwarePriceFinder() {
  const [rows, setRows] = useState([{ name: '', quantity: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);
  const [error, setError] = useState('');

  const addRow = () => setRows((prev) => [...prev, { name: '', quantity: '' }]);

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validRows = rows
      .map((r) => ({ name: r.name.trim(), quantity: Number(r.quantity) || 0 }))
      .filter((r) => r.name && r.quantity > 0);

    if (validRows.length === 0) {
      setError('Add at least one item with a name and quantity.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/hardware/quote`, { items: validRows });
      setQuoteResult(res.data);
    } catch (err) {
      console.error(err);
      setError('Something went wrong while fetching the quote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hw-finder">
      <form className="ge-form" onSubmit={handleSubmit}>
        <p className="sa-group-title">Items you need</p>

        {rows.map((row, index) => (
          <div key={index} className="hw-finder-row">
            <input
              type="text"
              placeholder="Item name"
              value={row.name}
              onChange={(e) => updateRow(index, 'name', e.target.value)}
            />
            <input
              type="number"
              placeholder="Quantity"
              min="1"
              value={row.quantity}
              onChange={(e) => updateRow(index, 'quantity', e.target.value)}
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="hw-finder-remove-btn"
                onClick={() => removeRow(index)}
                aria-label="Remove item"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button type="button" className="hw-finder-add-btn" onClick={addRow}>
          + Add another item
        </button>

        {error && <p className="hw-finder-error">{error}</p>}

        <button type="submit" className="ge-save-btn hw-finder-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Calculating...' : 'Find Best Price'}
        </button>
      </form>

      {quoteResult && (
        <div className="hw-quote-results">
          {quoteResult.results.length === 0 ? (
            <p className="hw-empty-text">No hardware supplier stocks any of these items.</p>
          ) : (
            quoteResult.results.map((r, i) => (
              <div key={r.hardwareId} className={`hw-quote-card ${i === 0 ? 'best' : ''}`}>
                <div className="hw-quote-card-header">
                  <div>
                    <h4 className="hw-inline-heading">{r.supplierName}</h4>
                    <p className="hw-supplier-phone">{r.phone}</p>
                  </div>
                  <div className="hw-quote-card-header-right">
                    {i === 0 && <span className="hw-quote-best-badge">Lowest Budget</span>}
                    <span className="hw-quote-total">{formatLKR(r.total)}</span>
                  </div>
                </div>

                <table className="sa-table hw-items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit Price (LKR)</th>
                      <th>Requested Qty</th>
                      <th>Line Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.matchedItems.map((mi) => (
                      <tr key={mi.name}>
                        <td>{mi.name}</td>
                        <td>{formatLKR(mi.unitPrice)}</td>
                        <td>{mi.requestedQuantity}</td>
                        <td>{formatLKR(mi.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {r.missingItems.length > 0 && (
                  <p className="hw-quote-missing">
                    Doesn&apos;t have: {r.missingItems.join(', ')}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Sub-section: Project Summary ----------
// Search by project (construction) name to see, in one place: every
// contractor's estimation plan + amount paid against it, and every hardware
// supplier's payments for that project - plus grand totals.
function ProjectSummary() {
  const [projectNames, refetchProjectNames] = useProjectNames();
  const [projectName, setProjectName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searchedFor, setSearchedFor] = useState('');

  // Contractors / hardware suppliers, needed for the "add plan / payment
  // straight from this project" quick-action forms below.
  const [allContractors, setAllContractors] = useState([]);
  const [allHardware, setAllHardware] = useState([]);
  const [quickAction, setQuickAction] = useState(null); // null | 'plan' | 'hardware' | 'other'

  const [planForm, setPlanForm] = useState({ contractorId: '', totalEstimate: '', note: '' });
  const [planFile, setPlanFile] = useState(null);

  const [hwPayForm, setHwPayForm] = useState({ hardwareId: '', amount: '', date: '', reason: '', note: '' });
  const [hwBillFiles, setHwBillFiles] = useState([]);

  const [otherForm, setOtherForm] = useState({ title: '', amount: '', paidTo: '', description: '', date: '' });
  const [otherBillFile, setOtherBillFile] = useState(null);

  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/contractors`).then((res) => setAllContractors(res.data)).catch(console.error);
    axios.get(`${API_BASE_URL}/api/hardware`).then((res) => setAllHardware(res.data)).catch(console.error);
  }, []);

  const runSearch = async (trimmed) => {
    if (!trimmed) return;
    setIsSearching(true);
    setError('');
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(trimmed)}/summary`
      );
      setResult(res.data);
      setSearchedFor(trimmed);
    } catch (err) {
      console.error(err);
      setError('Something went wrong while fetching the project summary.');
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed || isSearching) return;
    await runSearch(trimmed);
  };

  const closeQuickAction = () => {
    setQuickAction(null);
    setPlanForm({ contractorId: '', totalEstimate: '', note: '' });
    setPlanFile(null);
    setHwPayForm({ hardwareId: '', amount: '', date: '', reason: '', note: '' });
    setHwBillFiles([]);
    setOtherForm({ title: '', amount: '', paidTo: '', description: '', date: '' });
    setOtherBillFile(null);
  };

  const afterQuickAdd = async () => {
    closeQuickAction();
    refetchProjectNames();
    await runSearch(searchedFor);
  };

  const handleQuickAddPlan = async (e) => {
    e.preventDefault();
    if (!planForm.contractorId || isQuickSubmitting) return;
    setIsQuickSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', searchedFor);
      data.append('totalEstimate', planForm.totalEstimate);
      data.append('note', planForm.note);
      if (planFile) data.append('plan', planFile);
      await axios.post(
        `${API_BASE_URL}/api/contractors/${planForm.contractorId}/plans`,
        data,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      await afterQuickAdd();
    } catch (err) {
      console.error(err);
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleQuickAddHardwareInvoice = async (e) => {
    e.preventDefault();
    if (!hwPayForm.hardwareId || isQuickSubmitting) return;
    setIsQuickSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', searchedFor);
      data.append('amount', hwPayForm.amount);
      if (hwPayForm.date) data.append('date', hwPayForm.date);
      data.append('reason', hwPayForm.reason);
      data.append('note', hwPayForm.note);
      hwBillFiles.forEach((file) => data.append('bills', file));
      await axios.post(
        `${API_BASE_URL}/api/hardware/${hwPayForm.hardwareId}/invoices`,
        data
      );
      await afterQuickAdd();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not raise the invoice. Please check the backend server and try again.');
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleQuickAddOtherPayment = async (e) => {
    e.preventDefault();
    if (isQuickSubmitting) return;
    setIsQuickSubmitting(true);
    try {
      const data = new FormData();
      data.append('title', otherForm.title);
      data.append('amount', otherForm.amount);
      data.append('paidTo', otherForm.paidTo);
      data.append('projectName', searchedFor);
      data.append('description', otherForm.description);
      if (otherForm.date) data.append('date', otherForm.date);
      if (otherBillFile) data.append('bill', otherBillFile);
      await axios.post(`${API_BASE_URL}/api/construction-payments`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await afterQuickAdd();
    } catch (err) {
      console.error(err);
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const hasData =
    result && (result.contractors.length > 0 || result.hardware.length > 0 || (result.otherPayments || []).length > 0);

  return (
    <div className="project-summary">
      <form className="ge-form project-search-form" onSubmit={handleSearch}>
        <p className="sa-group-title">Search by project / construction name</p>
        <div className="ge-form-row">
          <select
            value={projectNames.includes(projectName) ? projectName : ''}
            onChange={(e) => setProjectName(e.target.value)}
          >
            <option value="">
              {projectNames.length === 0 ? 'No projects yet' : 'Select project (A-Z)...'}
            </option>
            {projectNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="...or type a project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button type="submit" className="ge-save-btn" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && <p className="hw-finder-error">{error}</p>}
      </form>

      {result && !hasData && (
        <p className="hw-empty-text">No contractor plans, hardware payments, or other payments found for "{searchedFor}".</p>
      )}

      {searchedFor && (
        <div className="ge-header project-quick-actions-header">
          <p className="sa-group-title project-section-title">Add to "{searchedFor}"</p>
          <div className="project-quick-actions">
            <button type="button" className="hw-finder-add-btn" onClick={() => setQuickAction(quickAction === 'plan' ? null : 'plan')}>
              {quickAction === 'plan' ? 'Cancel' : '+ Upload Estimation Plan'}
            </button>
            <button type="button" className="hw-finder-add-btn" onClick={() => setQuickAction(quickAction === 'hardware' ? null : 'hardware')}>
              {quickAction === 'hardware' ? 'Cancel' : '+ Raise Hardware Invoice'}
            </button>
            <button type="button" className="hw-finder-add-btn" onClick={() => setQuickAction(quickAction === 'other' ? null : 'other')}>
              {quickAction === 'other' ? 'Cancel' : '+ Other Payment'}
            </button>
          </div>
        </div>
      )}

      {quickAction === 'plan' && (
        <form onSubmit={handleQuickAddPlan} className="hw-item-form">
          <div className="ge-form-row">
            <select
              value={planForm.contractorId}
              onChange={(e) => setPlanForm({ ...planForm, contractorId: e.target.value })}
              required
            >
              <option value="">Select contractor...</option>
              {allContractors.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Total estimate (LKR)"
              value={planForm.totalEstimate}
              onChange={(e) => setPlanForm({ ...planForm, totalEstimate: sanitizeAmountInput(e.target.value) })}
              required
            />
          </div>
          <div className="ge-form-row">
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setPlanFile(e.target.files[0])} />
          </div>
          <textarea
            placeholder="Note (optional)"
            value={planForm.note}
            onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })}
            rows={2}
          />
          <button type="submit" className="ge-save-btn" disabled={isQuickSubmitting}>
            {isQuickSubmitting ? 'Saving...' : 'Save Plan'}
          </button>
        </form>
      )}

      {quickAction === 'hardware' && (
        <form onSubmit={handleQuickAddHardwareInvoice} className="hw-item-form">
          <div className="ge-form-row">
            <select
              value={hwPayForm.hardwareId}
              onChange={(e) => setHwPayForm({ ...hwPayForm, hardwareId: e.target.value })}
              required
            >
              <option value="">Select hardware supplier...</option>
              {allHardware.map((hw) => (
                <option key={hw._id} value={hw._id}>{hw.supplierName}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (LKR)"
              value={hwPayForm.amount}
              onChange={(e) => setHwPayForm({ ...hwPayForm, amount: sanitizeAmountInput(e.target.value) })}
              required
            />
          </div>
          <div className="ge-form-row">
            <input
              type="date"
              value={hwPayForm.date}
              onChange={(e) => setHwPayForm({ ...hwPayForm, date: e.target.value })}
            />
            <input
              type="text"
              placeholder="Reason for this invoice"
              value={hwPayForm.reason}
              onChange={(e) => setHwPayForm({ ...hwPayForm, reason: e.target.value })}
              required
            />
          </div>
          <div className="ge-form-row upload-row">
            <div className="upload-field">
              <label className="upload-field-label">Hardware bills (select one or more)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (selected.length) {
                    setHwBillFiles((prev) => {
                      const merged = [...prev, ...selected];
                      const seen = new Set();
                      return merged.filter((file) => {
                        const key = `${file.name}-${file.size}-${file.lastModified}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                    });
                  }
                  e.target.value = '';
                }}
              />
              {hwBillFiles.length > 0 && (
                <div className="selected-file-list">
                  <small>{hwBillFiles.length} bill(s) selected</small>
                  {hwBillFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="selected-file-row">
                      <span>{index + 1}. {file.name}</span>
                      <button
                        type="button"
                        onClick={() => setHwBillFiles((prev) => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
                      >Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <textarea
            placeholder="Note (optional)"
            value={hwPayForm.note}
            onChange={(e) => setHwPayForm({ ...hwPayForm, note: e.target.value })}
            rows={2}
          />
          <button type="submit" className="ge-save-btn" disabled={isQuickSubmitting}>
            {isQuickSubmitting ? 'Saving...' : 'Raise Invoice'}
          </button>
        </form>
      )}

      {quickAction === 'other' && (
        <form onSubmit={handleQuickAddOtherPayment} className="hw-item-form">
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Payment title"
              value={otherForm.title}
              onChange={(e) => setOtherForm({ ...otherForm, title: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Amount (LKR)"
              value={otherForm.amount}
              onChange={(e) => setOtherForm({ ...otherForm, amount: sanitizeAmountInput(e.target.value) })}
              required
            />
          </div>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Paid to"
              value={otherForm.paidTo}
              onChange={(e) => setOtherForm({ ...otherForm, paidTo: e.target.value })}
            />
            <input
              type="date"
              value={otherForm.date}
              onChange={(e) => setOtherForm({ ...otherForm, date: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setOtherBillFile(e.target.files[0])} />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={otherForm.description}
            onChange={(e) => setOtherForm({ ...otherForm, description: e.target.value })}
            rows={2}
          />
          {/* This raises an invoice (status: pending) the same way the main
              Construction Payments tab does - the reference no. and bank
              details are only entered once it's marked as paid from there. */}
          <button type="submit" className="ge-save-btn" disabled={isQuickSubmitting}>
            {isQuickSubmitting ? 'Saving...' : 'Raise Invoice'}
          </button>
        </form>
      )}

      {hasData && (
        <>
          <div className="project-summary-totals">
            <div className="sa-stat-card sa-stat-total">
              <p>Total Estimated</p>
              <h2>{formatLKR(result.summary.totalEstimate)}</h2>
            </div>
            <div className="sa-stat-card sa-stat-approved">
              <p>Paid to Contractors</p>
              <h2>{formatLKR(result.summary.totalContractorPaid)}</h2>
            </div>
            <div className="sa-stat-card">
              <p>Paid to Hardware</p>
              <h2>{formatLKR(result.summary.totalHardwarePaid)}</h2>
            </div>
            <div className="sa-stat-card">
              <p>Other Payments</p>
              <h2>{formatLKR(result.summary.totalOtherPaid)}</h2>
            </div>
            <div className="sa-stat-card sa-stat-total">
              <p>Total Paid (All)</p>
              <h2>{formatLKR(result.summary.totalPaidOverall)}</h2>
            </div>
            <div className="sa-stat-card sa-stat-rejected">
              <p>Remaining (vs Estimate)</p>
              <h2>{formatLKR(result.summary.remaining)}</h2>
            </div>
          </div>

          {result.contractors.length > 0 && (
            <div className="project-section">
              <p className="sa-group-title project-section-title">Contractor Breakdown</p>
              {result.contractors.map((c) => (
                <div key={c.contractorId} className="hw-quote-card project-contractor-card">
                  <div className="hw-quote-card-header">
                    <div>
                      <h4 className="hw-inline-heading">{c.name}</h4>
                      <p className="hw-supplier-phone">{c.phone}</p>
                    </div>
                    <div className="hw-quote-card-header-right">
                      <span className="hw-quote-total">
                        {formatLKR(c.totalPaid)} / {formatLKR(c.totalEstimate)}
                      </span>
                    </div>
                  </div>

                  {c.payments.length > 0 && (
                    <table className="sa-table hw-items-table">
                      <thead>
                        <tr>
                          <th>Invoice No.</th>
                          <th>Amount (LKR)</th>
                          <th>Invoice Date</th>
                          <th>Reason</th>
                          <th>Payment Date</th>
                          <th>Reference No.</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.payments.map((p, i) => {
                          const paid = p.status !== 'pending';
                          return (
                            <tr key={i}>
                              <td>{p.invoiceNo || '-'}</td>
                              <td>{formatLKR(p.amount)}</td>
                              <td>{p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString() : '-'}</td>
                              <td>{p.reason || '-'}</td>
                              <td>{paid && p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}</td>
                              <td>{paid ? (p.referenceNo || '-') : '-'}</td>
                              <td>
                                <span className={`sa-badge ${paid ? 'sa-badge-approved' : 'sa-badge-pending'}`}>
                                  {paid ? 'Paid' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.hardware.length > 0 && (
            <div className="project-section">
              <p className="sa-group-title project-section-title">Hardware Breakdown (highest spend first)</p>
              {result.hardware.map((hw) => (
                <div key={hw.hardwareId} className="hw-quote-card project-contractor-card">
                  <div className="hw-quote-card-header">
                    <div>
                      <h4 className="hw-inline-heading">{hw.supplierName}</h4>
                      <p className="hw-supplier-phone">{hw.phone}</p>
                    </div>
                    <div className="hw-quote-card-header-right">
                      <span className="hw-quote-total">{formatLKR(hw.totalPaid)}</span>
                    </div>
                  </div>

                  <table className="sa-table hw-items-table">
                    <thead>
                      <tr>
                        <th>Amount (LKR)</th>
                        <th>Date</th>
                        <th>Reference No.</th>
                        <th>Bills</th>
                        <th>Slip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hw.payments.map((p, i) => (
                        <tr key={i}>
                          <td>{formatLKR(p.amount)}</td>
                          <td>{new Date(p.date).toLocaleDateString()}</td>
                          <td>{p.referenceNo || '-'}</td>
                          <td>{p.bills?.length > 0 ? (
                            <span>{p.bills.length} bill(s) — {p.bills.map((b, i) => (
                              <span key={b.url || i}>{i > 0 ? ', ' : ''}<a href={b.url} target="_blank" rel="noreferrer" className="ge-slip-link">View {i + 1}</a></span>
                            ))}</span>
                          ) : p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {(result.otherPayments || []).length > 0 && (
            <div className="project-section">
              <p className="sa-group-title project-section-title">Other Payments</p>
              <table className="sa-table hw-items-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Paid To</th>
                    <th>Cheque / Reference No.</th>
                    <th>Amount (LKR)</th>
                    <th>Date</th>
                    <th>Bill</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.otherPayments.map((p) => {
                    const paid = p.status !== 'pending';
                    return (
                      <tr key={p._id}>
                        <td>{p.title}</td>
                        <td>{p.paidTo || '-'}</td>
                        <td>{paid ? (p.referenceNo || '-') : '-'}</td>
                        <td>{formatLKR(p.amount)}</td>
                        <td>{new Date(p.date).toLocaleDateString()}</td>
                        <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                        <td>
                          <span className={`sa-badge ${paid ? 'sa-badge-approved' : 'sa-badge-pending'}`}>
                            {paid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SuperAdminDashboard;