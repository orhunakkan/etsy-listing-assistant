import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'accessible-locators')!;

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  available: boolean;
}

const BOOKS: Book[] = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', genre: 'Programming', available: true },
  {
    id: 2,
    title: 'The Pragmatic Programmer',
    author: 'David Thomas',
    genre: 'Programming',
    available: false,
  },
  {
    id: 3,
    title: 'Design Patterns',
    author: 'Gang of Four',
    genre: 'Architecture',
    available: true,
  },
  { id: 4, title: 'Refactoring', author: 'Martin Fowler', genre: 'Programming', available: true },
  {
    id: 5,
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    genre: 'Design',
    available: true,
  },
  {
    id: 6,
    title: 'Domain-Driven Design',
    author: 'Eric Evans',
    genre: 'Architecture',
    available: false,
  },
];

const GENRES = ['All', 'Programming', 'Architecture', 'Design'];

function bookCoverSrc(title: string, idx: number): string {
  const colors = ['4f46e5', '0891b2', '16a34a', 'dc2626', '9333ea', 'ea580c'];
  const color = colors[idx % colors.length];
  const initial = title[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="88" viewBox="0 0 64 88"><rect width="64" height="88" fill="#${color}" rx="3"/><text x="32" y="50" font-family="sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function AccessibleLocators() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [wishlist, setWishlist] = useState<number[]>([]);

  const q = query.toLowerCase();
  const filtered = BOOKS.filter((b) => {
    const matchesQuery = b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    const matchesGenre = genre === 'All' || b.genre === genre;
    return matchesQuery && matchesGenre;
  });

  const toggleWishlist = (id: number) =>
    setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div>
      <LabHeader lab={lab} />

      {/* Search controls */}
      <section aria-label="Search controls" className="mb-6 flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="search-input" className="text-sm font-medium text-muted">
            Search books
          </label>
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or author…"
            className="rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="genre-select" className="text-sm font-medium text-muted">
            Filter by genre
          </label>
          <select
            id="genre-select"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Live status */}
      <p role="status" className="mb-4 text-sm text-muted">
        {filtered.length === 0
          ? 'No books found.'
          : `Showing ${filtered.length} of ${BOOKS.length} books`}
      </p>

      {/* Wishlist alert */}
      {wishlist.length > 0 && (
        <p
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        >
          {wishlist.length} {wishlist.length === 1 ? 'book' : 'books'} in your wishlist
        </p>
      )}

      {/* Results */}
      <section aria-label="Book results">
        <h2 className="mb-4 text-base font-semibold text-content">Results</h2>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted">Try a different search or filter.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((book, idx) => (
              <article key={book.id} className="rounded-xl border border-edge bg-surface p-4">
                <img
                  src={bookCoverSrc(book.title, idx)}
                  alt={`${book.title} book cover`}
                  width={64}
                  height={88}
                  className="mb-3 rounded"
                />
                <h3 className="text-sm font-semibold text-content">{book.title}</h3>
                <p className="mt-0.5 text-xs text-muted">{book.author}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-muted">
                    {book.genre}
                  </span>
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-xs',
                      book.available
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
                    ].join(' ')}
                  >
                    {book.available ? 'Available' : 'Checked out'}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWishlist(book.id)}
                    aria-pressed={wishlist.includes(book.id)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      wishlist.includes(book.id)
                        ? 'bg-brand-600 text-white'
                        : 'border border-edge text-muted hover:bg-canvas',
                    ].join(' ')}
                  >
                    Add to wishlist
                  </button>
                  <a
                    href={`#book-${book.id}`}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted hover:bg-canvas transition-colors"
                  >
                    View details
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      <nav aria-label="Catalog pagination" className="mt-8 flex items-center gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-muted">Page 1 of 1</span>
        <button
          type="button"
          disabled
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed"
        >
          Next
        </button>
      </nav>
    </div>
  );
}
