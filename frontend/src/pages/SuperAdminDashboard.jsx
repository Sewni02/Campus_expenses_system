import { useState, useEffect } from 'react';
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
      const res = await axios.get('/api/projects');
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
  const [activeTab, setActiveTab] = useState('A');

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
      const res = await axios.get('/api/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/stats`);
      const res = await axios.get('/api/admin/stats');
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
        `/api/admin/users/${managingUser._id}/approve`,
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
      await axios.put(`/api/admin/users/${managingUser._id}/reject`);
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
  const [subTab, setSubTab] = useState('contractors');

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

  useEffect(() => {
    fetchContractors();
  }, [searchTerm]);

  const fetchContractors = async () => {
    try {
      const url = searchTerm
        ? `${API_BASE_URL}/api/contractors?search=${encodeURIComponent(searchTerm)}`
        : `${API_BASE_URL}/api/contractors`;
        ? `/api/contractors?search=${encodeURIComponent(searchTerm)}`
        : '/api/contractors';
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
      const res = await axios.post('/api/contractors', formData);
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
      const res = await axios.put(`/api/contractors/${viewingContractor._id}`, editForm);
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
      await axios.delete(`/api/contractors/${viewingContractor._id}`);
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
        `/api/contractors/${viewingContractor._id}/plans`,
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

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Delete this estimation plan? This cannot be undone.')) return;
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/contractors/${viewingContractor._id}/plans/${planId}`
        `/api/contractors/${viewingContractor._id}/plans/${planId}`
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
                            <button className="hw-delete-btn" onClick={() => handleDeletePlan(plan._id)}>
                              Delete
                            </button>
                          </div>
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
  const [payments, setPayments] = useState([]);
  const [projectNames, refetchProjectNames] = useProjectNames();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: '', paidTo: '', referenceNo: '', projectName: '', description: '', date: '', accountNumber: '', bankName: '', bankBranch: '' });
  const [bill, setBill] = useState(null);

  // Contractor payment recording - always linked to one of the contractor's estimation plans
  const [contractors, setContractors] = useState([]);
  const [showContractorPayForm, setShowContractorPayForm] = useState(false);
  const [contractorId, setContractorId] = useState('');
  const [planId, setPlanId] = useState('');
  const [paymentType, setPaymentType] = useState('direct_slip'); // 'direct_slip' | 'bill_then_payment'
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payReferenceNo, setPayReferenceNo] = useState('');
  const [payAccountNumber, setPayAccountNumber] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payBankBranch, setPayBankBranch] = useState('');
  const [payReason, setPayReason] = useState('');
  const [payNote, setPayNote] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);
  const [isOtherPaySubmitting, setIsOtherPaySubmitting] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchContractorsList();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/construction-payments`);
      const res = await axios.get('/api/construction-payments');
      setPayments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContractorsList = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/contractors`);
      const res = await axios.get('/api/contractors');
      setContractors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (isOtherPaySubmitting) return;
    setIsOtherPaySubmitting(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('amount', formData.amount);
      data.append('paidTo', formData.paidTo);
      data.append('referenceNo', formData.referenceNo);
      data.append('projectName', formData.projectName);
      data.append('description', formData.description);
      data.append('accountNumber', formData.accountNumber);
      data.append('bankName', formData.bankName);
      data.append('bankBranch', formData.bankBranch);
      if (formData.date) data.append('date', formData.date);
      if (bill) data.append('bill', bill);

      const res = await axios.post(`${API_BASE_URL}/api/construction-payments`, data, {
      await axios.post('/api/construction-payments', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPayments((prev) => [res.data.payment, ...prev]);
      setFormData({ title: '', amount: '', paidTo: '', referenceNo: '', projectName: '', description: '', date: '', accountNumber: '', bankName: '', bankBranch: '' });
      setBill(null);
      setShowForm(false);
      refetchProjectNames();
    } catch (err) {
      console.error(err);
    } finally {
      setIsOtherPaySubmitting(false);
    }
  };

  const handleDeleteOtherPayment = async (paymentId) => {
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/construction-payments/${paymentId}`);
      await axios.delete(`/api/construction-payments/${paymentId}`);
      setPayments((prev) => prev.filter((p) => p._id !== paymentId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the payment. Please check the backend server is running and try again.');
    }
  };

  const resetContractorPayForm = () => {
    setContractorId('');
    setPlanId('');
    setPaymentType('direct_slip');
    setPayAmount('');
    setPayDate('');
    setPayReferenceNo('');
    setPayAccountNumber('');
    setPayBankName('');
    setPayBankBranch('');
    setPayReason('');
    setPayNote('');
    setSlipFile(null);
    setBillFile(null);
  };

  const selectedContractor = contractors.find((c) => c._id === contractorId);
  const selectedPlan = selectedContractor?.estimationPlans.find((p) => p._id === planId);

  const handleRecordContractorPayment = async (e) => {
    e.preventDefault();
    if (!contractorId || !planId || isPaySubmitting) return;
    setIsPaySubmitting(true);
    try {
      const data = new FormData();
      data.append('amount', payAmount);
      if (payDate) data.append('date', payDate);
      data.append('reason', payReason);
      data.append('note', payNote);
      data.append('paymentType', paymentType);
      data.append('planId', planId);
      data.append('referenceNo', payReferenceNo);
      data.append('accountNumber', payAccountNumber);
      data.append('bankName', payBankName);
      data.append('bankBranch', payBankBranch);
      if (slipFile) data.append('slip', slipFile);
      if (paymentType === 'bill_then_payment' && billFile) data.append('bill', billFile);

      await axios.post(
        `${API_BASE_URL}/api/contractors/${contractorId}/payments`,
        `/api/contractors/${contractorId}/payments`,
        data,
      );

      resetContractorPayForm();
      setShowContractorPayForm(false);
      fetchContractorsList();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPaySubmitting(false);
    }
  };

  const handleDeleteContractorPayment = async (contractorId, paymentId) => {
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/contractors/${contractorId}/payments/${paymentId}`);
      const res = await axios.delete(`/api/contractors/${contractorId}/payments/${paymentId}`);
      const updated = res.data.contractor;
      setContractors((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the payment. Please check the backend server is running and try again.');
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      {/* GENERAL CONSTRUCTION PAYMENTS */}
      <div className="ge-header">
        <h3 className="hw-inline-heading">Construction Payments</h3>
        <button className="ge-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Payment'}
        </button>
      </div>

      {showForm && (
        <form className="ge-form" onSubmit={handleAddPayment}>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Payment title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Amount (LKR)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: sanitizeAmountInput(e.target.value) })}
              required
            />
            <input
              type="text"
              placeholder="Paid to"
              value={formData.paidTo}
              onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Cheque / Reference No."
              value={formData.referenceNo}
              onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
              required
            />
          </div>
          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Payee account number"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            />
            <BankNameField value={formData.bankName} onChange={(val) => setFormData({ ...formData, bankName: val })} />
            <input
              type="text"
              placeholder="Payee branch"
              value={formData.bankBranch}
              onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <ProjectNameField
              value={formData.projectName}
              onChange={(val) => setFormData({ ...formData, projectName: val })}
              projectNames={projectNames}
            />
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setBill(e.target.files[0])}
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
          <button type="submit" className="ge-save-btn" disabled={isOtherPaySubmitting}>
            {isOtherPaySubmitting ? 'Saving...' : 'Save Payment'}
          </button>
        </form>
      )}

      <div className="ge-summary">
        <span>{payments.length} payment(s)</span>
        <span>Total: {formatLKR(totalPaid)}</span>
      </div>

      <table className="sa-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Paid To</th>
            <th>Cheque / Reference No.</th>
            <th>Project</th>
            <th>Amount (LKR)</th>
            <th>Account No.</th>
            <th>Bank / Branch</th>
            <th>Date</th>
            <th>Bill</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan="10" className="hw-empty-text">
                No payments found
              </td>
            </tr>
          ) : (
            [...payments]
              .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', undefined, { sensitivity: 'base' }))
              .map((p) => (
              <tr key={p._id}>
                <td>{p.title}</td>
                <td>{p.paidTo || '-'}</td>
                <td>{p.referenceNo || '-'}</td>
                <td>{p.projectName || '-'}</td>
                <td>{formatLKR(p.amount)}</td>
                <td>{p.accountNumber || '-'}</td>
                <td>{[p.bankName, p.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                <td>{new Date(p.date).toLocaleDateString()}</td>
                <td>
                  {p.billUrl ? (
                    <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a>
                  ) : '-'}
                </td>
                <td>
                  <button className="hw-delete-btn" onClick={() => handleDeleteOtherPayment(p._id)}>Delete</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* CONTRACTOR PAYMENTS - always linked to one of the contractor's estimation plans */}
      <div className="ge-header contractor-payments-header">
        <h3 className="hw-inline-heading">Contractor Payments</h3>
        <button className="ge-add-btn" onClick={() => setShowContractorPayForm(!showContractorPayForm)}>
          {showContractorPayForm ? 'Cancel' : '+ Record Contractor Payment'}
        </button>
      </div>

      {showContractorPayForm && (
        <form className="ge-form" onSubmit={handleRecordContractorPayment}>
          <div className="ge-form-row">
            <select
              value={contractorId}
              onChange={(e) => {
                const nextId = e.target.value;
                const nextContractor = contractors.find((c) => c._id === nextId);
                setContractorId(nextId);
                setPlanId('');
                setPayAccountNumber(nextContractor?.accountNumber || '');
                setPayBankName(nextContractor?.bankName || '');
                setPayBankBranch(nextContractor?.bankBranch || '');
              }}
              required
            >
              <option value="">Select contractor...</option>
              {contractors.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>

            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              disabled={!selectedContractor}
              required
            >
              <option value="">Select estimation plan...</option>
              {[...(selectedContractor?.estimationPlans || [])]
                .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }))
                .map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.projectName} ({formatLKR(plan.totalEstimate)})
                  </option>
                ))}
            </select>
          </div>

          {selectedPlan && (
            <div className="ge-summary plan-preview-summary">
              <span>Project: {selectedPlan.projectName}</span>
              <span>Plan Total: {formatLKR(selectedPlan.totalEstimate)}</span>
            </div>
          )}

          <div className="ge-form-row">
            <input
              type="number"
              placeholder="Amount (LKR)"
              value={payAmount}
              onChange={(e) => setPayAmount(sanitizeAmountInput(e.target.value))}
              required
            />
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
            />
          </div>
          <div className="ge-form-row">
            <input type="text" placeholder="Payee account number" value={payAccountNumber} onChange={(e) => setPayAccountNumber(e.target.value)} />
            <BankNameField value={payBankName} onChange={setPayBankName} />
            <input type="text" placeholder="Payee branch" value={payBankBranch} onChange={(e) => setPayBankBranch(e.target.value)} />
          </div>

          <div className="ge-form-row">
            <input
              type="text"
              placeholder="Reason for payment"
              value={payReason}
              onChange={(e) => setPayReason(e.target.value)}
              required
            />
          </div>

          <p className="sa-group-title plan-preview-title">Payment Method</p>
          <div className="ge-form-row">
            <label
              className={`sa-checkbox-row payment-method-option ${paymentType === 'direct_slip' ? 'checked' : ''}`}
              onClick={() => setPaymentType('direct_slip')}
            >
              <span className="sa-checkbox-custom">{paymentType === 'direct_slip' && '✓'}</span>
              Direct Bank Slip
            </label>
            <label
              className={`sa-checkbox-row payment-method-option ${paymentType === 'bill_then_payment' ? 'checked' : ''}`}
              onClick={() => setPaymentType('bill_then_payment')}
            >
              <span className="sa-checkbox-custom">{paymentType === 'bill_then_payment' && '✓'}</span>
              Get Bill, then Bank Payment
            </label>
          </div>

          <div className="ge-form-row upload-row">
            {paymentType === 'bill_then_payment' && (
              <div className="upload-field">
                <label className="upload-field-label">Bill from contractor</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setBillFile(e.target.files[0])}
                />
              </div>
            )}
            <div className="upload-field">
              <label className="upload-field-label">Bank payment slip</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setSlipFile(e.target.files[0])}
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
          <button type="submit" className="ge-save-btn" disabled={isPaySubmitting}>
            {isPaySubmitting ? 'Saving...' : 'Save Payment'}
          </button>
        </form>
      )}

      <table className="sa-table hw-items-table">
        <thead>
          <tr>
            <th>Contractor</th>
            <th>Project</th>
            <th>Amount (LKR)</th>
            <th>Date</th>
            <th>Reference No.</th>
            <th>Account No.</th>
            <th>Bank / Branch</th>
            <th>Reason</th>
            <th>Method</th>
            <th>Bill</th>
            <th>Slip</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contractors.flatMap((c) => c.payments).length === 0 ? (
            <tr>
              <td colSpan="12" className="hw-empty-text">
                No contractor payments recorded
              </td>
            </tr>
          ) : (
            contractors
              .flatMap((c) => c.payments.map((p) => ({ ...p, contractorName: c.name, contractorId: c._id })))
              .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', undefined, { sensitivity: 'base' }))
              .map((p, i) => (
                <tr key={`${p.contractorId}-${i}`}>
                  <td>{p.contractorName}</td>
                  <td>{p.projectName || '-'}</td>
                  <td>{formatLKR(p.amount)}</td>
                  <td>{new Date(p.date).toLocaleDateString()}</td>
                  <td>{p.referenceNo || '-'}</td>
                  <td>{p.accountNumber || '-'}</td>
                  <td>{[p.bankName, p.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                  <td>{p.reason || '-'}</td>
                  <td>{p.paymentType === 'bill_then_payment' ? 'Bill + Payment' : 'Direct Slip'}</td>
                  <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td>
                    <button className="hw-delete-btn" onClick={() => handleDeleteContractorPayment(p.contractorId, p._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Sub-section: Hardware ----------
function Hardware() {
  const [hwTab, setHwTab] = useState('suppliers'); // 'suppliers' | 'finder'
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

  // Bill + bank payment recording, tagged with a project name
  const [recordingPaymentFor, setRecordingPaymentFor] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    projectName: '',
    amount: '',
    date: '',
    referenceNo: '',
    accountNumber: '',
    bankName: '',
    bankBranch: '',
    note: '',
  });
  const [paymentBillFiles, setPaymentBillFiles] = useState([]);
  const [paymentSlipFile, setPaymentSlipFile] = useState(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  useEffect(() => {
    fetchHardware();
  }, []);

  const fetchHardware = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hardware`);
      const res = await axios.get('/api/hardware');
      setHardwareList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/hardware`, formData);
      const res = await axios.post('/api/hardware', formData);
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
      const res = await axios.post(`/api/hardware/${addingItemTo._id}/items`, itemForm);
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
        `/api/hardware/${editingItem.hwId}/items/${editingItem.itemId}`,
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
      const res = await axios.delete(`/api/hardware/${hardwareId}/items/${itemId}`);
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
      const res = await axios.put(`/api/hardware/${hardwareId}`, editSupplierForm);
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
      await axios.delete(`/api/hardware/${hardwareId}`);
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
      const res = await axios.delete(`/api/hardware/${hardwareId}/payments/${paymentId}`);
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Could not delete the payment. Please check the backend server is running and try again.');
    }
  };

  const openPaymentForm = (hardware) => {
    setRecordingPaymentFor(hardware);
    setPaymentForm({ projectName: '', amount: '', date: '', referenceNo: '', accountNumber: hardware.accountNumber || '', bankName: hardware.bankName || '', bankBranch: hardware.bankBranch || '', note: '' });
    setPaymentBillFiles([]);
    setPaymentSlipFile(null);
  };

  const closePaymentForm = () => setRecordingPaymentFor(null);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!recordingPaymentFor || isPaymentSubmitting) return;
    if (paymentBillFiles.length === 0) {
      alert('Please select at least one hardware bill.');
      return;
    }
    if (!paymentSlipFile) {
      alert('Please select the bank payment slip.');
      return;
    }
    setIsPaymentSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', paymentForm.projectName);
      data.append('amount', paymentForm.amount);
      if (paymentForm.date) data.append('date', paymentForm.date);
      data.append('referenceNo', paymentForm.referenceNo);
      data.append('accountNumber', paymentForm.accountNumber);
      data.append('bankName', paymentForm.bankName);
      data.append('bankBranch', paymentForm.bankBranch);
      data.append('note', paymentForm.note);
      paymentBillFiles.forEach((file) => data.append('bills', file));
      if (paymentSlipFile) data.append('slip', paymentSlipFile);

      const res = await axios.post(
        `${API_BASE_URL}/api/hardware/${recordingPaymentFor._id}/payments`,
        `/api/hardware/${recordingPaymentFor._id}/payments`,
        data
      );
      const updatedHardware = res.data.hardware;
      setHardwareList((prev) => prev.map((hw) => (hw._id === updatedHardware._id ? updatedHardware : hw)));
      closePaymentForm();
      refetchProjectNames();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Payment upload failed. Please check the backend server and try again.');
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const itemTotal = (item) => item.unitPrice * item.quantity;
  const hardwareTotal = (hw) => hw.items.reduce((sum, i) => sum + itemTotal(i), 0);
  const paymentsTotal = (hw) => hw.payments.reduce((sum, p) => sum + p.amount, 0);

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
      const res = await axios.post(`/api/hardware/${hardware._id}/order`, { items });
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
          Suppliers
        </button>
        <button
          type="button"
          className={`hw-subtab-btn ${hwTab === 'finder' ? 'active' : ''}`}
          onClick={() => setHwTab('finder')}
        >
          Best Price Finder
        </button>
      </div>

      {hwTab === 'finder' ? (
        <HardwarePriceFinder />
      ) : (
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
                    <button className="sa-manage-btn" onClick={() => openPaymentForm(hw)}>+ Record Payment</button>
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

              {/* RECORD PAYMENT - bill received from supplier + the bank payment made, tagged to a project */}
              {recordingPaymentFor?._id === hw._id && (
                <form onSubmit={handleRecordPayment} className="hw-item-form">
                  <p className="sa-group-title">Record bill &amp; payment</p>
                  <div className="ge-form-row">
                    <ProjectNameField
                      value={paymentForm.projectName}
                      onChange={(val) => setPaymentForm({ ...paymentForm, projectName: val })}
                      projectNames={projectNames}
                    />
                    <input
                      type="number"
                      placeholder="Amount (LKR)"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: sanitizeAmountInput(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="ge-form-row">
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Cheque / Reference No."
                      value={paymentForm.referenceNo}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                    />
                  </div>
                  <div className="ge-form-row">
                    <input type="text" placeholder="Payee account number" value={paymentForm.accountNumber} onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })} />
                    <BankNameField value={paymentForm.bankName} onChange={(val) => setPaymentForm({ ...paymentForm, bankName: val })} />
                    <input type="text" placeholder="Payee branch" value={paymentForm.bankBranch} onChange={(e) => setPaymentForm({ ...paymentForm, bankBranch: e.target.value })} />
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
                            setPaymentBillFiles((prev) => {
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
                      {paymentBillFiles.length > 0 && (
                        <div className="selected-file-list">
                          <small>{paymentBillFiles.length} bill(s) selected</small>
                          {paymentBillFiles.map((file, index) => (
                            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="selected-file-row">
                              <span>{index + 1}. {file.name}</span>
                              <button
                                type="button"
                                onClick={() => setPaymentBillFiles((prev) => prev.filter((_, i) => i !== index))}
                                aria-label={`Remove ${file.name}`}
                              >Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="upload-field">
                      <label className="upload-field-label">Bank payment slip</label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        required
                        onChange={(e) => setPaymentSlipFile(e.target.files[0])}
                      />
                    </div>
                  </div>
                  <textarea
                    placeholder="Note (optional)"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    rows={2}
                    className="payment-note-textarea"
                  />
                  <div className="hw-edit-actions">
                    <button type="submit" className="ge-save-btn" disabled={isPaymentSubmitting}>
                      {isPaymentSubmitting ? 'Saving...' : 'Save Payment'}
                    </button>
                    <button type="button" className="sa-reject-btn" onClick={closePaymentForm}>
                      Cancel
                    </button>
                  </div>
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

              {/* BILLS & PAYMENTS made to this supplier - shown grouped under its name */}
              {hw.payments.length > 0 && (
                <>
                  <p className="sa-group-title hw-payments-title">Bills &amp; Payments</p>
                  <table className="sa-table hw-items-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Amount (LKR)</th>
                        <th>Date</th>
                        <th>Reference No.</th>
                        <th>Account No.</th>
                        <th>Bank / Branch</th>
                        <th>Bills</th>
                        <th>Slip</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...hw.payments]
                        .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }))
                        .map((p) => (
                        <tr key={p._id}>
                          <td>{p.projectName}</td>
                          <td>{formatLKR(p.amount)}</td>
                          <td>{new Date(p.date).toLocaleDateString()}</td>
                          <td>{p.referenceNo || '-'}</td>
                          <td>{p.accountNumber || hw.accountNumber || '-'}</td>
                          <td>{[p.bankName || hw.bankName, p.bankBranch || hw.bankBranch].filter(Boolean).join(' / ') || '-'}</td>
                          <td>{p.bills?.length > 0 ? (
                            <span>{p.bills.length} bill(s) — {p.bills.map((b, i) => (
                              <span key={b.url || i}>{i > 0 ? ', ' : ''}<a href={b.url} target="_blank" rel="noreferrer" className="ge-slip-link">View {i + 1}</a></span>
                            ))}</span>
                          ) : p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                          <td>
                            <button className="hw-delete-btn" onClick={() => handleDeleteHardwarePayment(hw._id, p._id)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ge-summary hw-total-summary">
                    <span>{hw.payments.length} payment(s)</span>
                    <span>Total Paid: {formatLKR(paymentsTotal(hw))}</span>
                  </div>
                </>
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
      const res = await axios.post('/api/hardware/quote', { items: validRows });
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

  const [hwPayForm, setHwPayForm] = useState({ hardwareId: '', amount: '', date: '', referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', note: '' });
  const [hwBillFiles, setHwBillFiles] = useState([]);
  const [hwSlipFile, setHwSlipFile] = useState(null);

  const [otherForm, setOtherForm] = useState({ title: '', amount: '', paidTo: '', referenceNo: '', description: '', date: '' });
  const [otherBillFile, setOtherBillFile] = useState(null);

  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/contractors`).then((res) => setAllContractors(res.data)).catch(console.error);
    axios.get(`${API_BASE_URL}/api/hardware`).then((res) => setAllHardware(res.data)).catch(console.error);
    axios.get('/api/contractors').then((res) => setAllContractors(res.data)).catch(console.error);
    axios.get('/api/hardware').then((res) => setAllHardware(res.data)).catch(console.error);
  }, []);

  const runSearch = async (trimmed) => {
    if (!trimmed) return;
    setIsSearching(true);
    setError('');
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(trimmed)}/summary`
        `/api/projects/${encodeURIComponent(trimmed)}/summary`
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
    setHwPayForm({ hardwareId: '', amount: '', date: '', referenceNo: '', accountNumber: '', bankName: '', bankBranch: '', reason: '', note: '' });
    setHwBillFile(null);
    setHwSlipFile(null);
    setOtherForm({ title: '', amount: '', paidTo: '', referenceNo: '', description: '', date: '' });
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
        `/api/contractors/${planForm.contractorId}/plans`,
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

  const handleQuickAddHardwarePayment = async (e) => {
    e.preventDefault();
    if (!hwPayForm.hardwareId || isQuickSubmitting) return;
    if (hwBillFiles.length === 0) {
      alert('Please select at least one hardware bill.');
      return;
    }
    if (!hwSlipFile) {
      alert('Please select the bank payment slip.');
      return;
    }
    setIsQuickSubmitting(true);
    try {
      const data = new FormData();
      data.append('projectName', searchedFor);
      data.append('amount', hwPayForm.amount);
      if (hwPayForm.date) data.append('date', hwPayForm.date);
      data.append('referenceNo', hwPayForm.referenceNo);
      data.append('accountNumber', hwPayForm.accountNumber);
      data.append('bankName', hwPayForm.bankName);
      data.append('bankBranch', hwPayForm.bankBranch);
      data.append('note', hwPayForm.note);
      hwBillFiles.forEach((file) => data.append('bills', file));
      if (hwSlipFile) data.append('slip', hwSlipFile);
      await axios.post(
        `${API_BASE_URL}/api/hardware/${hwPayForm.hardwareId}/payments`,
        `/api/hardware/${hwPayForm.hardwareId}/payments`,
        data
      );
      await afterQuickAdd();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Payment upload failed. Please check the backend server and try again.');
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
      data.append('referenceNo', otherForm.referenceNo);
      data.append('projectName', searchedFor);
      data.append('description', otherForm.description);
      if (otherForm.date) data.append('date', otherForm.date);
      if (otherBillFile) data.append('bill', otherBillFile);
      await axios.post(`${API_BASE_URL}/api/construction-payments`, data, {
      await axios.post('/api/construction-payments', data, {
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
              {quickAction === 'hardware' ? 'Cancel' : '+ Hardware Payment'}
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
        <form onSubmit={handleQuickAddHardwarePayment} className="hw-item-form">
          <div className="ge-form-row">
            <select
              value={hwPayForm.hardwareId}
              onChange={(e) => {
                const nextId = e.target.value;
                const nextHardware = allHardware.find((hw) => hw._id === nextId);
                setHwPayForm({ ...hwPayForm, hardwareId: nextId, accountNumber: nextHardware?.accountNumber || '', bankName: nextHardware?.bankName || '', bankBranch: nextHardware?.bankBranch || '' });
              }}
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
              placeholder="Reference No."
              value={hwPayForm.referenceNo}
              onChange={(e) => setHwPayForm({ ...hwPayForm, referenceNo: e.target.value })}
            />
          </div>
          <div className="ge-form-row">
            <input type="text" placeholder="Payee account number" value={hwPayForm.accountNumber} onChange={(e) => setHwPayForm({ ...hwPayForm, accountNumber: e.target.value })} />
            <BankNameField value={hwPayForm.bankName} onChange={(val) => setHwPayForm({ ...hwPayForm, bankName: val })} />
            <input type="text" placeholder="Payee branch" value={hwPayForm.bankBranch} onChange={(e) => setHwPayForm({ ...hwPayForm, bankBranch: e.target.value })} />
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
            <div className="upload-field">
              <label className="upload-field-label">Bank slip</label>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" required onChange={(e) => setHwSlipFile(e.target.files[0])} />
            </div>
          </div>
          <textarea
            placeholder="Note (optional)"
            value={hwPayForm.note}
            onChange={(e) => setHwPayForm({ ...hwPayForm, note: e.target.value })}
            rows={2}
          />
          <button type="submit" className="ge-save-btn" disabled={isQuickSubmitting}>
            {isQuickSubmitting ? 'Saving...' : 'Save Payment'}
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
            <input
              type="text"
              placeholder="Cheque / Reference No."
              value={otherForm.referenceNo}
              onChange={(e) => setOtherForm({ ...otherForm, referenceNo: e.target.value })}
              required
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
          <button type="submit" className="ge-save-btn" disabled={isQuickSubmitting}>
            {isQuickSubmitting ? 'Saving...' : 'Save Payment'}
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
                          <th>Amount (LKR)</th>
                          <th>Date</th>
                          <th>Reference No.</th>
                          <th>Reason</th>
                          <th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.payments.map((p, i) => (
                          <tr key={i}>
                            <td>{formatLKR(p.amount)}</td>
                            <td>{new Date(p.date).toLocaleDateString()}</td>
                            <td>{p.referenceNo || '-'}</td>
                            <td>{p.reason || '-'}</td>
                            <td>{p.paymentType === 'bill_then_payment' ? 'Bill + Payment' : 'Direct Slip'}</td>
                          </tr>
                        ))}
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
                  </tr>
                </thead>
                <tbody>
                  {result.otherPayments.map((p) => (
                    <tr key={p._id}>
                      <td>{p.title}</td>
                      <td>{p.paidTo || '-'}</td>
                      <td>{p.referenceNo || '-'}</td>
                      <td>{formatLKR(p.amount)}</td>
                      <td>{new Date(p.date).toLocaleDateString()}</td>
                      <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                    </tr>
                  ))}
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