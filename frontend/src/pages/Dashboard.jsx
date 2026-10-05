import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import { sectionsForUser } from '../config/permissionSections';
import PettyCashPanel from './PettyCashPanel';
import LecturerSalary from './LecturerSalary';
import './SuperAdminDashboard.css';
import './UserDashboard.css';

// The dashboard every non-super-admin user lands on. What shows up in the
// sidebar depends ONLY on the permissions the super admin ticked for that
// user in User Management - nothing is hard-coded per person or per job title.
function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [activeTab, setActiveTab] = useTabState('tab', 'overview');

  // Re-read the user from the server so a permission the super admin just
  // changed shows up without having to log out and in again.
  useEffect(() => {
    axios
      .get('/api/auth/me')
      .then((res) => {
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
      })
      .catch(() => {});
  }, []);

  const sections = sectionsForUser(user);
  const active = sections.find((s) => s.key === activeTab);
  // If the tab in the URL is not one this user may open (or was just revoked), show the overview.
  const tab = active ? active.key : 'overview';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="sa-container">
      <div className="sa-sidebar">
        <div className="sa-sidebar-header">
          <div className="sa-avatar" role="img" aria-label="User">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.5 20c0-4.1 3.4-6.6 7.5-6.6s7.5 2.5 7.5 6.6" />
            </svg>
          </div>
          <p>{user?.name || 'User'}</p>
        </div>

        <div className={`sa-sidebar-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <span>Overview</span>
        </div>
        {sections.map((section) => (
          <div
            key={section.key}
            className={`sa-sidebar-item ${tab === section.key ? 'active' : ''}`}
            onClick={() => setActiveTab(section.key)}
          >
            <span>{section.label}</span>
          </div>
        ))}
        <div className="sa-sidebar-item ud-logout" onClick={handleLogout}>
          <span>Log out</span>
        </div>
      </div>

      <div className="sa-content">
        {tab === 'overview' && <Overview user={user} sections={sections} onOpen={setActiveTab} />}
        {active?.kind === 'petty-cash' && <PettyCashPanel />}
        {active?.kind === 'lecturer-salary' && <LecturerSalary isAdmin={false} />}
        {active?.kind === 'demo' && <DemoSection section={active} user={user} />}
      </div>
    </div>
  );
}

function Overview({ user, sections, onOpen }) {
  const owned = user?.permissions || [];

  return (
    <div className="sa-page">
      <h1 className="sa-page-title">
        Welcome, {user?.name || 'User'}!<span className="ud-role">{user?.role}</span>
      </h1>

      {sections.length === 0 ? (
        <div className="ud-card ud-empty">
          No access has been given to your account yet. Please ask the Super Admin to grant you permissions.
        </div>
      ) : (
        <>
          <p className="ud-sub">These are the areas the Super Admin has given you access to. Click one to open it.</p>
          <div className="ud-grid">
            {sections.map((section) => (
              <div key={section.key} className="ud-card clickable" onClick={() => onOpen(section.key)}>
                <h3>{section.label}</h3>
                <p>{section.description || 'Open this section'}</p>
                {section.permissions.map((perm) => {
                  const on = owned.includes(perm.key);
                  return (
                    <div key={perm.key} className={`ud-perm ${on ? 'on' : 'off'}`}>
                      <span className="mark">{on ? '✓' : '–'}</span>
                      {perm.label}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Placeholder for permission groups whose real screens are not built yet. It
// proves the access wiring works: only the actions the user was granted are enabled.
function DemoSection({ section, user }) {
  const owned = user?.permissions || [];

  return (
    <div className="sa-page">
      <h1 className="sa-page-title">{section.label}</h1>
      <p className="ud-sub">{section.description}</p>

      <div className="ud-actions">
        {section.permissions.map((perm) => (
          <button key={perm.key} disabled={!owned.includes(perm.key)}>
            {perm.label}
          </button>
        ))}
      </div>

      <div className="ud-demo-note">
        Demo screen — the real {section.label} pages will appear here later. Buttons that are greyed out are actions
        the Super Admin has not given you.
      </div>
    </div>
  );
}

export default Dashboard;