import { useState } from 'react';
import { Link } from 'react-router-dom';
import wordmark from '../assets/xpendly-wordmark.png';
import './AuthShell.css';

// Shared layout for Sign in, Sign up and Forgot password:
// artwork + headline on the left, the form on the right.
// The artwork is pure CSS / SVG (no photo), so it stays sharp on every screen.

// Fixed positions (not random) so the sky looks the same on every visit.
const STARS = [
  [6, 12, 2], [14, 30, 1.5], [22, 8, 1], [30, 22, 2], [38, 40, 1], [46, 14, 1.5], [54, 6, 1],
  [63, 28, 2], [71, 16, 1], [80, 9, 1.5], [88, 24, 1], [94, 12, 2], [9, 52, 1], [19, 64, 1.5],
  [27, 78, 1], [36, 58, 2], [58, 48, 1], [67, 60, 1.5], [76, 44, 1], [85, 56, 2], [92, 70, 1],
  [12, 86, 1.5], [44, 90, 1], [60, 82, 2], [74, 88, 1], [90, 92, 1.5], [49, 30, 1], [3, 40, 1.5],
];

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
      <aside className="xa-art">
        {/* artwork */}
        <div className="xa-glow" />
        <div className="xa-gridlines" />
        <svg className="xa-orbits" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <ellipse cx="170" cy="190" rx="360" ry="150" transform="rotate(-24 170 190)" />
          <ellipse cx="170" cy="190" rx="470" ry="210" transform="rotate(-24 170 190)" />
          <ellipse cx="420" cy="430" rx="150" ry="52" transform="rotate(-20 420 430)" />
        </svg>
        <div className="xa-planet xa-planet-main"><i /><i /><i /></div>
        <div className="xa-planet xa-planet-mid" />
        <div className="xa-planet xa-planet-small" />
        <div className="xa-streak xa-streak-a" />
        <div className="xa-streak xa-streak-b" />
        {STARS.map(([x, y, s], i) => (
          <span key={i} className="xa-star" style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, animationDelay: `${(i % 7) * 0.45}s` }} />
        ))}

        <Link to="/" className="xa-logo" aria-label="Xpendly home">
          <img src={wordmark} alt="Xpendly" />
        </Link>

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