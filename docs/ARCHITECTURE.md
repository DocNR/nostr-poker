# nostr-poker — Design Notes

This document captures the *why* behind the architecture: the
tradeoffs we explored, the alternatives we rejected, and the open
questions we're hoping reviewers will help resolve. It's the
companion to the protocol draft (`nip-101p-draft.md`) and the
project landing page (`README.md` at the repo root).

If you're here to evaluate the architecture, this is the right
document. If you're here to evaluate the protocol-level details,
the NIP draft is the right document.

## Goals

In rough priority order:

1. **Non-custodial money.** No operator (including us) ever holds
   player funds. Settlement is peer-to-peer Lightning between players'
   own wallets. Buy-ins are NWC budget commitments to the player's
   own wallet, not deposits to a custodian.
2. **Replaceable dealer.** The service that shuffles cards and runs
   hands should be a third-party plug-in chosen per game by the
   players, not a fixed operator. We (the harness authors) shouldn't
   be a single point of regulatory or operational failure.
3. **Open ecosystem.** The protocol is an open NIP. Anyone can build
   a compliant dealer or an alternative client. Differentiation is by
   trust model and UX, not by lock-in.
4. **Detectable cheating.** The dealer's authority is bounded. Any
   client can verify that the deal was honest from public Nostr events
   alone. Cheating produces signed, public proof.
5. **Practical UX.** Sub-three-second hand turns. Mobile-PWA installable.
   Standard wallet connection flow. No browser extension required.

## Non-goals (v1)

- Tournaments
- Side pots / all-in resolution edge cases
- Multi-table tournaments
- In-app chat (use any Nostr client)
- Mobile native app

## Why bot-less for settlement, but a bot for dealing

Settlement (who pays whom) is fully deterministic from public events.
Once the showdown reveals cards, every client can compute the same
ledger and the same payment graph. There's no role for an authoritative
intermediary on settlement; introducing one would just create
custody risk.

Dealing is *not* deterministic from public events — it requires fresh
randomness, encrypted card distribution, and timing authority. *Someone*
has to be the deck authority. The choice is whether that's:

- a single operator (lightweight, requires trust),
- a multi-party computation among players (mental poker — heavyweight,
  fragile to disconnects, no operator trust required),
- or a third-party service the players choose (replaceable, trust
  bounded by reputation + cryptographic commit-reveal).

We picked the third because the marketplace dynamic gives players
agency: a casual game picks a $0 single-operator dealer; a high-stakes
game picks a TEE-attested or FROSTR-threshold dealer with a posted bond.
The protocol is the same. The trust tier is a per-game choice.

## What we ruled out

### Pure mental poker between players

True multi-party shuffling (kripod/mental-poker, Barnett-Smart, etc.)
gives the strongest possible trust model: nobody sees the deck. But:

- Each shuffle is a multi-round cryptographic dance among all players
- Latency: 5–15 seconds per shuffle on top of network latency
- Fragile: any player going offline mid-shuffle deadlocks the table
- Implementation complexity: significant

We're keeping it as a *future tier* in the trust model — a dealer that
implements mental poker via FROSTR or similar advertised as the highest
trust claim — but not as the v1 baseline.

### Splitting dealing and betting flow into separate marketplace roles

We considered two marketplace roles: a "dealer" (shuffles, deals cards)
and a "betting bot" (action timer, action order, pot tracking). A
table picks one of each.

Rejected for v1 because:

- Doubles the protocol surface
- Forces specialists to coordinate over Nostr events with their own
  failure modes
- No clear v1 demand for specialization
- We can add the split later — every dealer profile carries a
  `caps` tag (`["caps", "deal", "bet", "showdown"]`) so the namespace
  is reserved. v2 specialists would advertise only `["caps", "bet"]`.

### Hand evaluation by the dealer

Initially we had the dealer announce winners + pot splits at showdown.
Pulled this out because:

