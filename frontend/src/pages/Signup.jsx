import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { saveUser } from '../utils/session';
import AuthShell, { AuthField, AuthNotice } from '../components/AuthShell';
import SocialButtons from '../components/SocialButtons';

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const show = (text, error) => {
    setMessage(text);
    setIsError(error);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    show('', false);
    setBusy(true);
    try {
      const res = await axios.post('/api/auth/signup', {
        name,
        email,
        password,
        role: 'employee',
        department,
        adminCode: adminCode || undefined,
      });
      show(res.data.message, false);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      show(err.response?.data?.message || 'Signup failed', true);
    } finally {
      setBusy(false);
    }
  };

  // Google / Facebook sign-up: the account is created (waiting for approval)
  // and the person is signed in straight away.
  const socialDone = (user) => {
    localStorage.removeItem('token');
    saveUser(user);
    navigate('/waiting-approval', { replace: true });
  };

  return (
    <AuthShell title="Sign up" headline={['Join your campus', 'finance workspace']} accent="in minutes.">
      <form onSubmit={handleSignup}>
        <AuthField label="Full name" icon="user" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" required />
        <AuthField label="Email address" icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" autoComplete="email" required />
        <AuthField label="Password" icon="lock" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" autoComplete="new-password" required />
        <div className="xa-row2">
          <AuthField label="Department" icon="building" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Optional" />
          <AuthField label="Admin code" icon="key" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Optional" autoComplete="off" />
        </div>
        <p className="xa-legal" style={{ margin: '-4px 0 14px' }}>Leave the admin code empty unless you are a Super Admin.</p>

        <button type="submit" className="xa-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>

      {message && <AuthNotice kind={isError ? 'err' : 'ok'}>{message}</AuthNotice>}

      <SocialButtons mode="signup" onAuthenticated={socialDone} onError={(text) => show(text, Boolean(text))} />

      <p className="xa-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

export default Signup;