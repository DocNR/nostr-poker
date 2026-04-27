# nostr-poker

**A protocol and a player-facing harness for online poker on Nostr,
with Lightning settlement and a marketplace of replaceable dealers.**

> Status: pre-implementation. We're sharing the design for feedback
> before writing the production code. See *"What we want feedback on"*
> below.

---

## The idea in one paragraph

Online poker, but with three properties most online poker doesn't have:
**non-custodial** (no operator holds funds; settlement is peer-to-peer
Lightning between players' own wallets), **dealer-replaceable** (the
service that shuffles and runs hands is a third-party plug-in chosen
per game by the players, not a fixed operator), and
**protocol-transparent** (every meaningful action is a signed Nostr
event so cheating is detectable post-hoc). The product is a
player-facing harness — discovery, sit-down, gameplay UI, wallet
integration. The dealers are an open ecosystem anyone can build into.

## What this repo will contain

Three deliverables, all open:

1. **`nostr-poker` (the harness)** — the player-facing web/PWA. Sign
   in with NIP-07 / NIP-46 (Clave / Amber). Connect a wallet via
   NIP-47 (NWC). Browse dealers, pick a table, play. This is what
   players use. *(Not yet built.)*
2. **NIP-101p (the protocol)** — the contract every dealer must
   implement. Event kinds, tag conventions, hand-flow state machine,
   commit-reveal verification, settlement flow. Open spec. *(Draft in
   `docs/nip-101p-draft.md`.)*
3. **Reference dealer (bootstrap)** — a working open-source
   implementation of a NIP-101p-compliant dealer, so v1 launches with
   at least one dealer to play against. Anyone can fork it, audit it,
   replace it, or compete with their own. *(Not yet built.)*

## Architecture at a glance

```
  ┌──────────────────────────────────────────────────────┐
  │  PLAYER (browser / PWA)                              │
  │   nostr-poker harness                                │
  │    ├── Sign in: NIP-07 / NIP-46 (Clave/Amber)        │
  │    ├── Wallet:  NIP-47 NWC via bitcoin-connect       │
  │    ├── Dealer discovery (badges, reputation, fees)   │
  │    ├── Table view, action UI, hand history           │
  │    ├── Hand evaluation (pokersolver) — client-side   │
  │    ├── Pot distribution math    — client-side        │
  │    ├── Settlement zaps          — client-side        │
  │    └── Validates dealer events; publishes disputes   │
  └────────────┬───────────────────────────┬─────────────┘
               │ Nostr events              │ NWC zaps
               ▼                            ▼
      ┌────────────────────┐         ┌──────────────────┐
      │  Nostr relays      │         │ Player's own     │
      │  (table state,     │         │ Lightning wallet │
      │   action stream,   │         │ (Breez, Alby,    │
      │   reputation)      │         │  Phoenix, ...)   │
      └────────┬───────────┘         └──────────────────┘
               │
               ▼
      ┌──────────────────────────────────────┐
      │  DEALER  (3rd-party — replaceable)   │
      │   · Shuffles deck                    │
      │   · Commits to shuffle hash          │
      │   · Deals hole cards (NIP-44 enc)    │
      │   · Manages action order + timer     │
      │   · Reveals community cards          │
      │   · Reveals shown hole cards         │
      │   · Reveals shuffle seed for audit   │
      │  Does NOT compute winners/pot/zaps.  │
      └──────────────────────────────────────┘
```

The dealer is *the deck and the clock*, nothing more. Everything
economic — winner determination, pot distribution, settlement payments
— happens in each player's own client from public Nostr events.
There's no central authority on outcomes.

## Trust model

**Floor (every dealer must do):** publish a SHA-256 commitment to the
shuffled deck before dealing any cards. Reveal the seed at hand end.
Any client can verify the commitment matches the reveal. Mismatch is
public, signed proof of cheating, published as a dispute event (kind
1659). Dealer's reputation badges burn; any posted bond can be slashed.

**Above the floor (dealers compete by offering more):**
- **TEE-attested dealing** — dealer runs in AWS Nitro Enclave / Intel
  SGX-TDX; the operator can't see the deck even if they want to;
  attestation is a verifiable cryptographic claim
