import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './Login.css';

const SUCCESS_STYLE = { background: '#f0f7f1', borderColor: '#cfe6d3', color: '#2f7a3d' };
const ERROR_STYLE = { background: '#fdf1f0', borderColor: '#f0c9c5', color: '#b3382c' };

// Same rules the server enforces for new passwords (so mistakes are caught before sending).
const passwordProblem = (value) => {
  if (value.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Password must contain at least one letter and one number';
  return '';
};

// Step 2 of the reset flow: the user opened the emailed link, picks a new
// password, and is sent back to the login page.
function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // After a successful reset, go to the login page automatically.
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`/api/auth/reset-password/${token}`, { password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Reset Password</h2>

        {done ? (
          <>
            <p className="auth-message" style={SUCCESS_STYLE}>
              Your password has been updated. Redirecting you to the login page…
            </p>
            <p className="auth-bottom-text">
              <Link to="/login" className="auth-link">Go to Login now</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-subtitle">Enter your new password</p>

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
              </div>
              <div className="auth-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <p style={{ fontSize: 13, margin: '0 0 8px', color: '#64748b' }}>
                At least 8 characters, with a letter and a number.
              </p>
              <button type="submit" className="auth-submit-btn" disabled={saving}>
                {saving ? 'Updating…' : 'Reset Password'}
              </button>
            </form>

            {error && (
              <p className="auth-message" style={ERROR_STYLE}>
                {error}
                {/invalid|expired/i.test(error) && (
                  <>
                    {' '}
                    <Link to="/forgot-password" className="auth-link">Request a new link</Link>
                  </>
                )}
              </p>
            )}

            <p className="auth-bottom-text">
              <Link to="/login" className="auth-link">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;