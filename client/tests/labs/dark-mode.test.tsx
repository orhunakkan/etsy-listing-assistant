import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { AccessibleLocators } from '../../src/pages/practice/AccessibleLocators';
import { ApiRequestContext } from '../../src/pages/practice/ApiRequestContext';
import { AriaSnapshots } from '../../src/pages/practice/AriaSnapshots';
import { AsyncUi } from '../../src/pages/practice/AsyncUi';
import { BrowserEvents } from '../../src/pages/practice/BrowserEvents';
import { ClientStoragePartitioning } from '../../src/pages/practice/ClientStoragePartitioning';
import { ClockTimers } from '../../src/pages/practice/ClockTimers';
import { ComingSoon } from '../../src/pages/practice/ComingSoon';
import { ConsoleRuntimeDiagnostics } from '../../src/pages/practice/ConsoleRuntimeDiagnostics';
import { CustomAssertions } from '../../src/pages/practice/CustomAssertions';
import { DebuggingReporting } from '../../src/pages/practice/DebuggingReporting';
import { DomMemoryDiagnostics } from '../../src/pages/practice/DomMemoryDiagnostics';
import { DragAndDrop } from '../../src/pages/practice/DragAndDrop';
import { EmulationInput } from '../../src/pages/practice/EmulationInput';
import { FakeAuth } from '../../src/pages/practice/FakeAuth';
import { FakeAuthDashboard } from '../../src/pages/practice/FakeAuthDashboard';
import { FormsValidation } from '../../src/pages/practice/FormsValidation';
import { FramesContexts } from '../../src/pages/practice/FramesContexts';
import { HarRecording } from '../../src/pages/practice/HarRecording';
import { MultiTab } from '../../src/pages/practice/MultiTab';
import { MultiTabPopup } from '../../src/pages/practice/MultiTabPopup';
import { MultiTabWindow } from '../../src/pages/practice/MultiTabWindow';
import { NetworkApi } from '../../src/pages/practice/NetworkApi';
import { PasskeyAuthentication } from '../../src/pages/practice/PasskeyAuthentication';
import { ServiceWorkers } from '../../src/pages/practice/ServiceWorkers';
import { StorageState } from '../../src/pages/practice/StorageState';
import { TablesFiltering } from '../../src/pages/practice/TablesFiltering';
import { VisualRegression } from '../../src/pages/practice/VisualRegression';
import { WebSocketInterception } from '../../src/pages/practice/WebSocketInterception';
import { GeolocationPermissions } from '../../src/pages/practice/GeolocationPermissions';
import { LocatorHandlers } from '../../src/pages/practice/LocatorHandlers';
import { AccessibilityScanning } from '../../src/pages/practice/AccessibilityScanning';
import { ScrollLazyLoading } from '../../src/pages/practice/ScrollLazyLoading';
import { TouchGestures } from '../../src/pages/practice/TouchGestures';
import { ServerSentEvents } from '../../src/pages/practice/ServerSentEvents';
import { InitScripts } from '../../src/pages/practice/InitScripts';
import { SoftAssertions } from '../../src/pages/practice/SoftAssertions';
import { ShadowDom } from '../../src/pages/practice/ShadowDom';
import { MediaLocale } from '../../src/pages/practice/MediaLocale';
import type { Lab } from '../../src/labs';

function wrap(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const stubLab: Lab = {
  slug: 'stub',
  title: 'Stub Lab',
  topic: 'Stub topic',
  apis: ['page.goto'],
  status: 'ready',
  requiresBackend: false,
};

function Bomb(): never {
  throw new Error('test error');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ===========================================================================
// AccessibleLocators, ComingSoon, FramesContexts, HarRecording, NetworkApi
// ===========================================================================

describe('AccessibleLocators tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
  });

  test('book article uses bg-surface instead of bg-white', () => {
    const { container } = render(
      <MemoryRouter>
        <AccessibleLocators />
      </MemoryRouter>,
    );
    const articles = container.querySelectorAll('article');
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0]?.className).toContain('bg-surface');
    expect(articles[0]?.className).not.toContain('bg-white');
  });

  test('form labels use text-muted instead of text-zinc-700', () => {
    const { container } = render(
      <MemoryRouter>
        <AccessibleLocators />
      </MemoryRouter>,
    );
    const label = container.querySelector('label');
    expect(label?.className).toContain('text-muted');
    expect(label?.className).not.toContain('text-zinc-700');
  });
});

