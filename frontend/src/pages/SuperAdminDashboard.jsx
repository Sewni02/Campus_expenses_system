import { useState, useEffect } from 'react';
import axios from 'axios';
import './SuperAdminDashboard.css';

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
        {activeTab === 'A' && <UserManagement />}
        {activeTab === 'B' && <Constructions />}
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
      const res = await axios.get('http://localhost:5000/api/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/stats');
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
        `http://localhost:5000/api/admin/users/${managingUser._id}/approve`,
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
      await axios.put(`http://localhost:5000/api/admin/users/${managingUser._id}/reject`);
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

      {subTab === 'contractors' && <Contractors />}
      {subTab === 'payments' && <ConstructionPayments />}
      {subTab === 'hardware' && <Hardware />}
    </div>
  );
}

// ---------- Sub-section: Contractors ----------
function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', registrationDate: '' });

  const [viewingContractor, setViewingContractor] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', registrationDate: '' });

  useEffect(() => {
    fetchContractors();
  }, [searchTerm]);

  const fetchContractors = async () => {
    try {
      const url = searchTerm
        ? `http://localhost:5000/api/contractors?search=${encodeURIComponent(searchTerm)}`
        : 'http://localhost:5000/api/contractors';
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
    try {
      await axios.post('http://localhost:5000/api/contractors', formData);
      setFormData({ name: '', phone: '', registrationDate: '' });
      setShowForm(false);
      fetchContractors();
    } catch (err) {
      console.error(err);
    }
  };

  const openProfile = (contractor) => {
    setViewingContractor(contractor);
    setIsEditing(false);
  };

  const closeProfile = () => {
    setViewingContractor(null);
    setIsEditing(false);
  };

  const startEdit = () => {
    setEditForm({
      name: viewingContractor.name,
      phone: viewingContractor.phone,
      registrationDate: viewingContractor.registrationDate
        ? new Date(viewingContractor.registrationDate).toISOString().slice(0, 10)
        : '',
    });
    setIsEditing(true);
  };

  const handleUpdateContractor = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/contractors/${viewingContractor._id}`, editForm);
      setIsEditing(false);
      fetchContractors();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteContractor = async () => {
    if (!window.confirm(`Delete ${viewingContractor.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`http://localhost:5000/api/contractors/${viewingContractor._id}`);
      closeProfile();
      fetchContractors();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPaid = (contractor) =>
    contractor.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="ge-header">
        <h3 style={{ margin: 0 }}>Registered Contractors</h3>
        <button className="ge-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Contractor'}
        </button>
      </div>

      <div className="ge-form-row" style={{ marginBottom: '16px' }}>
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            <input
              type="date"
              value={formData.registrationDate}
              onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
            />
          </div>
          <button type="submit" className="ge-save-btn">Save Contractor</button>
        </form>
      )}

      <div className="sa-table-panel-row">
        <table className={`sa-table ${viewingContractor ? 'shrink' : ''}`}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              {!viewingContractor && <th>Registered On</th>}
              <th>Total Paid (Rs.)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {contractors.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
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
                  <td>{totalPaid(c).toLocaleString()}</td>
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

        {/* PROFILE PANEL - view / update / delete only, no payment form here */}
        {viewingContractor && (
          <div className="sa-permission-panel">
            <div className="sa-panel-header">
              <h3>{isEditing ? 'Edit Contractor' : viewingContractor.name}</h3>
              <span className="sa-close-btn" onClick={closeProfile}>✕</span>
            </div>

            {!isEditing ? (
              <>
                <p className="sa-panel-email">{viewingContractor.phone}</p>
                <div className="ge-summary" style={{ marginTop: '10px' }}>
                  <span>Registered On</span>
                  <span>{new Date(viewingContractor.registrationDate).toLocaleDateString()}</span>
                </div>
                <div className="ge-summary">
                  <span>Total Paid</span>
                  <span>Rs. {totalPaid(viewingContractor).toLocaleString()}</span>
                </div>

                <div className="sa-panel-actions">
                  <button className="sa-save-btn" onClick={startEdit}>Update</button>
                  <button className="sa-reject-btn" onClick={handleDeleteContractor}>Delete</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleUpdateContractor}>
                <div className="auth-field" style={{ marginTop: '14px' }}>
                  <label>Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
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

                <div className="sa-panel-actions">
                  <button type="submit" className="sa-save-btn">Save Changes</button>
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
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: '', paidTo: '', description: '', date: '' });
  const [bill, setBill] = useState(null);

  // Contractor payment recording
  const [contractors, setContractors] = useState([]);
  const [showContractorPayForm, setShowContractorPayForm] = useState(false);
  const [contractorId, setContractorId] = useState('');
  const [paymentType, setPaymentType] = useState('direct_slip'); // 'direct_slip' | 'bill_then_payment'
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payNote, setPayNote] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [billFile, setBillFile] = useState(null);

  useEffect(() => {
    fetchPayments();
    fetchContractorsList();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/construction-payments');
      setPayments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContractorsList = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/contractors');
      setContractors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('amount', formData.amount);
      data.append('paidTo', formData.paidTo);
      data.append('description', formData.description);
      if (formData.date) data.append('date', formData.date);
      if (bill) data.append('bill', bill);

      await axios.post('http://localhost:5000/api/construction-payments', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFormData({ title: '', amount: '', paidTo: '', description: '', date: '' });
      setBill(null);
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      console.error(err);
    }
  };

  const resetContractorPayForm = () => {
    setContractorId('');
    setPaymentType('direct_slip');
    setPayAmount('');
    setPayDate('');
    setPayNote('');
    setSlipFile(null);
    setBillFile(null);
  };

  const handleRecordContractorPayment = async (e) => {
    e.preventDefault();
    if (!contractorId) return;
    try {
      const data = new FormData();
      data.append('amount', payAmount);
      if (payDate) data.append('date', payDate);
      data.append('note', payNote);
      data.append('paymentType', paymentType);
      if (slipFile) data.append('slip', slipFile);
      if (paymentType === 'bill_then_payment' && billFile) data.append('bill', billFile);

      await axios.post(
        `http://localhost:5000/api/contractors/${contractorId}/payments`,
        data,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      resetContractorPayForm();
      setShowContractorPayForm(false);
      fetchContractorsList();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      {/* GENERAL CONSTRUCTION PAYMENTS */}
      <div className="ge-header">
        <h3 style={{ margin: 0 }}>Construction Payments</h3>
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
              placeholder="Amount (Rs.)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
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
          <button type="submit" className="ge-save-btn">Save Payment</button>
        </form>
      )}

      <div className="ge-summary">
        <span>{payments.length} payment(s)</span>
        <span>Total: Rs. {totalPaid.toLocaleString()}</span>
      </div>

      <table className="sa-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Paid To</th>
            <th>Amount (Rs.)</th>
            <th>Date</th>
            <th>Bill</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                No payments found
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p._id}>
                <td>{p.title}</td>
                <td>{p.paidTo || '-'}</td>
                <td>{p.amount.toLocaleString()}</td>
                <td>{new Date(p.date).toLocaleDateString()}</td>
                <td>
                  {p.billUrl ? (
                    <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a>
                  ) : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* CONTRACTOR PAYMENTS - direct slip OR bill-then-payment */}
      <div className="ge-header" style={{ marginTop: '36px' }}>
        <h3 style={{ margin: 0 }}>Contractor Payments</h3>
        <button className="ge-add-btn" onClick={() => setShowContractorPayForm(!showContractorPayForm)}>
          {showContractorPayForm ? 'Cancel' : '+ Record Contractor Payment'}
        </button>
      </div>

      {showContractorPayForm && (
        <form className="ge-form" onSubmit={handleRecordContractorPayment}>
          <div className="ge-form-row">
            <select value={contractorId} onChange={(e) => setContractorId(e.target.value)} required>
              <option value="">Select contractor...</option>
              {contractors.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (Rs.)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
            />
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          <p className="sa-group-title" style={{ marginTop: '10px' }}>Payment Method</p>
          <div className="ge-form-row">
            <label
              className={`sa-checkbox-row ${paymentType === 'direct_slip' ? 'checked' : ''}`}
              onClick={() => setPaymentType('direct_slip')}
              style={{ flex: 1 }}
            >
              <span className="sa-checkbox-custom">{paymentType === 'direct_slip' && '✓'}</span>
              Direct Bank Slip
            </label>
            <label
              className={`sa-checkbox-row ${paymentType === 'bill_then_payment' ? 'checked' : ''}`}
              onClick={() => setPaymentType('bill_then_payment')}
              style={{ flex: 1 }}
            >
              <span className="sa-checkbox-custom">{paymentType === 'bill_then_payment' && '✓'}</span>
              Get Bill, then Bank Payment
            </label>
          </div>

          <div className="ge-form-row" style={{ marginTop: '10px' }}>
            {paymentType === 'bill_then_payment' && (
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Bill from contractor</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setBillFile(e.target.files[0])}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#666' }}>Bank payment slip</label>
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
            style={{ marginTop: '10px' }}
          />
          <button type="submit" className="ge-save-btn">Save Payment</button>
        </form>
      )}

      <table className="sa-table" style={{ marginTop: '12px' }}>
        <thead>
          <tr>
            <th>Contractor</th>
            <th>Amount (Rs.)</th>
            <th>Date</th>
            <th>Method</th>
            <th>Bill</th>
            <th>Slip</th>
          </tr>
        </thead>
        <tbody>
          {contractors.flatMap((c) =>
            c.payments.map((p, i) => (
              <tr key={`${c._id}-${i}`}>
                <td>{c.name}</td>
                <td>{p.amount.toLocaleString()}</td>
                <td>{new Date(p.date).toLocaleDateString()}</td>
                <td>{p.paymentType === 'bill_then_payment' ? 'Bill + Payment' : 'Direct Slip'}</td>
                <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
              </tr>
            ))
          ).length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                No contractor payments recorded
              </td>
            </tr>
          ) : (
            contractors.flatMap((c) =>
              c.payments.map((p, i) => (
                <tr key={`${c._id}-${i}`}>
                  <td>{c.name}</td>
                  <td>{p.amount.toLocaleString()}</td>
                  <td>{new Date(p.date).toLocaleDateString()}</td>
                  <td>{p.paymentType === 'bill_then_payment' ? 'Bill + Payment' : 'Direct Slip'}</td>
                  <td>{p.billUrl ? <a href={p.billUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                  <td>{p.slipUrl ? <a href={p.slipUrl} target="_blank" rel="noreferrer" className="ge-slip-link">View</a> : '-'}</td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Sub-section: Hardware ----------
function Hardware() {
  const [hardwareList, setHardwareList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ supplierName: '', phone: '' });

  const [addingItemTo, setAddingItemTo] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', unitPrice: '', quantity: '' });

  // Order form state: hardwareId -> { itemId: { checked, quantity } }
  const [orderingFor, setOrderingFor] = useState(null);
  const [orderSelections, setOrderSelections] = useState({});
  const [lastOrderTotal, setLastOrderTotal] = useState(null);

  useEffect(() => {
    fetchHardware();
  }, []);

  const fetchHardware = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/hardware');
      setHardwareList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/hardware', formData);
      setFormData({ supplierName: '', phone: '' });
      setShowForm(false);
      fetchHardware();
    } catch (err) {
      console.error(err);
    }
  };

  const openItemForm = (hardware) => {
    setAddingItemTo(hardware);
    setItemForm({ name: '', unitPrice: '', quantity: '' });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!addingItemTo) return;
    try {
      await axios.post(`http://localhost:5000/api/hardware/${addingItemTo._id}/items`, itemForm);
      setAddingItemTo(null);
      fetchHardware();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateQuantity = async (hardwareId, itemId, newQty) => {
    try {
      await axios.put(`http://localhost:5000/api/hardware/${hardwareId}/items/${itemId}`, {
        quantity: newQty,
      });
      fetchHardware();
    } catch (err) {
      console.error(err);
    }
  };

  const itemTotal = (item) => item.unitPrice * item.quantity;
  const hardwareTotal = (hw) => hw.items.reduce((sum, i) => sum + itemTotal(i), 0);

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
    const items = Object.entries(orderSelections)
      .filter(([, sel]) => sel.quantity > 0)
      .map(([itemId, sel]) => ({ itemId, quantity: sel.quantity }));

    if (items.length === 0) return;

    try {
      const res = await axios.post(`http://localhost:5000/api/hardware/${hardware._id}/order`, { items });
      setLastOrderTotal(res.data.order.total);
      setOrderSelections({});
      fetchHardware();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="ge-header">
        <h3 style={{ margin: 0 }}>Hardware Suppliers</h3>
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
              onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="ge-save-btn">Save Hardware</button>
        </form>
      )}

      {hardwareList.length === 0 && (
        <p style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No hardware suppliers found</p>
      )}

      {hardwareList.map((hw) => (
        <div key={hw._id} className="ge-form" style={{ marginBottom: '16px' }}>
          <div className="ge-header">
            <div>
              <h4 style={{ margin: 0 }}>{hw.supplierName}</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{hw.phone}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="sa-manage-btn" onClick={() => openItemForm(hw)}>+ Add Item</button>
              <button className="sa-manage-btn" onClick={() => openOrderForm(hw)}>Place Order</button>
            </div>
          </div>

          {/* ADD NEW ITEM TO CATALOG */}
          {addingItemTo?._id === hw._id && (
            <form onSubmit={handleAddItem} style={{ marginTop: '10px' }}>
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
                  placeholder="Unit price (Rs.)"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
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
              <button type="submit" className="ge-save-btn">Save Item</button>
            </form>
          )}

          {/* PLACE ORDER - checklist of existing items with quantity, live total below */}
          {orderingFor?._id === hw._id && (
            <form onSubmit={(e) => handleSubmitOrder(e, hw)} className="ge-form" style={{ marginTop: '10px' }}>
              <p className="sa-group-title">Select items and quantities to order</p>

              {hw.items.length === 0 ? (
                <p style={{ color: '#999', fontSize: '13px' }}>No items yet — add items to the catalog first.</p>
              ) : (
                hw.items.map((item) => {
                  const sel = orderSelections[item._id];
                  const isChecked = !!sel;
                  return (
                    <div
                      key={item._id}
                      className={`sa-checkbox-row ${isChecked ? 'checked' : ''}`}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                        onClick={() => toggleOrderItem(item._id)}
                      >
                        <span className="sa-checkbox-custom">{isChecked && '✓'}</span>
                        {item.name} (Rs. {item.unitPrice.toLocaleString()}/unit)
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

              <div className="ge-summary" style={{ marginTop: '12px' }}>
                <span>Order Total</span>
                <span>Rs. {calcLiveOrderTotal(hw).toLocaleString()}</span>
              </div>

              <button type="submit" className="ge-save-btn" style={{ marginTop: '10px' }}>
                Submit Order
              </button>

              {lastOrderTotal !== null && (
                <div className="ge-summary" style={{ marginTop: '10px', color: '#2f7a3d', fontWeight: 600 }}>
                  <span>Last order submitted</span>
                  <span>Rs. {lastOrderTotal.toLocaleString()}</span>
                </div>
              )}
            </form>
          )}

          {hw.items.length > 0 && (
            <table className="sa-table" style={{ marginTop: '12px' }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit Price (Rs.)</th>
                  <th>Quantity</th>
                  <th>Total (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {hw.items.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.unitPrice.toLocaleString()}</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={item.quantity}
                        className="hw-qty-input"
                        onBlur={(e) => {
                          const newQty = Number(e.target.value);
                          if (newQty !== item.quantity) {
                            handleUpdateQuantity(hw._id, item._id, newQty);
                          }
                        }}
                      />
                    </td>
                    <td>{itemTotal(item).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hw.items.length > 0 && (
            <div className="ge-summary" style={{ marginTop: '8px' }}>
              <span>{hw.items.length} item(s)</span>
              <span>Overall Price: Rs. {hardwareTotal(hw).toLocaleString()}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default SuperAdminDashboard;