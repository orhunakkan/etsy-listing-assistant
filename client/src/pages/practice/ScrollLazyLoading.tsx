import { useState, useEffect, useRef, useCallback } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'scroll-lazy-loading')!;

interface FeedItem {
  id: number;
  title: string;
  body: string;
  createdAt: string;
}

interface FeedPage {
  items: FeedItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 8;

export function ScrollLazyLoading() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const inFlightPages = useRef<Set<number>>(new Set());
  const loadedItemIds = useRef<Set<number>>(new Set());

  const fetchPage = useCallback(async (pageNum: number) => {
    if (inFlightPages.current.has(pageNum)) return;

    inFlightPages.current.add(pageNum);
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?page=${pageNum}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) return;
      const data: FeedPage = (await res.json()) as FeedPage;
      const nextItems = data.items.filter((item) => {
        if (loadedItemIds.current.has(item.id)) return false;
        loadedItemIds.current.add(item.id);
        return true;
      });
      setItems((prev) => [...prev, ...nextItems]);
      setHasMore(data.hasMore);
      setPage(pageNum + 1);
    } finally {
      inFlightPages.current.delete(pageNum);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          void fetchPage(page);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  function handleJump() {
    const id = parseInt(jumpValue, 10);
    if (isNaN(id)) return;
    const el = itemRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <LabHeader lab={lab} />

      {/* Jump control */}
      <section
        aria-labelledby="jump-heading"
        className="rounded-lg border border-edge bg-surface p-4"
      >
        <h2 id="jump-heading" className="text-sm font-semibold text-content">
          Jump to Item
        </h2>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            min={1}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder="Item #"
            aria-label="Jump to item number"
            className="w-28 rounded border border-edge bg-canvas px-3 py-1.5 text-sm text-content focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleJump}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Jump
          </button>
        </div>
      </section>

      {/* Feed */}
      <section aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="text-lg font-semibold text-content">
          Activity Feed
        </h2>
        <ul
          aria-label="Activity feed"
          className="mt-4 divide-y divide-edge rounded-lg border border-edge"
        >
          {items.map((item) => (
            <li
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
              }}
              data-item-id={item.id}
              className="px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-content">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">#{item.id}</span>
              </div>
            </li>
          ))}
        </ul>

        {loading && (
          <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
            Loading more…
          </p>
        )}

        {/* Sentinel for IntersectionObserver */}
        {hasMore && !loading && <div ref={sentinelRef} aria-hidden="true" className="h-4" />}

        {!hasMore && (
          <p
            data-testid="end-marker"
            className="mt-6 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            You&apos;re all caught up
          </p>
        )}
      </section>
    </div>
  );
}
