import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSavedUser, logout } from '../utils/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, applySettings } from '../utils/appSettings';
import './Settings.css';

const THEMES = [
  { key: 'light', label: 'Light', hint: 'Bright background' },
  { key: 'dark', label: 'Dark', hint: 'Easy on the eyes at night' },
  { key: 'system', label: 'System', hint: 'Match this device' },
];

const FONT_SIZES = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
];

const DENSITIES = [
  { key: 'comfortable', label: 'Comfortable' },
  { key: 'compact', label: 'Compact' },
];

function ThemePreview({ mode }) {
  return (
    <div className={`st-preview st-preview-${mode}`} aria-hidden="true">
      <div className="st-preview-side" />
      <div className="st-preview-main">
        <span /><span /><span />
      </div>
    </div>
  );
}

// Basic settings page shared by the Super Admin dashboard and the user dashboard.
// Every choice applies immediately and is remembered on this device.
function Settings() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const [settings, setSettings] = useState(loadSettings);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    applySettings(next);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="sa-page st-page">
      <h1 className="sa-page-title">Settings</h1>

      {/* ---------- Appearance ---------- */}
      <div className="pc-panel st-panel">
        <h3>Appearance</h3>
        <p className="st-desc">Choose how Xpendly looks. Changes apply straight away.</p>

        <div className="st-theme-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={settings.theme === t.key}
              className={`st-theme-card ${settings.theme === t.key ? 'active' : ''}`}
              onClick={() => update({ theme: t.key })}
            >
              <ThemePreview mode={t.key} />
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Display ---------- */}
      <div className="pc-panel st-panel">
        <h3>Display</h3>

        <div className="st-row">
          <div>
            <strong>Text size</strong>
            <p className="st-desc">Make everything in the dashboard smaller or larger.</p>
          </div>
          <div className="st-seg" role="radiogroup" aria-label="Text size">
            {FONT_SIZES.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={settings.fontSize === f.key}
                className={settings.fontSize === f.key ? 'active' : ''}
                onClick={() => update({ fontSize: f.key })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-row">
          <div>
            <strong>Table density</strong>
            <p className="st-desc">Compact fits more rows on the screen.</p>
          </div>
          <div className="st-seg" role="radiogroup" aria-label="Table density">
            {DENSITIES.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={settings.density === d.key}
                className={settings.density === d.key ? 'active' : ''}
                onClick={() => update({ density: d.key })}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-row">
          <div>
            <strong>Reduce motion</strong>
            <p className="st-desc">Turn off hover and transition animations.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.reduceMotion}
            aria-label="Reduce motion"
            className={`st-switch ${settings.reduceMotion ? 'on' : ''}`}
            onClick={() => update({ reduceMotion: !settings.reduceMotion })}
          >
            <span />
          </button>
        </div>
      </div>

      {/* ---------- Account ---------- */}
      <div className="pc-panel st-panel">
        <h3>Account</h3>
        <div className="st-account">
          <div><span>Name</span><strong>{user?.name || 'Super Admin'}</strong></div>
          <div><span>Email</span><strong>{user?.email || '-'}</strong></div>
          <div><span>Role</span><strong>{(user?.role || 'super_admin').replace(/_/g, ' ')}</strong></div>
        </div>
        <p className="st-desc">To change your password, log out and use "Forgot password" on the login page.</p>
      </div>

      {/* ---------- Actions ---------- */}
      <div className="st-actions">
        <button type="button" className="pc-btn-sm" onClick={handleReset}>Reset to defaults</button>
        <button type="button" className="st-logout" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}

export default Settings;