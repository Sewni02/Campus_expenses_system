import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthField, AuthNotice } from '../components/AuthShell';

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
      await axios.post('/api/auth/reset-password', { email: email.trim(), otp: otp.trim(), password });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot password" headline={['Reset your password']} accent="and get back in.">
      {step === 1 && (
        <>
          <p className="xa-sub">Enter your email and we will send you a 6-digit OTP.</p>
          <form onSubmit={sendOtp}>
            <AuthField label="Email address" icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" autoComplete="email" autoFocus required />
            <button type="submit" className="xa-btn" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
          </form>
          {error && <AuthNotice kind="err">{error}</AuthNotice>}
        </>
      )}

      {step === 2 && (
        <>
          <p className="xa-sub">Enter the OTP sent to your email and choose a new password.</p>
          {info && <AuthNotice kind="ok">{info}</AuthNotice>}
          <form onSubmit={resetPassword} style={{ marginTop: 18 }}>
            <AuthField label="OTP" icon="hash" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus required />
            <AuthField label="New password" icon="lock" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" required />
            <AuthField label="Confirm new password" icon="lock" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat the new password" autoComplete="new-password" required />
            <p className="xa-legal" style={{ margin: '-4px 0 14px' }}>At least 8 characters, with a letter and a number. The OTP works for 10 minutes.</p>
            <button type="submit" className="xa-btn" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button>
          </form>
          {error && <AuthNotice kind="err">{error}</AuthNotice>}
          <p className="xa-switch">
            Didn&apos;t get it? Check your inbox (and spam), or
            <button type="button" className="xa-link xa-link-btn" style={{ marginLeft: 6 }} onClick={sendOtp} disabled={busy}>resend OTP</button>
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <AuthNotice kind="ok">Your password has been updated. Redirecting you to the login page…</AuthNotice>
          <p className="xa-switch"><Link to="/login">Go to Sign in now</Link></p>
        </>
      )}

      {step !== 3 && (
        <p className="xa-switch">
          <Link to="/login">Back to Sign in</Link>
        </p>
      )}
    </AuthShell>
  );
}

export default ForgotPassword;