describe('ComingSoon tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
  });

  test('"Coming Soon" badge uses bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = render(<ComingSoon lab={stubLab} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-surface-raised');
    expect(badge?.className).not.toContain('bg-zinc-100');
  });

  test('title uses text-content instead of text-zinc-900', () => {
    render(<ComingSoon lab={stubLab} />);
    const heading = screen.getByRole('heading', { name: 'Stub Lab' });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('FramesContexts tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
  });

  test('inactive tab button uses border-edge instead of border-zinc-200', () => {
    render(
      <MemoryRouter>
        <FramesContexts />
      </MemoryRouter>,
    );
    const tabs = screen.getAllByRole('tab');
    const inactiveTab = tabs[1]!;
    expect(inactiveTab.className).toContain('border-edge');
    expect(inactiveTab.className).not.toContain('border-zinc-200');
  });

  test('challenge panel uses bg-canvas instead of bg-zinc-50', () => {
    const { container } = render(
      <MemoryRouter>
        <FramesContexts />
      </MemoryRouter>,
    );
    const panel = container.querySelector('[role="tabpanel"] > div > div');
    expect(panel?.className).toContain('bg-canvas');
    expect(panel?.className).not.toContain('bg-zinc-50');
  });
});

describe('HarRecording tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
  });

  test('workflow step list item uses bg-surface instead of bg-white', () => {
    const { container } = render(
      <MemoryRouter>
        <HarRecording />
      </MemoryRouter>,
    );
    const stepItem = container.querySelector('li.flex');
    expect(stepItem?.className).toContain('bg-surface');
    expect(stepItem?.className).not.toContain('bg-white');
  });

  test('section heading uses text-content instead of text-zinc-900', () => {
    render(
      <MemoryRouter>
        <HarRecording />
      </MemoryRouter>,
    );
    const heading = screen.getByRole('heading', { name: 'HAR recording workflow' });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('NetworkApi tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
  });

  test('description uses text-muted instead of text-zinc-500', () => {
    const { container } = render(
      <MemoryRouter>
        <NetworkApi />
      </MemoryRouter>,
    );
    const desc = container.querySelector('p');
    expect(desc?.className).toContain('text-muted');
    expect(desc?.className).not.toContain('text-zinc-500');
  });
});

describe('PasskeyAuthentication tokens', () => {
  test('registration card uses bg-surface and border-edge instead of hardcoded colors', () => {
    const { container } = render(
      <MemoryRouter>
        <PasskeyAuthentication />
      </MemoryRouter>,
    );
    const card = container.querySelector('.rounded-xl');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).toContain('border-edge');
    expect(card?.className).not.toContain('bg-white');
  });

  test('heading uses text-content instead of text-zinc-900', () => {
    render(
      <MemoryRouter>
        <PasskeyAuthentication />
      </MemoryRouter>,
    );
    const heading = screen.getByRole('heading', { name: 'Passkey for alice' });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

// ===========================================================================
// MultiTab, MultiTabWindow, MultiTabPopup, FakeAuth, FakeAuthDashboard
// ===========================================================================

describe('MultiTab tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 401))),
    );
  });

  test('storage panel uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<MultiTab />);
    const panel = container.querySelector('[data-testid="shared-storage-value"]')?.closest('div');
    expect(panel?.className).toContain('bg-surface');
    expect(panel?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<MultiTab />);
    const heading = screen.getByRole('heading', { name: /Challenge 1/ });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('MultiTabWindow tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 401))),
    );
  });

  test('root wrapper uses bg-canvas instead of bg-white', () => {
    const { container } = render(<MultiTabWindow />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('bg-canvas');
    expect(root?.className).not.toContain('bg-white');
  });

  test('panel uses bg-canvas instead of bg-zinc-50', () => {
    const { container } = render(<MultiTabWindow />);
    const panel = container.querySelector('[data-testid="tab-counter"]')?.closest('div');
    expect(panel?.className).toContain('bg-canvas');
    expect(panel?.className).not.toContain('bg-zinc-50');
  });
});

