import { useState } from 'react';
import { Link } from 'react-router-dom';
import wordmark from '../assets/xpendly-wordmark.png';
import ThemeToggle from './ThemeToggle';
import './AuthShell.css';

// Shared layout for Sign in, Sign up and Forgot password:
// artwork + headline on the left, the form on the right.
// The artwork is a small animated preview of what Xpendly actually does
// (spending by area, a monthly trend, an invoice going from pending to paid,
// an access approval). It is pure CSS / SVG - no photo - so it stays sharp on
// every screen and follows the light / dark theme.

// Spending by area - same areas and colours as the Grand Total screen. Decorative sample values.
const AREAS = [
  { label: 'Constructions', pct: 38, color: '#2469C9' },
  { label: 'Office Expenses', pct: 16, color: '#1FB5A4' },
  { label: 'Petty Cash', pct: 8, color: '#D69E2E' },
  { label: 'Lecturer Salary', pct: 22, color: '#7C5CCB' },
  { label: 'Staff Salary', pct: 16, color: '#2F7D57' },
];
const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
// where each segment starts on the ring (running total of the earlier segments)
const RING_OFFSETS = AREAS.map((_, i) => AREAS.slice(0, i).reduce((sum, a) => sum + (a.pct / 100) * RING_C, 0));

export const ICONS = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10M2.5 21h19M8 8h2M8 12h2M8 16h2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="3.8" />
      <path d="M10.7 12.3L20 3m-4 4l3 3m-5-1l2 2" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
};

export function Icon({ name, className = 'xa-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// One labelled input with an icon. type="password" gets a show / hide button.
export function AuthField({ label, icon, type = 'text', value, onChange, required, placeholder, autoComplete, autoFocus, inputMode, maxLength }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="xa-field">
      <label className="xa-label">{label}</label>
      <div className="xa-input-wrap">
        {icon && <Icon name={icon} />}
        <input
          className={isPassword ? 'xa-input xa-input-pw' : 'xa-input'}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          maxLength={maxLength}
        />
        {isPassword && (
          <button type="button" className="xa-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} tabIndex={-1}>
            <Icon name={show ? 'eyeOff' : 'eye'} className="xa-icon-btn" />
          </button>
        )}
      </div>
    </div>
  );
}

// kind: 'info' (default) | 'ok' | 'err'
export function AuthNotice({ kind = 'info', children }) {
  return <p className={`xa-notice xa-notice-${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</p>;
}

function AuthShell({ title, headline, accent, children }) {
  return (
    <div className="xa-page">
      <ThemeToggle floating />
      <aside className="xa-art">
        <div className="xa-glow" />
        <div className="xa-gridlines" />

        <Link to="/" className="xa-logo" aria-label="Xpendly home">
          <img src={wordmark} alt="Xpendly" />
        </Link>

        {/* animated preview of the system (decorative, no real data) */}
        <div className="xa-visual" aria-hidden="true">
          <div className="xa-vcard xa-spend">
            <div className="xa-card-head"><span>Spending by area</span><em>This month</em></div>
            <div className="xa-spend-body">
              <svg className="xa-ring" viewBox="0 0 120 120">
                <circle className="xa-ring-track" cx="60" cy="60" r={RING_R} />
                {AREAS.map((a, i) => (
                  <circle
                    key={a.label}
                    className="xa-ring-seg"
                    cx="60" cy="60" r={RING_R}
                    stroke={a.color}
                    strokeDasharray={`${(a.pct / 100) * RING_C - 2} ${RING_C}`}
                    strokeDashoffset={-RING_OFFSETS[i]}
                    style={{ animationDelay: `${0.25 + i * 0.16}s` }}
                  />
                ))}
                <text x="60" y="57" textAnchor="middle" className="xa-ring-num">5</text>
                <text x="60" y="73" textAnchor="middle" className="xa-ring-sub">areas</text>
              </svg>
              <ul className="xa-legend">
                {AREAS.map((a) => (
                  <li key={a.label}><i style={{ background: a.color }} />{a.label}<b>{a.pct}%</b></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="xa-vcard xa-invoice">
            <span className="xa-inv-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></svg>
            </span>
            <div className="xa-inv-text">
              <strong>Invoice #0042</strong>
              <small>Supplier bill</small>
            </div>
            <span className="xa-status">
              <span className="xa-status-pending">Pending</span>
              <span className="xa-status-paid">Paid</span>
            </span>
          </div>

          <div className="xa-vcard xa-trend">
            <div className="xa-card-head"><span>Monthly spending</span><em><i />Live</em></div>
            <svg viewBox="0 0 300 96" preserveAspectRatio="none" className="xa-chart">
              <defs>
                <linearGradient id="xa-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1FB5A4" stopOpacity=".38" />
                  <stop offset="100%" stopColor="#1FB5A4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="xa-grid-line" d="M0 24H300M0 48H300M0 72H300" />
              <path className="xa-area" d="M0 78 C30 70 44 60 70 62 S116 48 142 44 S190 56 214 36 S262 22 300 12 V96 H0 Z" fill="url(#xa-area)" />
              <path className="xa-line" pathLength="1" d="M0 78 C30 70 44 60 70 62 S116 48 142 44 S190 56 214 36 S262 22 300 12" />
              <circle className="xa-dot" cx="300" cy="12" r="4" />
            </svg>
            <div className="xa-months"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div>
          </div>

          <div className="xa-vcard xa-approve">
            <span className="xa-ok-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <div className="xa-inv-text">
              <strong>Access approved</strong>
              <small>Role-based permissions</small>
            </div>
          </div>
        </div>

        <div className="xa-headline">
          {headline.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span className="xa-accent">{accent}</span>
        </div>
      </aside>

      <main className="xa-main">
        <div className="xa-card">
          <h1 className="xa-title">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthShell;