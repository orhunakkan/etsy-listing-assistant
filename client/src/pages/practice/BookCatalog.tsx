import { useEffect, useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { getErrorMessage, readJson } from '../../lib/api';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'book-catalog')!;

const PAGE_SIZE = 10;
const COUNTRIES = [
  'Canada',
  'Chile',
  'Colombia',
  'Japan',
  'Nigeria',
  'United Kingdom',
  'United States',
];
const GENRES = [
  'Classic',
  'Dystopian',
  'Fantasy',
  'Fiction',
  'Historical',
  'Nonfiction',
  'Romance',
  'Sci-Fi',
];

type Direction = 'asc' | 'desc';

interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sql: string;
}

interface AuthorRow {
  id: number;
  name: string;
  country: string;
  birthYear: number;
}

interface BookRow {
  id: number;
  title: string;
  authorId: number;
  genre: string;
  publishedYear: number;
  rating: number;
}

interface CatalogRow {
  id: number;
  title: string;
  genre: string;
  publishedYear: number;
  rating: number;
  authorName: string;
  authorCountry: string;
}

interface FilterConfig {
  label: string;
  paramName: string;
  options: string[];
}

interface SortOption {
  value: string;
  label: string;
}

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface QueryPanelProps<T> {
  panelId: string;
  endpoint: string;
  searchLabel?: string;
  searchParamName?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  sortOptions: SortOption[];
  columns: Column<T>[];
  rowKey: (row: T) => number;
  resultsLabel: string;
}