describe('MultiTabPopup tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 401))),
    );
  });

  test('root wrapper uses bg-canvas instead of bg-white', () => {
    const { container } = render(<MultiTabPopup />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('bg-canvas');
    expect(root?.className).not.toContain('bg-white');
  });

  test('input uses border-edge instead of border-zinc-300', () => {
    const { container } = render(<MultiTabPopup />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('border-edge');
    expect(input?.className).not.toContain('border-zinc-300');
  });
});

describe('FakeAuth tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 401))),
    );
  });

  test('credentials panel uses bg-canvas instead of bg-zinc-50', () => {
    wrap(<FakeAuth />);
    const heading = screen.getByText('Test credentials');
    const panel = heading.closest('div');
    expect(panel?.className).toContain('bg-canvas');
    expect(panel?.className).not.toContain('bg-zinc-50');
  });

  test('form labels use text-muted instead of text-zinc-700', () => {
    wrap(<FakeAuth />);
    const label = screen.getByText('Username');
    expect(label.className).toContain('text-muted');
    expect(label.className).not.toContain('text-zinc-700');
  });
});

describe('FakeAuthDashboard tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({ id: 1, username: 'alice', displayName: 'Alice' })),
      ),
    );
  });

  test('dashboard card uses bg-surface instead of bg-white', async () => {
    const { container } = render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<FakeAuthDashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole('heading', { name: 'Dashboard' }));

    const card = container.querySelector('[class*="rounded-xl border"]');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-white');
  });
});

// ===========================================================================
// FormsValidation, TablesFiltering, AsyncUi
// ===========================================================================

describe('FormsValidation tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('inputs use border-edge instead of border-zinc-300', () => {
    const { container } = wrap(<FormsValidation />);
    const input = container.querySelector('input#full-name');
    expect(input?.className).toContain('border-edge');
    expect(input?.className).not.toContain('border-zinc-300');
  });

  test('labels use text-muted instead of text-zinc-700', () => {
    const { container } = wrap(<FormsValidation />);
    const label = container.querySelector('label[for="full-name"]');
    expect(label?.className).toContain('text-muted');
    expect(label?.className).not.toContain('text-zinc-700');
  });
});

describe('TablesFiltering tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('table wrapper uses border-edge instead of border-zinc-200', () => {
    const { container } = wrap(<TablesFiltering />);
    const wrapper = container.querySelector('div.overflow-x-auto');
    expect(wrapper?.className).toContain('border-edge');
    expect(wrapper?.className).not.toContain('border-zinc-200');
  });

  test('table header uses bg-canvas instead of bg-zinc-50', () => {
    const { container } = wrap(<TablesFiltering />);
    const thead = container.querySelector('thead');
    expect(thead?.className).toContain('bg-canvas');
    expect(thead?.className).not.toContain('bg-zinc-50');
  });

  test('table body uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<TablesFiltering />);
    const tbody = container.querySelector('tbody');
    expect(tbody?.className).toContain('bg-surface');
    expect(tbody?.className).not.toContain('bg-white');
  });

  test('sortable header button uses text-muted instead of text-zinc-700', () => {
    const { container } = wrap(<TablesFiltering />);
    const sortBtn = container.querySelector('th button');
    expect(sortBtn?.className).toContain('text-muted');
    expect(sortBtn?.className).not.toContain('text-zinc-700');
  });
});

describe('AsyncUi tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<AsyncUi />);
    const heading = screen.getByRole('heading', { name: /Delayed content/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('ticker panel uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<AsyncUi />);
    const tickerPanel = container.querySelector('div.inline-block');
    expect(tickerPanel?.className).toContain('bg-surface');
    expect(tickerPanel?.className).not.toContain('bg-white');
  });
});

// ===========================================================================
// BrowserEvents, ApiRequestContext, WebSocketInterception, ServiceWorkers
// ===========================================================================

describe('BrowserEvents tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([], 200))),
    );
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<BrowserEvents />);
    const heading = screen.getByRole('heading', { name: /Native dialogs/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('file upload label uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<BrowserEvents />);
    const label = container.querySelector('label[for="file-upload"]');
    expect(label?.className).toContain('bg-surface');
    expect(label?.className).not.toContain('bg-white');
  });
});

