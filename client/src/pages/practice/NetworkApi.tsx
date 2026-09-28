import { useState, useEffect } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { assertOk, getErrorMessage, readJson } from '../../lib/api';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'network-api')!;

interface Note {
  id: number;
  text: string;
  createdAt: string;
}

export function NetworkApi() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notes');
      setNotes(await readJson<Note[]>(res));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotes();
  }, []);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText.trim() }),
      });
      const note = await readJson<Note>(res);
      setNotes((prev) => [...prev, note]);
      setNewText('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const deleteNote = async (id: number) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      assertOk(res);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      {/* Add note form */}
      <form onSubmit={(e) => void addNote(e)} className="mb-6 flex gap-2">
        <label htmlFor="note-input" className="sr-only">
          Add note
        </label>
        <input
          id="note-input"
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 rounded-lg border border-edge px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={!newText.trim() || adding}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          Error: {error}
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Loading notes" className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-raised" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2" aria-label="Notes list">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-3"
            >
              <span className="text-sm text-content">{note.text}</span>
              <button
                type="button"
                onClick={() => void deleteNote(note.id)}
                aria-label={`Delete note: ${note.text}`}
                className="ml-3 shrink-0 rounded p-1 text-muted transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-800 dark:hover:text-red-400"
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