function QueryPanel<T>({
  panelId,
  endpoint,
  searchLabel,
  searchParamName,
  searchPlaceholder,
  filters = [],
  sortOptions,
  columns,
  rowKey,
  resultsLabel,
}: QueryPanelProps<T>) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(sortOptions[0]!.value);
  const [direction, setDirection] = useState<Direction>('asc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
        sort,
        direction,
      });
      if (searchParamName && search.trim()) {
        params.set(searchParamName, search.trim());
      }
      for (const filter of filters) {
        const value = filterValues[filter.paramName];
        if (value) params.set(filter.paramName, value);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const body = await readJson<PageResponse<T>>(res);
      setData(body);
      setPage(body.page);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runQuery(1);
    // Run once when this tab mounts — subsequent runs are explicit, via the
    // Run Query button or Prev/Next pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div role="tabpanel" id={`${panelId}-panel`} aria-labelledby={`${panelId}-tab`}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {searchParamName && (
          <div>
            <label
              htmlFor={`${panelId}-search`}
              className="mb-1 block text-xs font-medium text-muted"
            >
              {searchLabel}
            </label>
            <input
              id={`${panelId}-search`}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="rounded-lg border border-edge px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}
        {filters.map((filter) => (
          <div key={filter.paramName}>
            <label
              htmlFor={`${panelId}-${filter.paramName}`}
              className="mb-1 block text-xs font-medium text-muted"
            >
              {filter.label}
            </label>
            <select
              id={`${panelId}-${filter.paramName}`}
              value={filterValues[filter.paramName] ?? ''}
              onChange={(e) =>
                setFilterValues((prev) => ({ ...prev, [filter.paramName]: e.target.value }))
              }
              className="rounded-lg border border-edge px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label htmlFor={`${panelId}-sort`} className="mb-1 block text-xs font-medium text-muted">
            Sort by
          </label>
          <select
            id={`${panelId}-sort`}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-edge px-2 py-2 text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="rounded-lg border border-edge px-3 py-2 text-sm"
        >
          {direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
        </button>
        <button
          type="button"
          onClick={() => void runQuery(1)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Run Query
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          Error: {error}
        </div>
      )}

      {data && !error && (
        <div className="mb-4 rounded-lg border border-edge bg-surface-raised p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Query executed
          </p>
          <code className="block break-all text-xs text-content">{data.sql}</code>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label={`Loading ${resultsLabel}`} className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-raised" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <p className="text-sm text-muted">No {resultsLabel} match this query.</p>
      ) : (
        data &&
        !error && (
          <div className="overflow-x-auto">
            <table aria-label={resultsLabel} className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge text-xs uppercase text-muted">
                  {columns.map((col) => (
                    <th key={col.header} scope="col" className="px-3 py-2">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-edge">
                    {columns.map((col) => (
                      <td key={col.header} className="px-3 py-2 text-content">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {data && !error && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runQuery(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => void runQuery(page + 1)}
              disabled={!data.hasMore || loading}
              className="rounded-lg border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = 'authors' | 'books' | 'catalog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'authors', label: 'Authors' },
  { id: 'books', label: 'Books' },
  { id: 'catalog', label: 'Catalog (JOIN)' },
];

export function BookCatalog() {
  const [activeTab, setActiveTab] = useState<Tab>('authors');
  const [resetKey, setResetKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!window.confirm('Reset the Authors and Books tables back to their seeded fixture data?')) {
      return;
    }
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/book-catalog/reseed', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setResetKey((k) => k + 1);
    } catch (e) {
      setResetError(getErrorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      {resetError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          Error: {resetError}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Book Catalog queries" className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-edge text-content hover:bg-surface-raised',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={resetting}
          className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : 'Reset catalog data'}
        </button>
      </div>

      {activeTab === 'authors' && (
        <QueryPanel<AuthorRow>
          key={`authors-${resetKey}`}
          panelId="authors"
          endpoint="/api/book-catalog/authors"
          searchLabel="Name contains"
          searchParamName="search"
          searchPlaceholder="e.g. Austen"
          filters={[{ label: 'Country', paramName: 'country', options: COUNTRIES }]}
          sortOptions={[
            { value: 'name', label: 'Name' },
            { value: 'birthYear', label: 'Birth year' },
          ]}
          columns={[
            { header: 'Name', render: (a) => a.name },
            { header: 'Country', render: (a) => a.country },
            { header: 'Born', render: (a) => a.birthYear },
          ]}
          rowKey={(a) => a.id}
          resultsLabel="authors"
        />
      )}

      {activeTab === 'books' && (
        <QueryPanel<BookRow>
          key={`books-${resetKey}`}
          panelId="books"
          endpoint="/api/book-catalog/books"
          searchLabel="Title contains"
          searchParamName="search"
          searchPlaceholder="e.g. Solitude"
          filters={[{ label: 'Genre', paramName: 'genre', options: GENRES }]}
          sortOptions={[
            { value: 'title', label: 'Title' },
            { value: 'publishedYear', label: 'Published year' },
            { value: 'rating', label: 'Rating' },
          ]}
          columns={[
            { header: 'Title', render: (b) => b.title },
            { header: 'Genre', render: (b) => b.genre },
            { header: 'Year', render: (b) => b.publishedYear },
            { header: 'Rating', render: (b) => b.rating.toFixed(1) },
          ]}
          rowKey={(b) => b.id}
          resultsLabel="books"
        />
      )}

      {activeTab === 'catalog' && (
        <QueryPanel<CatalogRow>
          key={`catalog-${resetKey}`}
          panelId="catalog"
          endpoint="/api/book-catalog/catalog"
          filters={[
            { label: 'Genre', paramName: 'genre', options: GENRES },
            { label: 'Author country', paramName: 'country', options: COUNTRIES },
          ]}
          sortOptions={[
            { value: 'title', label: 'Title' },
            { value: 'publishedYear', label: 'Published year' },
            { value: 'rating', label: 'Rating' },
          ]}
          columns={[
            { header: 'Title', render: (c) => c.title },
            { header: 'Author', render: (c) => c.authorName },
            { header: 'Country', render: (c) => c.authorCountry },
            { header: 'Genre', render: (c) => c.genre },
            { header: 'Year', render: (c) => c.publishedYear },
            { header: 'Rating', render: (c) => c.rating.toFixed(1) },
          ]}
          rowKey={(c) => c.id}
          resultsLabel="catalog entries"
        />
      )}
    </div>
  );
}