describe('ApiRequestContext tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([], 200))),
    );
  });

  test('task input uses border-edge instead of border-zinc-300', () => {
    const { container } = wrap(<ApiRequestContext />);
    const input = container.querySelector('input[aria-label="New task title"]');
    expect(input?.className).toContain('border-edge');
    expect(input?.className).not.toContain('border-zinc-300');
  });
});

describe('WebSocketInterception tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([], 200))),
    );
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<WebSocketInterception />);
    const heading = screen.getByRole('heading', { name: /WebSocket connection/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('challenge cards use bg-surface instead of bg-white', () => {
    const { container } = wrap(<WebSocketInterception />);
    const challengeCards = container.querySelectorAll('div.rounded-xl.border');
    const card = Array.from(challengeCards).find((el) => el.textContent?.includes('Challenge 1'));
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-white');
  });

  test('message log uses bg-canvas instead of bg-zinc-50', () => {
    const { container } = wrap(<WebSocketInterception />);
    const msgLog = container.querySelector('[aria-label="WebSocket message log"]');
    expect(msgLog?.className).toContain('bg-canvas');
    expect(msgLog?.className).not.toContain('bg-zinc-50');
  });
});

describe('ServiceWorkers tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([], 200))),
    );
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<ServiceWorkers />);
    const heading = screen.getByRole('heading', { name: /Step 1/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

// ===========================================================================
// StorageState, ClockTimers, DebuggingReporting, AriaSnapshots
// ===========================================================================

describe('StorageState tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(null, 401))),
    );
  });

  test('credentials hint panel uses bg-canvas instead of bg-zinc-50', () => {
    wrap(<StorageState />);
    const heading = screen.getByText('Test credentials');
    const panel = heading.closest('div');
    expect(panel?.className).toContain('bg-canvas');
    expect(panel?.className).not.toContain('bg-zinc-50');
  });

  test('not-authenticated panel uses bg-canvas instead of bg-zinc-50', async () => {
    const { container } = wrap(<StorageState />);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="not-authenticated"]')).toBeTruthy(),
    );
    const panel = container.querySelector('[data-testid="not-authenticated"]');
    expect(panel?.className).toContain('bg-canvas');
    expect(panel?.className).not.toContain('bg-zinc-50');
  });
});

describe('ClockTimers tokens', () => {
  beforeEach(() => vi.useFakeTimers());

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<ClockTimers />);
    const heading = screen.getByRole('heading', { name: /Countdown timer/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('countdown card uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<ClockTimers />);
    const countdown = container.querySelector('[data-testid="countdown"]');
    const card = countdown?.closest('div.rounded-xl');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-white');
  });
});

