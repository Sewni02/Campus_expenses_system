import { useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { saveUser } from '../utils/session';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // Set by ProtectedRoute / the 401 interceptor: the exact page + tab the
  // user was on before being bounced to login.
  const next = searchParams.get('next');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', {
        email,
        password,
      });

      // The server puts the login token in an httpOnly cookie by itself.
      // Only the profile is kept here, and any old token from earlier versions is removed.
      localStorage.removeItem('token');
      saveUser(res.data.user);

      const { role, status } = res.data.user;

      if (role !== 'super_admin' && status !== 'approved') {
        navigate('/waiting-approval', { replace: true });
      } else if (next) {
        navigate(next, { replace: true });
      } else if (role === 'super_admin') {
        navigate('/admin/users', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Login</h2>
        <p className="auth-subtitle">Sign in to your account</p>

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="auth-forgot-row">
            <Link to="/forgot-password" className="auth-link-small">Forgot Password?</Link>
          </div>

          <button type="submit" className="auth-submit-btn">Login</button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-bottom-text">
          Don't have an account? <Link to="/signup" className="auth-link">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;