- Hand evaluation is deterministic from public revealed cards
- `pokersolver` (or any deterministic evaluator) gives every client
  the same answer
- Removes a class of dealer authority (and one more thing the dealer
  could lie about)
- The dealer's role shrinks to "the deck and the clock"

This is the cleanest principle in the design: *every economic outcome
is computed by the players themselves from public events.*

### Custodial dealer with onboard wallet

A simpler architecture: dealer takes buy-in zaps, holds the pot,
distributes winnings. Tons of OSS poker has tried this. We rejected it
because:

- Operator becomes a custodian — regulatory exposure, KYC pressure,
  exit-scam risk
- Defeats the "non-custodial money" goal
- Bond-and-rake is a worse model than pay-as-you-go zaps for casual home
  games
- Settlement via NWC + lud16 is technically clean and already deployed
  by the Nostr ecosystem

### JCS-canonicalized event hashing (NIP-101g pattern)

NIP-101g (golf events) uses JCS canonicalization to hash embedded
content for retroactive verification. We considered it. Rejected
because we have no mutable parent to verify against — every hand is
rooted in an immutable kind 1652, whose event ID and signature already
provide an integrity anchor. JCS would just add a dependency.

## Trust model in detail

### The floor

Every dealer must implement commit-reveal:

- Before dealing, publish `sha256(seed || canonical(seats, hand_n))` as
  `shuffle_commit` in the Hand Begin event
- After the hand ends, publish the seed and the resulting deck order
  as `shuffle_reveal` and `deck_order` in the Hand End event
- Any client recomputes the hash and verifies

This rules out:
- Switching cards mid-hand (the deck is committed before any reveal)
- Cooking the deck *after* seeing how betting went

It does not rule out:
- A dealer who pre-arranges a favorable deck before committing (the
  commit is to a chosen seed; nothing forces the seed to be random)
- A dealer who privately shares hole-card knowledge with one player
  before showdown (the dealer sees the deck in plaintext during shuffle
  in this baseline tier)

The defenses for those attacks live in higher trust tiers (TEE
attestation, FROSTR threshold dealing, bonded stakes) — discussed in
the next section. **In v1, defense reduces to reputation alone**: a
dealer caught cheating loses badges, gets labeled, and stops getting
chosen. That's it. Dealers wanting to credibly serve real-stakes games
will need a higher-tier deployment, which is post-v1 work.

### Above the floor — *post-v1 roadmap, not v1*

**v1 ships commit-reveal only.** A single-operator dealer with the
commit-reveal floor is the entire trust model on day one. Higher tiers
are reserved namespace in the protocol, not promises for the first
release. The `trust` tag values listed below are *roadmap*, evaluated
as separate work after v1 lands.

Tiers we expect to explore later, in rough order of approachability:

- `tee:nitro` — runs in AWS Nitro Enclave; operator can't see the deck
  even if they want to. Single-operator deployable, hardware-rooted
  trust. Probably the cleanest v2 upgrade path.
- `tee:sgx` — Intel SGX/TDX equivalent
- `bonded:<sats>` — Lightning bond locked to public escrow; slashed
  on proven misbehavior. Adds a financial-incentive layer to the
  commit-reveal floor.
- `source:reproducible` — open-source, with reproducible build proof
- `frostr:t-of-n` — t-of-n threshold signing group jointly does the
  deal; no single operator sees the deck. **Important caveat:** the
  trust claim only holds if the N signers are run by *N independent
  parties*. If one operator runs all N signers, they hold all the key
  shares and the threshold guarantee is illusory. So FROSTR-as-dealer
  is a coordination problem (recruiting independent operators) on top
  of an engineering problem. Realistic but later.

The harness will show whichever claims are present and let players
filter — but in v1 the only claim available is `commit-reveal`.

### Reputation

Reputation is layered on existing NIPs:

