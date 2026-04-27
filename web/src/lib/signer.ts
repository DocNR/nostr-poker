import { finalizeEvent, type Event, type EventTemplate as ToolsTemplate } from 'nostr-tools/pure';
import type { EventTemplate, Pubkey } from './types';

/**
 * A unified signer abstraction. Backed by NIP-07 (browser extension) or
 * NIP-46 (remote signer like Clave, Amber, Nsec.app, Damus).
 */
export interface Signer {
  getPublicKey(): Promise<Pubkey>;
  signEvent(template: EventTemplate): Promise<Event>;
  /** Tag a label so the UI can render which method is in use. */
  readonly kind: 'nip07' | 'nip46' | 'local';
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: ToolsTemplate & { pubkey?: string }): Promise<Event>;
    };
  }
}

/** Wraps `window.nostr` from a NIP-07-compatible browser extension. */
export class Nip07Signer implements Signer {
  readonly kind = 'nip07' as const;

  async getPublicKey(): Promise<Pubkey> {
    if (typeof window === 'undefined' || !window.nostr) {
      throw new Error('No NIP-07 provider found. Install Alby, nos2x, or Flamingo.');
    }
    return window.nostr.getPublicKey();
  }

  async signEvent(template: EventTemplate): Promise<Event> {
    if (typeof window === 'undefined' || !window.nostr) {
      throw new Error('No NIP-07 provider found.');
    }
    const pubkey = await window.nostr.getPublicKey();
    const created_at = Math.floor(Date.now() / 1000);
    return window.nostr.signEvent({ ...template, pubkey, created_at });
  }
}

/**
 * Local signer using a private key in memory. Useful for tests and
 * three-tab dev sessions where you don't want to install three signers.
 * NEVER use this for real money.
 */
export class LocalSigner implements Signer {
  readonly kind = 'local' as const;

  constructor(private readonly secretKey: Uint8Array) {}

  async getPublicKey(): Promise<Pubkey> {
    const { getPublicKey } = await import('nostr-tools/pure');
    return getPublicKey(this.secretKey);
  }

  async signEvent(template: EventTemplate): Promise<Event> {
    const created_at = Math.floor(Date.now() / 1000);
    const evt = finalizeEvent(
      { ...template, created_at },
      this.secretKey
    );
    return evt;
  }
}

/**
 * Stub NIP-46 signer. Wires up against nostr-tools' nip46 module on a real
 * implementation; for now this just records the intent and rejects so the
 * UI can render a "coming soon" affordance.
 */
export class Nip46Signer implements Signer {
  readonly kind = 'nip46' as const;

  constructor(public readonly bunkerUri: string) {}

  async getPublicKey(): Promise<Pubkey> {
    throw new Error('NIP-46 signer not yet wired up. Use NIP-07 or local for now.');
  }

  async signEvent(_template: EventTemplate): Promise<Event> {
    throw new Error('NIP-46 signer not yet wired up. Use NIP-07 or local for now.');
  }
}
