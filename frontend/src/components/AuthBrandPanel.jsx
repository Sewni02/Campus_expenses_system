import './AuthBrandPanel.css';

const FEATURES = [
  {
    title: 'Real-time tracking',
    text: 'Every expense recorded the moment it happens.',
    icon: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    title: 'Role-based access',
    text: 'Admins, staff and students see only what they need.',
    icon: (
      <>
        <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    title: 'Paperless approvals',
    text: 'Submit, review and approve without the paper trail.',
    icon: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
        <path d="M14 3v5h5M9 14l2 2 4-4" />
      </>
    ),
  },
];

const BARS = [38, 62, 46, 78, 58, 92, 70];

// Left-hand brand panel shared by Login, Sign up, Forgot and Reset password.
// Pure CSS / SVG - no photo - so it stays sharp and works in light and dark mode.
function AuthBrandPanel({
  title = 'Manage every expense with total clarity.',
  subtitle = 'One secure workspace for budgets, payments and approvals across your campus.',
}) {
  return (
    <aside className="abp" aria-hidden="false">
      <div className="abp-glow abp-glow-a" />
      <div className="abp-glow abp-glow-b" />
      <div className="abp-grid" />

      <div className="abp-top">
        <span className="abp-badge"><i /> Campus Expense Management</span>
      </div>

      <div className="abp-middle">
        <h2 className="abp-title">{title}</h2>
        <p className="abp-sub">{subtitle}</p>

        {/* decorative dashboard preview (no real data) */}
        <div className="abp-visual" aria-hidden="true">
          <div className="abp-card abp-card-chart">
            <div className="abp-card-head">
              <span>Monthly spending</span>
              <em>Live</em>
            </div>
            <div className="abp-bars">
              {BARS.map((h, i) => (
                <b key={i} style={{ '--h': `${h}%`, '--d': `${i * 90}ms` }} />
              ))}
            </div>
          </div>

          <div className="abp-card abp-chip abp-chip-ok">
            <span className="abp-chip-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <div><strong>Request approved</strong><small>Just now</small></div>
          </div>

          <div className="abp-card abp-chip abp-chip-wait">
            <span className="abp-chip-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            </span>
            <div><strong>Awaiting review</strong><small>Pending approval</small></div>
          </div>
        </div>
      </div>

      <ul className="abp-features">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <span className="abp-f-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
            </span>
            <div><strong>{f.title}</strong><small>{f.text}</small></div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default AuthBrandPanel;