describe('ClientStoragePartitioning tokens', () => {
  test('sections use bg-surface and border-edge instead of hardcoded colors', () => {
    const { container } = wrap(<ClientStoragePartitioning />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).toContain('border-edge');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<ClientStoragePartitioning />);
    const heading = screen.getByRole('heading', { name: 'Theme preference' });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('ConsoleRuntimeDiagnostics tokens', () => {
  test('action log panel uses bg-surface and border-edge instead of hardcoded colors', () => {
    const { container } = wrap(<ConsoleRuntimeDiagnostics />);
    const panel = container.querySelector('.rounded-xl');
    expect(panel?.className).toContain('bg-surface');
    expect(panel?.className).toContain('border-edge');
    expect(panel?.className).not.toContain('bg-white');
  });

  test('action buttons use text-muted instead of text-zinc-700', () => {
    wrap(<ConsoleRuntimeDiagnostics />);
    const button = screen.getByRole('button', { name: 'Log info' });
    expect(button.className).toContain('text-muted');
    expect(button.className).not.toContain('text-zinc-700');
  });
});

describe('DebuggingReporting tokens', () => {
  beforeEach(() => vi.useFakeTimers());

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<DebuggingReporting />);
    const heading = screen.getByRole('heading', { name: /Flaky component/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('uptime panel uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<DebuggingReporting />);
    const counter = container.querySelector('[data-testid="live-counter"]');
    const card = counter?.closest('div.inline-flex');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-white');
  });
});

describe('AriaSnapshots tokens', () => {
  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<AriaSnapshots />);
    const heading = screen.getByRole('heading', { name: /Accordion/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('accordion uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<AriaSnapshots />);
    const accordion = container.querySelector('div.divide-y');
    expect(accordion?.className).toContain('bg-surface');
    expect(accordion?.className).not.toContain('bg-white');
  });
});

// ===========================================================================
// EmulationInput, DragAndDrop
// ===========================================================================

describe('EmulationInput tokens', () => {
  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<EmulationInput />);
    const heading = screen.getByRole('heading', { name: /Keyboard/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('open palette button uses bg-surface instead of bg-white', () => {
    wrap(<EmulationInput />);
    const btn = screen.getByRole('button', { name: /Open command palette/i });
    expect(btn.className).toContain('bg-surface');
    expect(btn.className).not.toContain('bg-white');
  });

  test('kbd elements use bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = wrap(<EmulationInput />);
    const kbdElements = container.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
    expect(kbdElements[0]?.className).toContain('bg-surface-raised');
    expect(kbdElements[0]?.className).not.toContain('bg-zinc-100');
  });
});

describe('DragAndDrop tokens', () => {
  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<DragAndDrop />);
    const heading = screen.getByRole('heading', { name: /Kanban board/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('kanban columns use bg-canvas instead of bg-zinc-50', () => {
    const { container } = wrap(<DragAndDrop />);
    const columns = container.querySelectorAll('[data-column]');
    expect(columns.length).toBeGreaterThan(0);
    expect(columns[0]?.className).toContain('bg-canvas');
    expect(columns[0]?.className).not.toContain('bg-zinc-50');
  });

  test('kanban cards use bg-surface instead of bg-white', () => {
    const { container } = wrap(<DragAndDrop />);
    const cards = container.querySelectorAll('[data-card-id]');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.className).toContain('bg-surface');
    expect(cards[0]?.className).not.toContain('bg-white');
  });

  test('sortable list items use bg-surface instead of bg-white', () => {
    const { container } = wrap(<DragAndDrop />);
    const items = container.querySelectorAll('[data-testid^="sort-item-"]');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.className).toContain('bg-surface');
    expect(items[0]?.className).not.toContain('bg-white');
  });
});

// ===========================================================================
// VisualRegression, ErrorBoundary
// ===========================================================================

describe('VisualRegression tokens', () => {
  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<VisualRegression />);
    const heading = screen.getByRole('heading', { name: /Button variants/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('indigo note panel has dark-mode classes', () => {
    const { container } = wrap(<VisualRegression />);
    const notePanel = container.querySelector('div.bg-brand-50');
    expect(notePanel?.className).toContain('dark:bg-brand-950');
    expect(notePanel?.className).toContain('dark:text-brand-300');
  });
});

describe('ErrorBoundary tokens', () => {
  test('error alert panel has dark-mode variant classes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.className).toContain('dark:bg-red-950');
    expect(alert?.className).toContain('dark:text-red-400');
    consoleError.mockRestore();
  });
});

// ===========================================================================
// GeolocationPermissions, LocatorHandlers, AccessibilityScanning
// ===========================================================================

describe('GeolocationPermissions tokens', () => {
  test('section panels use bg-surface instead of bg-white', () => {
    const { container } = wrap(<GeolocationPermissions />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<GeolocationPermissions />);
    const heading = screen.getByRole('heading', { name: /Find Nearby/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('LocatorHandlers tokens', () => {
  test('controls panel uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<LocatorHandlers />);
    const panel = container.querySelector('div.rounded-lg');
    expect(panel?.className).toContain('bg-surface');
    expect(panel?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<LocatorHandlers />);
    const heading = screen.getByRole('heading', { name: /Checkout Flow/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('AccessibilityScanning tokens', () => {
  test('toggle panel uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<AccessibilityScanning />);
    const panel = container.querySelector('div.rounded-lg');
    expect(panel?.className).toContain('bg-surface');
    expect(panel?.className).not.toContain('bg-white');
  });

  test('form heading uses text-content instead of text-zinc-900', () => {
    wrap(<AccessibilityScanning />);
    const heading = screen.getByRole('heading', { name: /Settings Form/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

// ===========================================================================
// ScrollLazyLoading, TouchGestures, ServerSentEvents
// ===========================================================================

describe('ScrollLazyLoading tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ items: [], page: 1, pageSize: 8, total: 0, hasMore: false }),
        ),
      ),
    );
  });

  test('jump control section uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<ScrollLazyLoading />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('activity feed heading uses text-content instead of text-zinc-900', () => {
    wrap(<ScrollLazyLoading />);
    const heading = screen.getByRole('heading', { name: /Activity Feed/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('TouchGestures tokens', () => {
  test('section panels use bg-surface instead of bg-white', () => {
    const { container } = wrap(<TouchGestures />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<TouchGestures />);
    const heading = screen.getByRole('heading', { name: /Tap Counter/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('code elements use bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = wrap(<TouchGestures />);
    const code = container.querySelector('code');
    expect(code?.className).toContain('bg-surface-raised');
    expect(code?.className).not.toContain('bg-zinc-100');
  });
});

describe('ServerSentEvents tokens', () => {
  test('controls section uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<ServerSentEvents />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<ServerSentEvents />);
    const heading = screen.getByRole('heading', { name: /Build/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('code elements use bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = wrap(<ServerSentEvents />);
    const code = container.querySelector('code');
    expect(code?.className).toContain('bg-surface-raised');
    expect(code?.className).not.toContain('bg-zinc-100');
  });
});

// ===========================================================================
// InitScripts, SoftAssertions, ShadowDom, MediaLocale
// ===========================================================================

describe('InitScripts tokens', () => {
  test('feature flags section uses bg-surface instead of bg-white', () => {
    const { container } = wrap(<InitScripts />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<InitScripts />);
    const heading = screen.getByRole('heading', { name: /Feature Flags/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('code elements in sections use bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = wrap(<InitScripts />);
    const code = container.querySelector('section code');
    expect(code?.className).toContain('bg-surface-raised');
    expect(code?.className).not.toContain('bg-zinc-100');
  });
});

describe('SoftAssertions tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('dashboard widget cards use bg-surface instead of bg-white', () => {
    const { container } = wrap(<SoftAssertions />);
    const card = container.querySelector('div.rounded-lg.border');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-white');
  });

  test('widget labels use text-muted instead of text-zinc-500', () => {
    const { container } = wrap(<SoftAssertions />);
    const label = container.querySelector('p.text-sm.font-medium');
    expect(label?.className).toContain('text-muted');
    expect(label?.className).not.toContain('text-zinc-500');
  });
});

describe('ShadowDom tokens', () => {
  test('section panels use bg-surface instead of bg-white', () => {
    const { container } = wrap(<ShadowDom />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<ShadowDom />);
    const heading = screen.getByRole('heading', { name: /Star Rating Widget/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });

  test('code elements use bg-surface-raised instead of bg-zinc-100', () => {
    const { container } = wrap(<ShadowDom />);
    const code = container.querySelector('code');
    expect(code?.className).toContain('bg-surface-raised');
    expect(code?.className).not.toContain('bg-zinc-100');
  });
});

describe('MediaLocale tokens', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  test('section panels use bg-surface instead of bg-white', () => {
    const { container } = wrap(<MediaLocale />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-surface');
    expect(section?.className).not.toContain('bg-white');
  });

  test('section headings use text-content instead of text-zinc-900', () => {
    wrap(<MediaLocale />);
    const heading = screen.getByRole('heading', { name: /Colour Scheme/i });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});

describe('DomMemoryDiagnostics tokens', () => {
  test('panels use bg-surface and border-edge instead of hardcoded colors', () => {
    const { container } = wrap(<DomMemoryDiagnostics />);
    const panel = container.querySelector('.rounded-xl');
    expect(panel?.className).toContain('bg-surface');
    expect(panel?.className).toContain('border-edge');
    expect(panel?.className).not.toContain('bg-white');
  });
});

describe('CustomAssertions tokens', () => {
  test('order card uses bg-surface and border-edge instead of hardcoded colors', () => {
    const { container } = wrap(<CustomAssertions />);
    const card = container.querySelector('.rounded-xl');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).toContain('border-edge');
    expect(card?.className).not.toContain('bg-white');
  });

  test('order heading uses text-content instead of text-zinc-900', () => {
    wrap(<CustomAssertions />);
    const heading = screen.getByRole('heading', { name: 'Order #A1042' });
    expect(heading.className).toContain('text-content');
    expect(heading.className).not.toContain('text-zinc-900');
  });
});
