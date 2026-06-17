import { useState, type FormEvent } from 'react';
import logoUrl from '../../assets/logo.png';

const ENV_USER = import.meta.env.VITE_AUTH_USERNAME as string | undefined;
const ENV_PASS = import.meta.env.VITE_AUTH_PASSWORD as string | undefined;
const AUTH_ENABLED = Boolean(ENV_USER && ENV_PASS);
const SESSION_KEY = 'sur_auth';

function isAuthenticated(): boolean {
  if (!AUTH_ENABLED) return true;
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}

function authenticate(username: string, password: string): boolean {
  if (username === ENV_USER && password === ENV_PASS) {
    sessionStorage.setItem(SESSION_KEY, 'ok');
    return true;
  }
  return false;
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (authed) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (authenticate(username, password)) {
      setError(false);
      setAuthed(true);
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img
            src={logoUrl}
            alt="Stand Up Recruitment"
            style={{ height: 80, width: 'auto', display: 'block', margin: '0 auto 16px' }}
          />
          <div style={{ fontSize: 13, color: '#737373' }}>
            Command Centre
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f5', marginBottom: 20 }}>
            Sign in
          </div>

          {/* Username */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#a3a3a3', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(false); }}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#111',
                border: `1px solid ${error ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: '#f5f5f5',
                outline: 'none',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#a3a3a3', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#111',
                  border: `1px solid ${error ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8,
                  padding: '10px 36px 10px 12px',
                  fontSize: 14,
                  color: '#f5f5f5',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#737373',
                  padding: 4,
                  lineHeight: 1,
                }}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              fontSize: 12,
              color: '#ef4444',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 16,
            }}>
              Incorrect username or password.
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