- **NIP-58 badges** for "audited," "open source build verified," etc.
- **NIP-32 labels** for "fraud," "stiffed," etc.
- **NIP-02 follow-graph** filtering ("dealers vouched by people I follow")

A dispute (kind 1659) is signed evidence that any reputation
aggregator can use. We don't build a reputation aggregator ourselves —
the data is public and any third party can.

## Architecture: who does what

| Concern | Dealer (3rd party) | Harness (player client) |
|---|---|---|
| Shuffle deck | ✅ | |
| Commit to shuffle | ✅ | |
| Encrypt hole cards (NIP-44) | ✅ | |
| Action timer + ordering | ✅ | |
| Reveal community cards | ✅ | |
| Reveal shown hole cards | ✅ | |
| Reveal shuffle seed | ✅ | |
| Hand evaluation (`pokersolver`) | | ✅ |
| Pot distribution math | | ✅ |
| Settlement zaps (NWC) | | ✅ |
| Verify dealer commitments | | ✅ |
| Publish disputes | | ✅ |
| UI / UX | | ✅ |
| Wallet connection | | ✅ |
| Nostr identity (NIP-07/46) | | ✅ |

## Player flow

1. Open the harness web/PWA
2. Sign in with NIP-07 (browser extension) or NIP-46 (remote signer like
   Clave or Amber)
3. Lobby renders advertised dealers (kind 33650) — sortable/filterable
   by badges, reputation, fees, trust tier, variants supported
4. Pick a dealer → see their open tables (kind 1650): variant, blinds,
   buy-in range, seats taken / free
5. Pick a table → connect wallet via bitcoin-connect (NWC) with a session
   budget (≥ buy-in, capped per-tx, time-limited)
6. Publish kind 1651 (Sit Down) with seat, buy-in, lud16. The dealer
   acknowledges by including you in the next Hand Begin's seat list
7. Hand plays out (Hand Begin → Hole Cards → Action loop → Community
   Cards → Showdown). Your client decrypts your own hole cards;
   evaluates final hand; if you lost, autopays winners via NWC
8. Hand End reveals the shuffle seed; your harness silently verifies;
   if it doesn't match the commit, harness publishes a Dispute and
   refuses further play
9. Stand up at any time. Unspent NWC budget stays in your wallet — was
   never debited

## Dealer flow

1. Operator generates a Nostr keypair for the dealer
2. Publishes kind 33650 dealer profile: lud16, fee, capabilities, trust
   tier claims, optional TEE attestation pointer
3. Optionally requests/earns NIP-58 badges from auditors
4. Listens for kind 1651 Sit-Down events on its tables
5. Runs the hand state machine: shuffle (commit), deal encrypted hole
   cards, manage action timing, reveal community cards, reveal shown
   hole cards at showdown, reveal shuffle seed at hand end
6. Does NOT compute winners or move money — clients handle that
7. Receives optional fees as zaps from each hand

## Open questions

We don't have firm answers on these. Reviewer input most welcome.

### Architectural

- **Mid-hand dealer failure.** Dealer crashes during betting. Each
  player's NWC budget is committed (held); the cards are out. What's
  the recovery path? Probably: harness clients detect dealer timeout,
  publish a "table abandoned" event, refund any in-pot bets back to
  contributors, and the table closes. But the betting-history is
  fuzzy — a player could have bet 200 sats that's now in limbo.
- **Settlement failure modes.** Each loser's client autopays winners.
  What if a loser's wallet is offline / out of NWC budget / has a
  routing failure? In-game it becomes a debt, but enforcement is fuzzy.
  Reputation-driven? Bond-driven? Or just "the table notices and
  doesn't deal you another hand"?
- **Mental poker tier.** We're keeping it out of v1 but want it to be
  *expressible* in the protocol. Does a multi-party-shuffle dealer fit
  cleanly into the existing event flow, or does it need new kinds?
