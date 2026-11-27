import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getGoogleAccessToken, getFacebookAccessToken, preloadSdk } from '../utils/socialSdk';
import './AuthShell.css';

// "Or continue with  [Google] [Facebook]"
//   mode="login"  : signs in an account that already exists (matched by email)
//   mode="signup" : creates a normal account that waits for admin approval
// The provider token is verified by OUR server; this component only collects it.
// Which providers are switched on comes from the server (.env), so no keys live in the frontend.

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.1-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.87 8.88 4.77 12 4.77z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.4 19.5v-6.6h2.2l.35-2.6H13.4V8.6c0-.75.2-1.26 1.28-1.26h1.37V5.02A18 18 0 0 0 14.05 4.9c-1.97 0-3.32 1.2-3.32 3.4v1.99H8.5v2.6h2.23v6.6h2.67z" />
    </svg>
  );
}

function SocialButtons({ mode, onAuthenticated, onError }) {
  const [config, setConfig] = useState(null); // { google: clientId|null, facebook: appId|null }
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    // Plain fetch on purpose: the global loading screen should not pop up for this.
    fetch(`${API_BASE_URL}/api/auth/social-config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!alive || !cfg) return;
        setConfig(cfg);
        if (cfg.google) preloadSdk('google');
        if (cfg.facebook) preloadSdk('facebook');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const start = async (provider) => {
    if (busy) return;
    const id = config && config[provider];
    const label = provider === 'google' ? 'Google' : 'Facebook';
    if (!id) {
      onError(`${label} sign-in is not set up yet. Please ask the administrator.`);
      return;
    }

    onError('');
    setBusy(provider);
    try {
      const token = provider === 'google' ? await getGoogleAccessToken(id) : await getFacebookAccessToken(id);
      const res = await axios.post('/api/auth/social', { provider, token, mode });
      onAuthenticated(res.data.user, res.data.message);
    } catch (err) {
      onError(err.response?.data?.message || err.message || `${label} sign-in failed. Please try again.`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="xa-social">
      <div className="xa-divider"><span>Or continue with</span></div>
      <div className="xa-social-row">
        <button type="button" className="xa-social-btn" onClick={() => start('google')} disabled={Boolean(busy)}>
          {busy === 'google' ? <i className="xa-spin" /> : <GoogleLogo />}
          <span>Google</span>
        </button>
        <button type="button" className="xa-social-btn" onClick={() => start('facebook')} disabled={Boolean(busy)}>
          {busy === 'facebook' ? <i className="xa-spin" /> : <FacebookLogo />}
          <span>Facebook</span>
        </button>
      </div>
    </div>
  );
}

export default SocialButtons;