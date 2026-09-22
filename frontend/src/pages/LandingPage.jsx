import { useNavigate } from 'react-router-dom';
import image1 from '../assets/image1.jpg';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { title: 'Track Expenses', desc: 'Track all campus expenses in real time, from small purchases to major budget items.' },
    { title: 'Role-Based Access', desc: 'Admins, staff and students each get a dashboard tailored to what they need to see.' },
    { title: 'Approval Workflow', desc: 'Submit, review and approve expense requests without the paper trail.' },
    { title: 'Clear Reports', desc: 'See spending trends at a glance with simple, exportable reports.' },
  ];

  return (
    <div className="lp-page">
      <div className="lp-ambient" aria-hidden="true"></div>
      <div className="lp-grid" aria-hidden="true"></div>

      <nav className="lp-nav">
        <div className="lp-logo">
          <span className="lp-logo-mark"></span>
          Campus<span className="lp-logo-accent">Expenses</span>
        </div>
        <div className="lp-nav-links">
          <span onClick={() => navigate('/dashboard')} className="lp-nav-link">Home</span>
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#about" className="lp-nav-link">About</a>
          <a href="#contact" className="lp-nav-link">Contact</a>
        </div>
        <div className="lp-nav-actions">
          <button onClick={() => navigate('/login')} className="lp-btn-outline">Sign In</button>
          <button onClick={() => navigate('/signup')} className="lp-btn-solid">Sign Up</button>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <div className="lp-badge">
            <span className="lp-pip"></span>
            Campus Expense Management
          </div>
          <h1 className="lp-heading">
            Manage your campus budget with <span className="lp-heading-accent">total clarity</span>
          </h1>
          <p className="lp-subtext">
            One simple platform to submit, track and approve every campus expense —
            built for students, staff and admins alike.
          </p>
          <div className="lp-hero-buttons">
            <button onClick={() => navigate('/signup')} className="lp-btn-solid lp-btn-large">Get Started</button>
            <button onClick={() => navigate('/login')} className="lp-btn-outline lp-btn-large">Sign In</button>
          </div>
        </div>

        <div className="lp-hero-image-wrap">
          <div className="lp-image-frame">
            <img src={image1} alt="Campus Expenses dashboard preview" className="lp-hero-image" />
          </div>
          <div className="lp-mockup-card">
            <h3>This Month</h3>
            <div className="lp-mockup-stats">
              <div className="lp-mockup-stat">
                <p>Approved</p>
                <h4>128</h4>
                <span className="lp-mockup-up">+12%</span>
              </div>
              <div className="lp-mockup-stat">
                <p>Pending</p>
                <h4>14</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-quote-section">
        <p className="lp-quote">
          <span className="lp-quote-mark">"</span>
          Campus Expenses turned a messy spreadsheet process into a{' '}
          <span className="lp-quote-accent">clear, approvable workflow</span> everyone actually uses.
          <span className="lp-quote-mark">"</span>
        </p>
      </section>

      <section className="lp-features" id="features">
        {features.map((f, i) => (
          <div className="lp-feature-card" key={f.title}>
            <span className="lp-feature-num">{String(i + 1).padStart(2, '0')}</span>
            <h4>{f.title}</h4>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default LandingPage;