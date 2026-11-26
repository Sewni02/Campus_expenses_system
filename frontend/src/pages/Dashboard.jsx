import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import { getSavedUser, saveUser, logout } from '../utils/session';
import { PERMISSION_SECTIONS, hasSectionAccess, withLegacyFinance } from '../config/permissionSections';
import PettyCashPanel from './PettyCashPanel';
import StaffSalary from './StaffSalary';
import LecturerSalary from './LecturerSalary';
import GrandTotal from './GrandTotal';
import Settings from './Settings';
import { Constructions, OfficeExpenses, SidebarIcon } from './SuperAdminDashboard';
import './SuperAdminDashboard.css';
import './UserDashboard.css';

// The dashboard every non-super-admin user lands on. The sidebar is the same
// as the super admin's (Constructions ... Grand Total, Settings), but a section
// only works if the super admin ticked it for this user in User Management.
// Sections without access show a lock; inside a section, the Add / Edit /
// Delete actions that were not given are greyed out.
function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getSavedUser);
  const [activeTab, setActiveTab] = useTabState('tab', getSavedUser()?.role === 'accountant' ? 'petty-cash' : PERMISSION_SECTIONS[0].key);

  // Re-read the user from the server so a permission the super admin just
  // changed shows up without having to log out and in again.
  useEffect(() => {
    axios
      .get('/api/auth/me')
      .then((res) => {
        saveUser(res.data);
        setUser(res.data);
      })
      .catch(() => {});
  }, []);

  const section = PERMISSION_SECTIONS.find((s) => s.key === activeTab);
  const tab = activeTab === 'settings' ? 'settings' : section ? section.key : PERMISSION_SECTIONS[0].key;
  const active = PERMISSION_SECTIONS.find((s) => s.key === tab);
  const allowed = active ? hasSectionAccess(user, active) : false;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="sa-container">
      <div className="sa-sidebar ud-sidebar">
        <div className="sa-sidebar-header">
          <div className="sa-avatar" role="img" aria-label="User">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.5 20c0-4.1 3.4-6.6 7.5-6.6s7.5 2.5 7.5 6.6" />
            </svg>
          </div>
          <p>{user?.name || 'User'}</p>
        </div>

        {PERMISSION_SECTIONS.map((s) => (
          <div
            key={s.key}
            className={`sa-sidebar-item ${tab === s.key ? 'active' : ''}`}
            onClick={() => setActiveTab(s.key)}
          >
            <SidebarIcon name={s.icon} />
            <span>{s.label}</span>
          </div>
        ))}
        <div className={`sa-sidebar-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SidebarIcon name="settings" />
          <span>Settings</span>
        </div>
        <div className="sa-sidebar-item ud-logout" onClick={handleLogout}>
          <SidebarIcon name="logout" />
          <span>Log out</span>
        </div>
      </div>

      <div className="sa-content">
        {tab === 'settings' && <Settings />}
        {active && !allowed && (
          <div className="ud-locked">
            <div className="ud-lock-icon">🔒</div>
            <h2>{active.label}</h2>
            <p>You do not have access to this section. Please ask the Super Admin to give you access.</p>
          </div>
        )}
        {active && allowed && active.kind === 'constructions' && (
          <div className={blockedActions(user, 'constructions')}><Constructions /></div>
        )}
        {active && allowed && active.kind === 'office-expenses' && (
          <div className={blockedActions(user, 'office_expenses')}><OfficeExpenses /></div>
        )}
        {active && allowed && active.kind === 'petty-cash' && <PettyCashPanel />}
        {active && allowed && active.kind === 'lecturer-salary' && <LecturerSalary isAdmin={false} />}
        {active && allowed && active.kind === 'staff-salary' && <StaffSalary />}
        {active && allowed && active.kind === 'grand-total' && <GrandTotal />}
      </div>
    </div>
  );
}

// Class names that grey out the Add / Edit / Delete buttons (data-perm="add" etc.
// in SuperAdminDashboard.jsx) the user was NOT given for this area. The server
// refuses those actions anyway - this just stops the buttons being clickable.
function blockedActions(user, area) {
  const owned = withLegacyFinance(user?.permissions || []);
  return ['add', 'edit', 'delete']
    .filter((action) => !owned.includes(`${area}_${action}`))
    .map((action) => `perm-no-${action}`)
    .join(' ');
}

export default Dashboard;