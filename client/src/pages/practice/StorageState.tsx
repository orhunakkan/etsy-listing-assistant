import { useState, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'storage-state')!;

interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
}

interface AdminData {
  totalUsers: number;
  pendingReviews: number;
}

export function StorageState() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          setProfile(null);
        } else {
          const user = (await res.json()) as UserProfile;
          setProfile(user);
          if (user.role === 'admin') {
            const adminRes = await fetch('/api/auth/admin/stats', { credentials: 'include' });
            if (adminRes.ok) setAdminData((await adminRes.json()) as AdminData);
          }
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div>
      <LabHeader lab={lab} />

      {/* Credentials hint */}
      <div className="mb-6 rounded-xl border border-edge bg-canvas p-4 text-sm">
        <p className="font-medium text-content">Test credentials</p>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted">Admin user</p>
            <p className="font-mono text-xs text-muted">username: alice</p>
            <p className="font-mono text-xs text-muted">password: password123</p>
            <span className="mt-1 inline-block rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              role: admin
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Regular user</p>
            <p className="font-mono text-xs text-muted">username: bob</p>
            <p className="font-mono text-xs text-muted">password: letmein</p>
            <span className="mt-1 inline-block rounded bg-surface-raised px-1.5 py-0.5 text-xs text-muted dark:bg-edge">
              role: user
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Log in at{' '}
          <a
            href="/practice/fake-auth"
            className="text-accent underline hover:text-brand-800 dark:hover:text-brand-300"
          >
            /practice/fake-auth
          </a>{' '}
          first to establish a session.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          role="status"
          aria-label="Loading profile"
          className="flex items-center gap-2 text-sm text-muted"
        >
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand-600" />
          Loading…
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {/* Profile card */}
          <div data-testid="profile-card" className="rounded-xl border border-edge bg-surface p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {profile.displayName[0]}
              </div>
              <div>
                <p className="font-semibold text-content" data-testid="display-name">
                  {profile.displayName}
                </p>
                <p className="text-sm text-muted">@{profile.username}</p>
              </div>
              <span
                data-testid="user-role"
                className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
                  profile.role === 'admin'
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                    : 'bg-surface-raised text-muted'
                }`}
              >
                {profile.role}
              </span>
            </div>
          </div>

          {/* Admin-only panel */}
          {profile.role === 'admin' && adminData && (
            <div
              data-testid="admin-panel"
              aria-label="Admin panel"
              className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-700 dark:bg-brand-950"
            >
              <h2 className="mb-3 text-sm font-semibold text-brand-900 dark:text-brand-300">
                Admin panel
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-brand-200 bg-surface p-3 text-center dark:border-brand-700">
                  <p
                    className="text-2xl font-bold text-brand-700 dark:text-brand-300"
                    data-testid="total-users"
                  >
                    {adminData.totalUsers}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Total users</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-surface p-3 text-center dark:border-amber-700">
                  <p
                    className="text-2xl font-bold text-amber-700 dark:text-amber-400"
                    data-testid="pending-reviews"
                  >
                    {adminData.pendingReviews}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Pending reviews</p>
                </div>
              </div>
            </div>
          )}

          {/* Challenge hint */}
          <div className="rounded-xl border border-edge bg-canvas p-4 text-sm text-content">
            <p className="font-medium">Challenge</p>
            <p className="mt-1 text-muted">
              Log in as both users and call{' '}
              <code className="rounded bg-surface-raised px-1 text-xs">
                await context.storageState(&#123; path: &apos;admin.json&apos; &#125;)
              </code>{' '}
              for each. Load both states into parallel contexts and assert that only the admin
              context sees the admin panel.
            </p>
          </div>
        </div>
      ) : (
        <div
          data-testid="not-authenticated"
          className="rounded-xl border border-edge bg-canvas p-6 text-center"
        >
          <p className="text-sm text-muted">
            Not authenticated. Log in at{' '}
            <a
              href="/practice/fake-auth"
              className="text-accent underline hover:text-brand-800 dark:hover:text-brand-300"
            >
              /practice/fake-auth
            </a>{' '}
            to see role-specific content.
          </p>
        </div>
      )}
    </div>
  );
}
