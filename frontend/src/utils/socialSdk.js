// Loads the Google / Facebook sign-in scripts and returns an ACCESS TOKEN.
// The token is sent to our server (POST /api/auth/social), which checks it
// with Google / Facebook before anything else happens - so nothing here is trusted.

const scripts = {};

export function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        delete scripts[src]; // allow a retry
        reject(new Error('Could not load the sign-in service. Check your internet connection.'));
      };
      document.head.appendChild(el);
    });
  }
  return scripts[src];
}

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
const FACEBOOK_SDK = 'https://connect.facebook.net/en_US/sdk.js';

export const preloadSdk = (provider) => loadScript(provider === 'google' ? GOOGLE_SDK : FACEBOOK_SDK).catch(() => {});

export async function getGoogleAccessToken(clientId) {
  await loadScript(GOOGLE_SDK);
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response && response.access_token) resolve(response.access_token);
        else reject(new Error('Google sign-in was cancelled.'));
      },
      error_callback: (err) => {
        reject(new Error(err && err.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed. Please try again.'));
      },
    });
    client.requestAccessToken();
  });
}

let facebookReady = false;

export async function getFacebookAccessToken(appId) {
  await loadScript(FACEBOOK_SDK);
  if (!facebookReady) {
    window.FB.init({ appId, cookie: false, xfbml: false, version: 'v19.0' });
    facebookReady = true;
  }
  return new Promise((resolve, reject) => {
    window.FB.login(
      (response) => {
        if (response && response.authResponse && response.authResponse.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error('Facebook sign-in was cancelled.'));
        }
      },
      { scope: 'public_profile,email' }
    );
  });
}