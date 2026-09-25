import { useNavigate } from 'react-router-dom';
import image1 from '../assets/image1.jpg';
import wordmark from '../assets/xpendly-wordmark.png';
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
    <div className="lp-page" id="top">
      <header className="lp-nav">
        <img src={wordmark} alt="Xpendly" className="lp-logo-img" />
        <nav className="lp-nav-links">
          <a href="#top" className="lp-nav-link">Home</a>
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#about" className="lp-nav-link">About</a>
          <a href="#contact" className="lp-nav-link">Contact</a>
        </nav>
        <div className="lp-nav-actions">
          <button onClick={() => navigate('/login')} className="lp-btn-outline">Sign In</button>
          <button onClick={() => navigate('/signup')} className="lp-btn-solid">Sign Up</button>
        </div>
      </header>

      <section className="lp-hero">
        <span className="lp-eyebrow">Enterprise Expense Management</span>
        <h1 className="lp-heading">
          Manage Every Expense
          <span className="lp-heading-soft">With Total Clarity</span>
        </h1>
        <p className="lp-subtext">
          One simple platform to submit, track and approve every campus expense,
          built for students, staff and admins alike.
        </p>
        <div className="lp-hero-buttons">
          <button onClick={() => navigate('/signup')} className="lp-btn-solid lp-btn-large">Get Started</button>
          <button onClick={() => navigate('/login')} className="lp-btn-outline lp-btn-large">Sign In</button>
        </div>

        <div className="lp-hero-visual">
          <img src={image1} alt="Campus building" className="lp-hero-image" />
          <div className="lp-glass-card">
            <span className="lp-glass-label">This Month</span>
            <div className="lp-glass-row">
              <div><h4>128</h4><p>Approved</p></div>
              <div><h4>14</h4><p>Pending</p></div>
              <span className="lp-glass-up">+12%</span>
            </div>
          </div>
        </div>

        <div className="lp-stats">
          {stats.map((s) => (
            <div className="lp-stat" key={s.label}>
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="features">
        <span className="lp-eyebrow">What We Offer</span>
        <h2 className="lp-section-title">
          Everything You Need To <span className="lp-soft">Manage Spending</span>
        </h2>
        <div className="lp-features">
          {features.map((f, i) => (
            <div className="lp-feature-card" key={f.title}>
              <span className="lp-feature-num">{String(i + 1).padStart(2, '0')}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-about" id="about">
        <span className="lp-eyebrow lp-eyebrow-light">About</span>
        <p className="lp-quote">
          Xpendly turns a messy spreadsheet process into a{' '}
          <span className="lp-quote-accent">clear, approvable workflow</span> everyone actually uses.
        </p>
        <button onClick={() => navigate('/signup')} className="lp-btn-light lp-btn-large">Create an Account</button>
      </section>

      <footer className="lp-footer" id="contact">
        <img src={wordmark} alt="Xpendly" className="lp-logo-img" />
        <p>&copy; {new Date().getFullYear()} Xpendly. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;