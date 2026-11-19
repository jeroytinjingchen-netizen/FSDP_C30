// Login.jsx - one login form for everyone. The server says what the account is (ADMIN or STUDENT)
// and the page sends the user to the matching portal, so there is no portal to pick.
// useState holds the form values; useNavigate moves to another page after a successful login.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { AlertCircleIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, LogoMark } from '../components/Icons.jsx';
import { Button, Field, cn, inputClass } from '../components/ui.jsx';

// Where each role lands after signing in.
const HOME = { ADMIN: '/admin/dashboard', STUDENT: '/student' };

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'STUDENT') return <Navigate to="/student" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    setBusy(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      login(data.user);
      navigate(HOME[data.role] || '/');
    } catch (err) {
      setAlert({ error: true, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const AlertIcon = alert?.error ? AlertCircleIcon : CheckCircleIcon;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-on-accent">
            <LogoMark size={24} />
          </span>
          <span className="text-lg font-semibold">Aikido Shinjukai</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            One place to run every centre.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground">
            Centralised administrative workflow for centres, venues and students.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground">&copy; 2026 Aikido Shinjukai</p>
      </aside>

      <main className="relative flex items-center justify-center p-6 sm:p-12">

        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-on-accent">
              <LogoMark size={24} />
            </span>
            <span className="text-lg font-semibold">Aikido Shinjukai</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials. We will take you to the right portal automatically.
          </p>

          {alert && (
            <div
              role={alert.error ? 'alert' : 'status'}
              className={cn(
                'mt-4 flex items-start gap-2 rounded-lg p-3 text-sm font-medium',
                alert.error ? 'bg-destructive-soft text-destructive' : 'bg-accent-soft text-accent-text'
              )}
            >
              <AlertIcon size={18} className="mt-0.5 shrink-0" />
              <p>{alert.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email address">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClass, 'pr-11')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

