import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'fake-auth')!;

export function FakeAuth() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 401) {
        setError('Invalid username or password.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void navigate('/practice/fake-auth/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="max-w-sm">
        <form onSubmit={(e) => void handleSubmit(e)} aria-label="Login form" className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm font-medium text-muted">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="rounded-lg border border-edge px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="rounded-lg border border-edge px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-edge bg-canvas p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Test credentials
          </p>
          <div className="space-y-1 font-mono text-xs text-muted">
            <p>alice / password123</p>
            <p>bob / letmein</p>
          </div>
        </div>
      </div>
    </div>
  );
}
