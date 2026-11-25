import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import AuthBrandPanel from '../components/AuthBrandPanel';
import './Login.css';

// Same rules the server enforces for new passwords (so mistakes are caught before sending).
const passwordProblem = (value) => {
  if (value.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Password must contain at least one letter and one number';
  return '';
};

// Forgot-password flow (all on this one page):
//   Step 1: user types their email -> we email a 6-digit OTP.
//   Step 2: user types the OTP + a new password -> password is changed -> login page.
function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = email, 2 = otp + new password, 3 = done
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // After a successful reset, go to the login page automatically.
  useEffect(() => {
    if (step !== 3) return undefined;
    const timer = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => clearTimeout(timer);
  }, [step, navigate]);

  const sendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setInfo(res.data.message);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit OTP from your email');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      await axios.post('/api/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        password,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggle floating />
      <AuthBrandPanel />
      <div className="auth-card">
        <h2 className="auth-title">Forgot Password</h2>

        {step === 1 && (
          <>
            <p className="auth-subtitle">Enter your email to receive a 6-digit OTP</p>
            <form onSubmit={sendOtp}>
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
              <button type="submit" className="auth-submit-btn" disabled={busy}>
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
              {error && <p className="auth-message auth-message-err">{error}</p>}
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="auth-subtitle">Enter the OTP sent to your email and choose a new password</p>
            {info && <p className="auth-message auth-message-ok">{info}</p>}
            <form onSubmit={resetPassword}>
              <div className="auth-field">
                <label>OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <div className="auth-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                At least 8 characters, with a letter and a number. The OTP works for 10 minutes.
              </p>
              <button type="submit" className="auth-submit-btn" disabled={busy}>
                {busy ? 'Updating…' : 'Reset Password'}
              </button>
              {error && <p className="auth-message auth-message-err">{error}</p>}
            </form>
            <p className="auth-bottom-text" style={{ fontSize: 14 }}>
              Didn&apos;t get it? Check your inbox (and spam), or{' '}
              <button
                type="button"
                className="auth-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={sendOtp}
                disabled={busy}
              >
                resend OTP
              </button>
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="auth-message auth-message-ok">
              Your password has been updated. Redirecting you to the login page…
            </p>
            <p className="auth-bottom-text">
              <Link to="/login" className="auth-link">Go to Login now</Link>
            </p>
          </>
        )}

        {step !== 3 && (
          <p className="auth-bottom-text">
            <Link to="/login" className="auth-link">Back to Login</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;