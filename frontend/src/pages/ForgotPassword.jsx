import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Login.css';

const SUCCESS_STYLE = { background: '#f0f7f1', borderColor: '#cfe6d3', color: '#2f7a3d' };
const ERROR_STYLE = { background: '#fdf1f0', borderColor: '#f0c9c5', color: '#b3382c' };

// Step 1 of the reset flow: the user types their email and we send the reset link.
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setMessage(res.data.message);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the reset email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Forgot Password</h2>
        <p className="auth-subtitle">Enter your email to receive a reset link</p>

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={sending}>
              {sending ? 'Sending…' : 'Send Reset Link'}
            </button>
            {error && <p className="auth-message" style={ERROR_STYLE}>{error}</p>}
          </form>
        ) : (
          <>
            <p className="auth-message" style={SUCCESS_STYLE}>{message}</p>
            <p className="auth-bottom-text" style={{ marginTop: 16, fontSize: 14 }}>
              Check your inbox (and spam folder). The link works for 15 minutes.
            </p>
          </>
        )}

        <p className="auth-bottom-text">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;