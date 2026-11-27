import { useNavigate } from 'react-router-dom';
import wordmark from '../assets/xpendly-wordmark.png';
import LiveOverview from '../components/LiveOverview';
import './LandingPage.css';

const features = [
  { title: 'Track Expenses', desc: 'Follow every campus expense in real time, from small purchases to major budget items.' },
  { title: 'Role-Based Access', desc: 'Admins, staff and students each get a dashboard tailored to what they need to see.' },
  { title: 'Approval Workflow', desc: 'Submit, review and approve expense requests without the paper trail.' },
  { title: 'Clear Reports', desc: 'See spending trends at a glance with simple, exportable reports.' },
];

const stats = [
  { value: 'Real-time', label: 'Expense tracking' },
  { value: '3 Roles', label: 'Tailored dashboards' },
  { value: '100%', label: 'Paperless approvals' },
];

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="xl-page" id="top">
      <div className="xl-bg" aria-hidden="true">
        <span className="xl-orb xl-orb-a" />
        <span className="xl-orb xl-orb-b" />
        <span className="xl-grid" />
      </div>

      <header className="xl-nav">
        <img src={wordmark} alt="Xpendly" className="xl-logo" />
        <nav className="xl-links">
          <a href="#top">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="xl-actions">
          <button onClick={() => navigate('/login')} className="xl-btn xl-btn-ghost">Sign In</button>
          <button onClick={() => navigate('/signup')} className="xl-btn xl-btn-solid">Sign Up</button>
        </div>
      </header>

      <section className="xl-hero">
        <span className="xl-eyebrow">Enterprise Expense Management</span>
        <h1 className="xl-heading">
          MANAGE EVERY EXPENSE
          <span className="xl-accent">WITH TOTAL CLARITY</span>
        </h1>
        <p className="xl-sub">
          One simple platform to submit, track and approve every campus expense,
          built for students, staff and admins alike.
        </p>
        <div className="xl-cta">
          <button onClick={() => navigate('/signup')} className="xl-btn xl-btn-solid xl-btn-lg">Get Started</button>
          <button onClick={() => navigate('/login')} className="xl-btn xl-btn-ghost xl-btn-lg">Sign In</button>
        </div>

        <LiveOverview />

        <div className="xl-stats">
          {stats.map((s) => (
            <div className="xl-stat" key={s.label}>
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="xl-section" id="features">
        <span className="xl-eyebrow">What We Offer</span>
        <h2 className="xl-title">EVERYTHING YOU NEED TO <span className="xl-accent-inline">MANAGE SPENDING</span></h2>
        <div className="xl-features">
          {features.map((f, i) => (
            <div className="xl-card" key={f.title}>
              <span className="xl-num">{String(i + 1).padStart(2, '0')}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="xl-about" id="about">
        <span className="xl-eyebrow">About</span>
        <p className="xl-quote">
          Xpendly turns a messy spreadsheet process into a{' '}
          <span className="xl-accent-inline">clear, approvable workflow</span> everyone actually uses.
        </p>
        <button onClick={() => navigate('/signup')} className="xl-btn xl-btn-solid xl-btn-lg">Create an Account</button>
      </section>

      <footer className="xl-footer" id="contact">
        <img src={wordmark} alt="Xpendly" className="xl-logo" />
        <p>&copy; {new Date().getFullYear()} Xpendly. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;