- **Cross-implementation interop.** We'll write the reference dealer in
  TypeScript. How do we ensure a Go or Rust dealer is bit-compatible?
  Test vectors? A canonical conformance test suite?
- **Shuffle canonicalization.** Need a deterministic, language-agnostic
  way to canonicalize the input to the commit hash. Open question.
- **Action-event ordering tiebreaker.** When events arrive at different
  relays in different orders, what's canonical? `created_at` then
  event id? What about adversarial relay ordering?

### Marketplace dynamics

- **How do new dealers bootstrap reputation?** Cold start is hard.
  Maybe: low-stakes practice tables, badges from open audits.
- **Spam dealers.** A pubkey can publish a 33650 for free. How does
  the lobby filter? Probably: trust-graph filtering (NIP-02) plus
  badges from known auditors.
- **Sybil resistance for reputation.** Disputes are signed by *some*
  pubkey. A dealer could sock-puppet a bunch of fake "satisfied
  player" labels. Reputation must be web-of-trust-weighted, not raw.
- **Fee mechanism**. Per-hand zap to dealer's lud16 (current proposal)
  vs stake-and-rake escrow (more like classical poker sites). Open.

### Protocol details

- **Replaceable vs regular table-open events** (kind 1650 vs 31650)
- **Mucked-card timing**. When a player folds, we never reveal their
  cards. Does the dealer reveal mucked hole cards in Hand End for
  audit? Probably yes, otherwise the deck-order audit is incomplete.
- **All-in / side-pot extension shape**. Out of v1 but worth sketching
  so we don't paint ourselves into a corner.
- **Anti-front-running.** A player could see another player's signed
  action event hit a relay before the dealer's Action Request advances,
  and use that to inform their own subsequent action. How big a problem
  is this in practice?

## Comparison to existing work

- **Lightning poker projects (lnpoker, etc.)** — most defunct. The
  ones that shipped were mostly custodial, with the dealer holding the
  pot. We're explicitly avoiding that.
- **Mental poker libraries (kripod/mental-poker, Barnett-Smart impls)** —
  generic, not Nostr-integrated. We may use one as the basis for a
  future "trustless dealer" tier.
- **Pokerrrr 2 and similar home-game apps** — proprietary, in-person,
  not online play. Different category.
- **Major commercial sites (PokerStars, GGPoker)** — closed source,
  custodial, KYC. Different category.
- **Stake.com / crypto casinos** — custodial, often single-operator,
  some use commit-reveal as a UX feature ("provably fair") but with
  the operator as the only dealer. We adopt the same commit-reveal
  primitive but make the dealer pluggable.

If a thoughtful Nostr-native poker design already exists that we're
unaware of, we'd love a pointer.

## Repo layout (planned)

```
nostr-poker/
├── README.md                       ← landing page (this is for everyone)
├── LICENSE                          ← MIT
├── CONTRIBUTING.md                  ← how to give feedback
├── docs/
│   ├── DESIGN.md                    ← this file
│   └── nip-101p-draft.md            ← protocol spec
├── web/                             ← player harness (SvelteKit)
│   ├── package.json
│   ├── src/
│   │   ├── lib/                     ← signers, NWC, relay, evaluators
│   │   ├── routes/                  ← UI
│   │   └── components/
│   └── tests/
└── dealer/                          ← reference dealer (Node service)
    ├── package.json
    └── src/
```

The current state of the repo is *pre-implementation*: a SvelteKit
scaffold with reusable settlement plumbing (signer / NWC / relay
modules) from an earlier round of work, but no online-poker code yet.
After feedback we'll start on the harness UI and the reference dealer
in parallel.

## Status checklist

- [x] Brainstorm and architectural design
- [x] Protocol draft (NIP-101p)
- [x] DESIGN.md (this doc)
- [ ] **Feedback round with developer friends** ← we are here
- [ ] Reference dealer implementation
- [ ] Player harness implementation
- [ ] Testnet end-to-end test
- [ ] Public alpha
