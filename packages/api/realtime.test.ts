import { describe, expect, it } from "vitest";
import {
  manageRealtimeSubscription,
  type RealtimeLike,
  type RealtimeResponseEvent,
} from "./realtime";

type Subscription = Awaited<ReturnType<RealtimeLike["subscribe"]>>;
type RowEvent = RealtimeResponseEvent<Record<string, unknown>>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeRealtime() {
  const calls: { channels: string[] }[] = [];
  const unsubscribeCalls: number[] = [];
  const updateCalls: { channels?: string[] }[] = [];
  const deferred = createDeferred<Subscription>();
  let capturedCallback: ((event: RowEvent) => void) | null = null;

  const subscription: Subscription = {
    unsubscribe: () => {
      unsubscribeCalls.push(Date.now());
      return Promise.resolve();
    },
    update: (changes: { channels?: string[] }) => {
      updateCalls.push(changes);
      return Promise.resolve();
    },
  };

  const realtime: RealtimeLike = {
    subscribe: (channels, callback) => {
      calls.push({ channels: [...channels] });
      capturedCallback = callback;
      return deferred.promise;
    },
  };

  return {
    calls,
    deferred,
    // Fills the RealtimeResponseEvent fields tests don't care about.
    emit: (event: Pick<RowEvent, "events" | "channels" | "payload">) =>
      capturedCallback?.({ ...event, subscriptions: [], timestamp: "" }),
    realtime,
    subscription,
    unsubscribeCalls,
    updateCalls,
  };
}

describe("manageRealtimeSubscription", () => {
  it("subscribes with the given channels and forwards events", async () => {
    const fake = createFakeRealtime();
    const received: unknown[] = [];
    manageRealtimeSubscription(fake.realtime, ["ch.a", "ch.b"], (event) =>
      received.push(event)
    );

    expect(fake.calls).toEqual([{ channels: ["ch.a", "ch.b"] }]);

    fake.deferred.resolve(fake.subscription);
    await fake.deferred.promise;
    fake.emit({ events: ["x.create"], channels: ["ch.a"], payload: { id: 1 } });

    expect(received).toHaveLength(1);
  });

  it("unsubscribes on dispose after subscribe resolves", async () => {
    const fake = createFakeRealtime();
    const handle = manageRealtimeSubscription(fake.realtime, ["ch.a"], () => {
      /* noop */
    });
    fake.deferred.resolve(fake.subscription);
    await fake.deferred.promise;

    handle.dispose();

    expect(fake.unsubscribeCalls).toHaveLength(1);
  });

  it("unsubscribes when disposed before subscribe resolves and drops events", async () => {
    const fake = createFakeRealtime();
    const received: unknown[] = [];
    const handle = manageRealtimeSubscription(
      fake.realtime,
      ["ch.a"],
      (event) => received.push(event)
    );

    handle.dispose();
    fake.deferred.resolve(fake.subscription);
    // allow the .then chain inside the manager to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fake.unsubscribeCalls).toHaveLength(1);
    fake.emit({ events: ["x.create"], channels: ["ch.a"], payload: {} });
    expect(received).toHaveLength(0);
  });

  it("reports subscribe failures through onError", async () => {
    const fake = createFakeRealtime();
    const errors: unknown[] = [];
    manageRealtimeSubscription(
      fake.realtime,
      ["ch.a"],
      () => {
        /* noop */
      },
      (error) => errors.push(error)
    );

    fake.deferred.reject(new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
  });
});
