import { useEffect, useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'soft-assertions')!;

// ---------------------------------------------------------------------------
// Widget: Activity Score — updates on a 2-second timer
// ---------------------------------------------------------------------------
function ActivityScore() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setScore(87), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div aria-labelledby="score-label" className="rounded-lg border border-edge bg-surface p-4">
      <p id="score-label" className="text-sm font-medium text-muted">
        Activity Score
      </p>
      <p
        className="mt-1 text-3xl font-bold text-brand-600"
        aria-label="Activity score value"
        data-testid="activity-score"
      >
        {score}
      </p>
      <p className="mt-1 text-xs text-muted">Updates after a short delay</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Status Badge — animates through states before settling
// ---------------------------------------------------------------------------
type BadgeStatus = 'loading' | 'active';

function StatusBadge() {
  const [status, setStatus] = useState<BadgeStatus>('loading');

  useEffect(() => {
    const t1 = setTimeout(() => setStatus('active'), 1500);
    return () => clearTimeout(t1);
  }, []);

  const colours: Record<BadgeStatus, string> = {
    loading: 'bg-yellow-100 text-yellow-800',
    active: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <div aria-labelledby="badge-label" className="rounded-lg border border-edge bg-surface p-4">
      <p id="badge-label" className="text-sm font-medium text-muted">
        Account Status
      </p>
      <span
        aria-label="Status badge"
        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${colours[status]}`}
      >
        {status}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Profile completeness
// ---------------------------------------------------------------------------
function ProfileWidget() {
  return (
    <div aria-labelledby="profile-label" className="rounded-lg border border-edge bg-surface p-4">
      <p id="profile-label" className="text-sm font-medium text-muted">
        Profile
      </p>
      <ul aria-label="Profile completeness" className="mt-2 space-y-1 text-sm text-content">
        <li aria-label="Name field">
          Name: <strong>Jane Doe</strong>
        </li>
        <li aria-label="Email field">
          Email: <strong>jane@example.com</strong>
        </li>
        <li aria-label="Role field">
          Role: <strong>Engineer</strong>
        </li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Recent notifications count
// ---------------------------------------------------------------------------
function NotificationsWidget() {
  const [count] = useState(3);
  return (
    <div aria-labelledby="notif-label" className="rounded-lg border border-edge bg-surface p-4">
      <p id="notif-label" className="text-sm font-medium text-muted">
        Notifications
      </p>
      <p
        aria-label="Notification count"
        className="mt-1 text-3xl font-bold text-rose-700"
        data-testid="notification-count"
      >
        {count}
      </p>
      <p className="mt-1 text-xs text-muted">Unread messages</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lab component
// ---------------------------------------------------------------------------
export function SoftAssertions() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <LabHeader lab={lab} />

      <p className="text-sm text-muted">
        This profile dashboard has four independent widgets. Use{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">expect.soft</code> to
        check all of them in one test without aborting on the first failure. Wrap each check in a{' '}
        <code className="rounded bg-surface-raised px-1 font-mono text-xs">test.step</code> for
        readable traces.
      </p>

      <div aria-label="Profile dashboard" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActivityScore />
        <StatusBadge />
        <ProfileWidget />
        <NotificationsWidget />
      </div>
    </div>
  );
}
