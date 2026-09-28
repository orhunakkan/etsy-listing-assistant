import { useState, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { assertOk, getErrorMessage, readJson } from '../../lib/api';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'api-request-context')!;

interface Task {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
}

export function ApiRequestContext() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks');
      setTasks(await readJson<Task[]>(res));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const task = await readJson<Task>(res);
      setTasks((prev) => [...prev, task]);
      setNewTitle('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (id: number, done: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !done }),
      });
      const updated = await readJson<Task>(res);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const deleteTask = async (id: number) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      assertOk(res);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <p className="mb-6 text-sm text-muted">
        Playwright&apos;s <code className="rounded bg-surface-raised px-1 text-xs">request</code>{' '}
        fixture operates entirely outside the browser. Use it to call GET, POST, PUT, and DELETE
        directly — seed data before a UI test, then verify the UI reflects it.
      </p>

      <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <p className="font-medium">API endpoints</p>
        <ul className="mt-2 space-y-0.5 font-mono text-xs">
          <li>GET &nbsp;&nbsp;/api/tasks</li>
          <li>POST &nbsp;/api/tasks &nbsp;&nbsp;&nbsp;&#123; title: string &#125;</li>
          <li>PUT &nbsp;&nbsp;/api/tasks/:id &nbsp;&#123; done?: boolean, title?: string &#125;</li>
          <li>DELETE /api/tasks/:id</li>
        </ul>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Add task */}
      <form onSubmit={(e) => void addTask(e)} className="mb-6 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          aria-label="New task title"
          placeholder="New task…"
          className="flex-1 rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {loading ? (
        <div
          role="status"
          aria-label="Loading tasks"
          className="flex items-center gap-2 text-sm text-muted"
        >
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand-600" />
          Loading…
        </div>
      ) : (
        <ul aria-label="Task list" className="space-y-2">
          {tasks.length === 0 && (
            <li className="text-sm text-muted">
              No tasks yet. Add one above or POST via the request fixture.
            </li>
          )}
          {tasks.map((task) => (
            <li
              key={task.id}
              data-testid={`task-${task.id}`}
              className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-4 py-2.5"
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => void toggleTask(task.id, task.done)}
                aria-label={`Mark "${task.title}" as ${task.done ? 'incomplete' : 'complete'}`}
                className="h-4 w-4 accent-brand-600"
              />
              <span
                className={`flex-1 text-sm ${task.done ? 'text-muted line-through' : 'text-content'}`}
              >
                {task.title}
              </span>
              <span className="text-xs text-muted">{task.createdAt.slice(0, 10)}</span>
              <button
                type="button"
                onClick={() => void deleteTask(task.id)}
                aria-label={`Delete ${task.title}`}
                className="text-xs text-red-700 hover:text-red-800"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
