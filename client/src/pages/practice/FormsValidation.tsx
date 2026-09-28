import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'forms-validation')!;

interface FormState {
  name: string;
  email: string;
  category: string;
  frequency: string;
  file: File | null;
  agreed: boolean;
}

type RequiredField = Exclude<keyof FormState, 'file'>;
type FormErrors = Partial<Record<RequiredField, string>>;

const REQUIRED_FIELDS: RequiredField[] = ['name', 'email', 'category', 'frequency', 'agreed'];
const TOPIC_CATEGORIES = ['Technology', 'Design', 'Business', 'Science'] as const;
const EMAIL_FREQUENCIES = ['Daily', 'Weekly', 'Monthly'] as const;

function validate(f: FormState): FormErrors {
  const errors: FormErrors = {};
  const name = f.name.trim();
  const email = f.email.trim();

  if (name.length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!f.category) {
    errors.category = 'Please select a category.';
  }
  if (!f.frequency) {
    errors.frequency = 'Please choose a frequency.';
  }
  if (!f.agreed) {
    errors.agreed = 'You must agree to the terms.';
  }
  return errors;
}

const INITIAL: FormState = {
  name: '',
  email: '',
  category: '',
  frequency: '',
  file: null,
  agreed: false,
};

function fieldClassName(hasError: boolean): string {
  return [
    'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1',
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
      : 'border-edge focus:border-brand-500 focus:ring-brand-500',
  ].join(' ');
}

export function FormsValidation() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [touched, setTouched] = useState<Set<RequiredField>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  const touch = (field: RequiredField) => setTouched((prev) => new Set([...prev, field]));
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const visibleError = (field: RequiredField) => (touched.has(field) ? errors[field] : undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(new Set(REQUIRED_FIELDS));
    if (isValid) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div>
        <LabHeader lab={lab} />
        <div
          role="alert"
          className="max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-700 dark:bg-emerald-950"
        >
          <p className="text-3xl">✓</p>
          <h2 className="mt-2 text-lg font-semibold text-emerald-800 dark:text-emerald-300">
            Subscribed!
          </h2>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Welcome, {form.name}.
          </p>
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL);
              setTouched(new Set());
              setSubmitted(false);
            }}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Reset form
          </button>
        </div>
      </div>
    );
  }

  const nameError = visibleError('name');
  const emailError = visibleError('email');
  const categoryError = visibleError('category');
  const frequencyError = visibleError('frequency');
  const agreedError = visibleError('agreed');

  return (
    <div>
      <LabHeader lab={lab} />

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Newsletter signup form"
        className="max-w-md space-y-5"
      >
        {/* Full name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="full-name" className="text-sm font-medium text-muted">
            Full name{' '}
            <span aria-hidden="true" className="text-red-700">
              *
            </span>
          </label>
          <input
            id="full-name"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            onBlur={() => touch('name')}
            aria-required="true"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'name-error' : undefined}
            className={fieldClassName(!!nameError)}
          />
          {nameError && (
            <p id="name-error" role="alert" className="text-xs text-red-700">
              {nameError}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email-address" className="text-sm font-medium text-muted">
            Email address{' '}
            <span aria-hidden="true" className="text-red-700">
              *
            </span>
          </label>
          <input
            id="email-address"
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => touch('email')}
            aria-required="true"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
            className={fieldClassName(!!emailError)}
          />
          {emailError && (
            <p id="email-error" role="alert" className="text-xs text-red-700">
              {emailError}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label htmlFor="topic-category" className="text-sm font-medium text-muted">
            Topic category{' '}
            <span aria-hidden="true" className="text-red-700">
              *
            </span>
          </label>
          <select
            id="topic-category"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            onBlur={() => touch('category')}
            aria-required="true"
            aria-invalid={!!categoryError}
            className={fieldClassName(!!categoryError)}
          >
            <option value="">Select a category…</option>
            {TOPIC_CATEGORIES.map((category) => (
              <option key={category} value={category.toLowerCase()}>
                {category}
              </option>
            ))}
          </select>
          {categoryError && (
            <p id="category-error" role="alert" className="text-xs text-red-700">
              {categoryError}
            </p>
          )}
        </div>

        {/* Frequency */}
        <fieldset>
          <legend className="text-sm font-medium text-muted">
            Email frequency{' '}
            <span aria-hidden="true" className="text-red-700">
              *
            </span>
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {EMAIL_FREQUENCIES.map((frequency) => {
              const value = frequency.toLowerCase();

              return (
                <label key={frequency} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="frequency"
                    value={value}
                    checked={form.frequency === value}
                    onChange={(e) => {
                      updateField('frequency', e.target.value);
                      touch('frequency');
                    }}
                    className="accent-brand-600"
                  />
                  <span className="text-sm text-muted">{frequency}</span>
                </label>
              );
            })}
          </div>
          {frequencyError && (
            <p id="frequency-error" role="alert" className="mt-1 text-xs text-red-700">
              {frequencyError}
            </p>
          )}
        </fieldset>

        {/* File upload */}
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-picture" className="text-sm font-medium text-muted">
            Profile picture <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="profile-picture"
            type="file"
            accept="image/*"
            onChange={(e) => updateField('file', e.target.files?.[0] ?? null)}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-950 dark:file:text-brand-300 dark:hover:file:bg-brand-900"
          />
          {form.file && <p className="text-xs text-muted">Selected: {form.file.name}</p>}
        </div>

        {/* Terms */}
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => {
                updateField('agreed', e.target.checked);
                touch('agreed');
              }}
              aria-required="true"
              aria-invalid={!!agreedError}
              className="mt-0.5 accent-brand-600"
            />
            <span className="text-sm text-muted">
              I agree to the{' '}
              <a href="#terms" className="text-accent underline">
                terms and conditions
              </a>
            </span>
          </label>
          {agreedError && (
            <p id="agreed-error" role="alert" className="text-xs text-red-700">
              {agreedError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Subscribe
        </button>

        <p className="text-xs text-muted">
          <span aria-hidden="true" className="text-red-700">
            *
          </span>{' '}
          Required fields
        </p>
      </form>
    </div>
  );
}