- **FROSTR threshold** — a t-of-n threshold signing group jointly
  deals; no single operator sees the deck
- **Bonded stakes** — dealer locks Lightning bond that's slashed on
  proven misbehavior
- **Reproducible build attestations** — operator publishes a build
  hash that matches a published-source git tag

A high-stakes table picks a TEE-attested or FROSTR-backed dealer with
a posted bond. A friendly $0-stakes table picks an open-source dealer
some kid is running for fun. Same harness, same protocol, different
trust tiers — players choose.

## Key documents

- **`docs/DESIGN.md`** — the why behind the architecture. Tradeoffs
  explored and rejected. Open questions. Read this if you want to
  understand the reasoning.
- **`docs/nip-101p-draft.md`** — the protocol draft. Event kinds, tag
  conventions, hand-flow state machine, verification rules, example
  events. Read this if you want to evaluate the protocol or build a
  compliant dealer.
- **`CONTRIBUTING.md`** — how to give feedback / suggest changes.

## What we want feedback on

This is a draft and we're explicitly seeking critique. Most useful
areas:

1. **Is the trust floor actually sufficient?** Commit-reveal catches a
   dealer who *changed* the deck after committing. It does not catch a
   dealer who pre-arranged a favorable deck before committing, or one
   who colludes with a single player by sharing what's coming.
   Reputation/bonds are the deterrent for those — is that good enough?
   What attacks are we missing?
2. **Is the dealer-only marketplace the right scope?** We considered
   splitting dealing from betting flow as separate marketplace roles
   (so specialists could emerge for each), but landed on a combined
   "dealer" role for v1 simplicity. Is that the right call?
3. **Is hand evaluation in the harness (vs. the dealer) a problem in
   practice?** The reasoning: clients can compute it deterministically
   from `pokersolver`; dealer authority shrinks to "deck + clock";
   one less thing to lie about. But it does mean we're trusting every
   client implementation to evaluate identically.
4. **Settlement timing.** Each loser's client autopays each winner's
   `lud16` after showdown via NWC. What goes wrong if one loser's
   wallet is offline / out of budget / has a routing failure? Today
   we'd treat it as "you owe a debt," but the loss-of-game mechanism
   is fuzzy.
5. **Mid-hand failure.** Dealer crashes during betting. Player's
   wallet is now committed (NWC budget held). What's the recovery?
6. **Side pots / all-ins.** Out of v1 scope, but the protocol should
   be extensible to them. Thoughts on shape?
7. **Kind-number choice.** We picked 1650–1659 + 33650 as unused
   space. Reasonable? Anyone aware of a kind collision?
8. **Mental poker as a future "trustless dealer" tier.** We're keeping
   it out of v1 because of latency and fragility. Worth specifying as
   a v2 track?
9. **Anything obvious we missed.** Prior art? Failed attempts? Key
   security papers? People to talk to?

The architectural spine is hopefully right; the details are very much
up for revision.

## How to give feedback

- Open a GitHub issue with your concern / suggestion / pointer
- Or comment inline on `docs/DESIGN.md` or `docs/nip-101p-draft.md` via
  PR
- Or reach out to Daniel directly on Nostr or via email if you'd
  rather — see contact in `CONTRIBUTING.md`

## Stack (when we do start coding)

- SvelteKit 2 + Svelte 5 (static adapter, PWA-installable) + Tailwind 4
- `nostr-tools` for Nostr (relay pool, signers, NIP-44 encryption)
- `@getalby/bitcoin-connect` for NWC wallet connection
- `pokersolver` for hand evaluation (client-side)
- vitest for tests
- TypeScript throughout

## Status

- [x] Brainstorm / design (this round; see `docs/DESIGN.md`)
- [x] Protocol draft (this round; see `docs/nip-101p-draft.md`)
- [ ] Feedback round with developer friends ← *we are here*
- [ ] Reference dealer implementation (Node service, open source)
- [ ] Player harness implementation (SvelteKit PWA)
- [ ] First end-to-end test on testnet/regtest
- [ ] Public alpha

## License

MIT — see `LICENSE`.
