import { SimplePool } from 'nostr-tools/pool';
import type { Filter } from 'nostr-tools/filter';
import type { Event } from 'nostr-tools/pure';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

let pool: SimplePool | null = null;

export function getPool(): SimplePool {
  if (!pool) pool = new SimplePool();
  return pool;
}

export async function publish(
  evt: Event,
  relays: string[] = DEFAULT_RELAYS
): Promise<void> {
  const p = getPool();
  await Promise.any(p.publish(relays, evt));
}

export interface SubHandle {
  close(): void;
}

/**
 * Subscribe to one or more filters. Each filter spawns its own
 * `subscribeMany` call, since nostr-tools v2 takes a single filter per
 * subscription.
 */
export function subscribe(
  filters: Filter[],
  onEvent: (evt: Event) => void,
  relays: string[] = DEFAULT_RELAYS
): SubHandle {
  const p = getPool();
  const subs = filters.map((f) =>
    p.subscribeMany(relays, f, { onevent: onEvent })
  );
  return {
    close: () => {
      for (const s of subs) s.close();
    },
  };
}

export async function fetchAll(
  filters: Filter[],
  relays: string[] = DEFAULT_RELAYS,
  timeoutMs = 4000
): Promise<Event[]> {
  const p = getPool();
  const seen = new Set<string>();
  const out: Event[] = [];
  await Promise.all(
    filters.map(
      (f) =>
        new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          const sub = p.subscribeMany(relays, f, {
            onevent: (e) => {
              if (seen.has(e.id)) return;
              seen.add(e.id);
              out.push(e);
            },
            onclose: () => finish(),
          });
          setTimeout(() => {
            sub.close();
            finish();
          }, timeoutMs);
        })
    )
  );
  return out;
}
