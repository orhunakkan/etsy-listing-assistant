import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backoffMs, type Clock, createThrottle } from './throttle.ts';

// A clock that moves only when the test calls advance(). sleep() records the wait
// and returns at once, so concurrent callers all see the same "now".
function fakeClock(): Clock & { sleeps: number[]; advance: (ms: number) => void } {
  let time = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    advance: (ms) => {
      time += ms;
    },
    now: () => time,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
}

describe('createThrottle', () => {
  it('spaces concurrent calls 250 ms apart at 4 per second', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(4, clock);
    // All five reserve a slot at time 0, so each waits 250 ms longer than the one before:
    // they start at 0, 250, 500, 750 and 1000 ms, and no five fall within one second.
    await Promise.all(Array.from({ length: 5 }, () => throttle(async () => {})));
    assert.deepEqual(clock.sleeps, [250, 500, 750, 1000]);
  });

  it('waits only for the rest of the interval after a recent call', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(4, clock);
    await throttle(async () => {});
    clock.advance(100);
    await throttle(async () => {});
    assert.deepEqual(clock.sleeps, [150]);
  });

  it('does not wait when calls are already far apart', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(4, clock);
    await throttle(async () => {});
    clock.advance(1000);
    await throttle(async () => {});
    assert.deepEqual(clock.sleeps, []);
  });

  it('passes the task result and errors through', async () => {
    const throttle = createThrottle(4, fakeClock());
    assert.equal(await throttle(async () => 42), 42);
    await assert.rejects(
      throttle(async () => {
        throw new Error('boom');
      }),
      /boom/,
    );
  });
});

describe('backoffMs', () => {
  it('doubles from 1 s when there is no retry-after', () => {
    assert.deepEqual([0, 1, 2, 3].map((attempt) => backoffMs(attempt, null)), [1000, 2000, 4000, 8000]);
  });

  it('uses retry-after when it is longer than the exponential delay', () => {
    assert.equal(backoffMs(0, '5'), 5000);
  });

  it('uses the exponential delay when it is longer than retry-after', () => {
    assert.equal(backoffMs(3, '1'), 8000);
  });

  it('ignores a retry-after that is not a number of seconds', () => {
    assert.equal(backoffMs(1, 'Wed, 21 Oct 2026 07:28:00 GMT'), 2000);
    assert.equal(backoffMs(1, '-3'), 2000);
  });

  it('caps the delay at 60 s', () => {
    assert.equal(backoffMs(10, null), 60_000);
    assert.equal(backoffMs(0, '3600'), 60_000);
  });
});
