import { useState } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'custom-assertions')!;

type OrderStatus = 'pending' | 'shipped' | 'delivered';
const STATUS_FLOW: OrderStatus[] = ['pending', 'shipped', 'delivered'];

export function CustomAssertions() {
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [rating, setRating] = useState(0);

  const advanceStatus = () => {
    const idx = STATUS_FLOW.indexOf(status);
    setStatus(STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]!);
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="max-w-sm">
        <div className="rounded-xl border border-edge bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-content">Order #A1042</h2>
            <span
              data-testid="order-price"
              data-value="42.50"
              className="font-mono text-sm text-content"
            >
              $42.50
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span
              data-testid="order-status"
              data-status={status}
              className="rounded-full border border-edge px-2.5 py-1 text-xs font-medium capitalize text-muted"
            >
              {status}
            </span>
            <button
              type="button"
              onClick={advanceStatus}
              disabled={status === 'delivered'}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              Advance status
            </button>
          </div>

          <div className="mt-4" role="radiogroup" aria-label="Order rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
                onClick={() => setRating(star)}
                data-testid={`star-${star}`}
                className={[
                  'text-2xl transition-colors',
                  star <= rating ? 'text-amber-700' : 'text-muted',
                ].join(' ')}
              >
                ★
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted" data-testid="rating-value">
            Rating: {rating} / 5
          </p>
        </div>
      </div>
    </div>
  );
}
