import { useState, useRef } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'browser-events')!;

type DialogResult = { type: string; value: string } | null;

export function BrowserEvents() {
  const [dialogResult, setDialogResult] = useState<DialogResult>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerAlert = () => {
    window.alert('This is an alert dialog. Playwright handles it with page.on("dialog").');
    setDialogResult({ type: 'alert', value: 'accepted' });
  };

  const triggerConfirm = () => {
    const accepted = window.confirm('Do you want to proceed? Accept or dismiss this dialog.');
    setDialogResult({ type: 'confirm', value: accepted ? 'accepted' : 'dismissed' });
  };

  const triggerPrompt = () => {
    const value = window.prompt('Enter your name:', 'Playwright');
    if (value !== null) {
      setDialogResult({ type: 'prompt', value: `"${value}"` });
    } else {
      setDialogResult({ type: 'prompt', value: 'dismissed' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadedFile(file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : null);
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="space-y-10">
        {/* ── Dialogs ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="dialogs-heading">
          <h2 id="dialogs-heading" className="mb-1 text-base font-semibold text-content">
            Native dialogs
          </h2>
          <p className="mb-4 text-sm text-muted">
            Each dialog type requires a handler registered on the page before the action that
            triggers it. Try each type and assert the outcome shown on the page.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={triggerAlert}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Trigger alert
            </button>
            <button
              type="button"
              onClick={triggerConfirm}
              className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-600 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              Trigger confirm
            </button>
            <button
              type="button"
              onClick={triggerPrompt}
              className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-600 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              Trigger prompt
            </button>
          </div>

          {dialogResult && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-content"
            >
              Last dialog: <strong>{dialogResult.type}</strong> → {dialogResult.value}
            </div>
          )}
        </section>

        {/* ── File upload ─────────────────────────────────────────────────── */}
        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="mb-1 text-base font-semibold text-content">
            File upload
          </h2>
          <p className="mb-4 text-sm text-muted">
            Attach a file programmatically to the hidden file input. The input does not need to be
            visible for the interaction to succeed.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="file-upload"
              className="cursor-pointer rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
            >
              Choose file
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              aria-label="Upload a file"
              onChange={handleFileChange}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
            >
              Upload via button
            </button>
          </div>

          {uploadedFile ? (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-content">
              Selected: <strong>{uploadedFile}</strong>
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">No file selected yet.</p>
          )}
        </section>

        {/* ── File download ────────────────────────────────────────────────── */}
        <section aria-labelledby="download-heading">
          <h2 id="download-heading" className="mb-1 text-base font-semibold text-content">
            File download
          </h2>
          <p className="mb-4 text-sm text-muted">
            Use{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">
              page.waitForEvent(&apos;download&apos;)
            </code>{' '}
            to capture the download before clicking. Assert the suggested filename or save path.
          </p>

          <a
            href="data:text/plain;charset=utf-8,Hello%20from%20Stagecraft!%0AThis%20is%20a%20practice%20download%20file."
            download="stagecraft-sample.txt"
            className="inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Download sample.txt
          </a>
        </section>

        {/* ── Navigation event ─────────────────────────────────────────────── */}
        <section aria-labelledby="navigation-heading">
          <h2 id="navigation-heading" className="mb-1 text-base font-semibold text-content">
            Navigation event
          </h2>
          <p className="mb-4 text-sm text-muted">
            Use{' '}
            <code className="rounded bg-surface-raised px-1 text-xs">page.waitForNavigation()</code>{' '}
            or <code className="rounded bg-surface-raised px-1 text-xs">page.waitForURL()</code>{' '}
            when a click causes a page transition. This link navigates away from the lab.
          </p>

          <a
            href="/"
            className="inline-block rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
          >
            Navigate to home
          </a>
        </section>
      </div>
    </div>
  );
}
