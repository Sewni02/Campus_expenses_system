import { useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { saveUser } from '../utils/session';
import { pathAfterLogin } from '../utils/authRedirect';
import AuthShell, { AuthField, AuthNotice } from '../components/AuthShell';
import SocialButtons from '../components/SocialButtons';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Set by ProtectedRoute / the 401 interceptor: the exact page + tab the
  // user was on before being bounced to login.
  const next = searchParams.get('next');

  // The server puts the login token in an httpOnly cookie by itself.
  // Only the profile is kept here, and any old token from earlier versions is removed.
  const finish = (user) => {
    localStorage.removeItem('token');
    saveUser(user);
    navigate(pathAfterLogin(user, next), { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      finish(res.data.user);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" headline={['Manage every expense']} accent="with total clarity.">
      <form onSubmit={handleLogin}>
        <AuthField label="Email address" icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" autoComplete="email" required />
        <AuthField label="Password" icon="lock" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />

        <div className="xa-forgot">
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>

        <button type="submit" className="xa-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>

      {message && <AuthNotice kind="err">{message}</AuthNotice>}

      <SocialButtons mode="login" onAuthenticated={finish} onError={setMessage} />

      <p className="xa-legal">Access to each section is approved by your administrator after you sign up.</p>

      <p className="xa-switch">
        Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
      </p>
    </AuthShell>
  );
}

export default Login;