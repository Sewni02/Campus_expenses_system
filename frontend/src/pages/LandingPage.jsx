import { useNavigate } from 'react-router-dom';
import image1 from '../assets/image1.jpg';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { title: 'Track Expenses', desc: 'Track all campus expenses in real-time with detailed reports.' },
    { title: 'Smart Analytics', desc: 'Get insights with smart analytics and visual dashboards.' },
    { title: 'Secure System', desc: 'Role-based access and secure data management you can trust.' },
    { title: 'Easy Approvals', desc: 'Simplify approval workflows and ensure accountability every step.' },
    { title: 'Stay Notified', desc: 'Instant notifications for requests, approvals, and updates.' },
  ];

  return (
    <div className="lp-page">

      <nav className="lp-nav">
        <div className="lp-logo">Campus Expenses</div>
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

      <section id="home" className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-badge">Smart • Simple • Secure</span>
          <h1 className="lp-heading">
            Manage Campus Expenses with <span className="lp-heading-accent">Ease and Clarity</span>
          </h1>
          <p className="lp-subtext">
            A smart solution to track, manage, and optimize campus expenses
            efficiently. Built for transparency, accountability, and better
            financial decisions.
          </p>
          <div className="lp-hero-buttons">
            <button onClick={() => navigate('/signup')} className="lp-btn-solid lp-btn-large">
              Get Started
            </button>
            <button className="lp-btn-outline lp-btn-large">Learn More</button>
          </div>
        </div>

        <div className="lp-hero-image-wrap">
          <img src={image1} alt="Campus" className="lp-hero-image" />

          <div className="lp-mockup-card">
            <h3>Dashboard</h3>
            <div className="lp-mockup-stats">
              <div className="lp-mockup-stat">
                <p>Total Expenses</p>
                <h4>Rs. 1,245,000</h4>
                <span className="lp-mockup-up">+12.5%</span>
              </div>
              <div className="lp-mockup-stat">
                <p>This Month</p>
                <h4>Rs. 245,000</h4>
                <span className="lp-mockup-up">+8.2%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-quote-section">
        <p className="lp-quote">
          <span className="lp-quote-mark">&ldquo;</span>
          Good financial management isn&apos;t about restriction, it&apos;s about
          creating <span className="lp-quote-accent">better opportunities</span> for everyone.
          <span className="lp-quote-mark">&rdquo;</span>
        </p>
      </section>

      <section id="features" className="lp-features">
        {features.map((f, i) => (
          <div key={i} className="lp-feature-card">
            <h4>{f.title}</h4>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

    </div>
  );
}

export default LandingPage;