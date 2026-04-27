/**
 * NWC wallet wrapper using @getalby/bitcoin-connect.
 *
 * We import lazily because bitcoin-connect drags in DOM dependencies and
 * we want vitest (Node env) to be able to import this file.
 */

import type { Pubkey, Sats } from './types';

export interface WalletConnection {
  connected: boolean;
  /** Pay an invoice via the connected wallet. Returns preimage. */
  payInvoice(bolt11: string): Promise<{ preimage: string }>;
  /** Make an invoice via the connected wallet (rare for our flow; usually
   * the loser pays an invoice from the winner's lud16). */
  makeInvoice(amountSats: Sats, memo: string): Promise<{ bolt11: string }>;
  disconnect(): Promise<void>;
}

let _connection: WalletConnection | null = null;

export async function ensureConnected(): Promise<WalletConnection> {
  if (_connection?.connected) return _connection;
  const bc = await import('@getalby/bitcoin-connect');
  // Open the modal; awaits user approval.
  // The bitcoin-connect API: `launchModal()` opens UI, `requestProvider()`
  // returns a WebLN provider once connected.
  await bc.launchModal();
  const provider: any = await bc.requestProvider();
  _connection = {
    connected: true,
    async payInvoice(bolt11: string) {
      const r = await provider.sendPayment(bolt11);
      return { preimage: r.preimage };
    },
    async makeInvoice(amountSats: number, memo: string) {
      const r = await provider.makeInvoice({ amount: amountSats, defaultMemo: memo });
      return { bolt11: r.paymentRequest };
    },
    async disconnect() {
      await bc.disconnect?.();
      _connection = null;
    },
  };
  return _connection;
}

/**
 * Pay a Lightning Address (lud16) by fetching the LNURL endpoint and
 * paying the returned invoice. This is the core of per-hand auto-settle:
 * loser's wallet pays the winner's lud16 directly.
 */
export async function payLud16(
  lud16: string,
  amountSats: Sats,
  memo: string
): Promise<{ preimage: string }> {
  const conn = await ensureConnected();
  const bolt11 = await fetchInvoiceFromLud16(lud16, amountSats, memo);
  return conn.payInvoice(bolt11);
}

async function fetchInvoiceFromLud16(
  lud16: string,
  amountSats: Sats,
  memo: string
): Promise<string> {
  const [name, host] = lud16.split('@');
  if (!name || !host) throw new Error(`malformed lud16: ${lud16}`);
  const res = await fetch(`https://${host}/.well-known/lnurlp/${name}`);
  if (!res.ok) throw new Error(`LNURL lookup failed: ${res.status}`);
  const data = await res.json();
  const callback = data.callback as string;
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountSats * 1000));
  url.searchParams.set('comment', memo.slice(0, 200));
  const invoiceRes = await fetch(url.toString());
  if (!invoiceRes.ok) throw new Error(`LNURL invoice request failed: ${invoiceRes.status}`);
  const invoiceData = await invoiceRes.json();
  if (!invoiceData.pr) throw new Error('LNURL response missing pr (invoice)');
  return invoiceData.pr as string;
}
