# NIP-101p: Online Poker Events — Draft

**Status:** Working draft, not yet submitted to nostr-protocol/nips
**Last updated:** 2026-04-27

This NIP defines event kinds for non-custodial online poker on Nostr.
Cards are dealt by a third-party "dealer" service that any operator
can run; settlement is peer-to-peer between players via NIP-57 zaps and
NIP-47 NWC. Players choose a dealer per game from a marketplace; the
dealer is replaceable and the protocol is the contract.

## Scope

**In scope (v1):**
- Cash-game online poker (No-Limit Hold'em initially; extensible to PLO,
  variants of NLHE)
- A dealer service that shuffles, deals encrypted hole cards, manages
  action ordering and timing, reveals community cards, and reveals the
  shuffle seed for audit at hand end
- Per-hand peer-to-peer Lightning settlement via NIP-57 zaps
- Public events (no privacy via gift-wrapping in v1)
- Single main pot per hand (side pots / all-in resolution out of v1)

**Out of scope (v1, may be future revisions):**
- Tournaments (escrowed prize pools)
- Side pots / multi-way all-ins
- Encrypted/private games (NIP-44 gift-wrapped events)
- Multi-table tournaments
- Player chat (use existing Nostr clients)

## Roles

| Role | Run by | Trust assumption |
|------|--------|------------------|
| **Player** | The user, in a NIP-101p-compliant client (the "harness") | Self-custody; signs own events; controls own wallet |
| **Dealer** | A third-party operator, registered via a dealer profile event | Floor: bound by commit-reveal. Can offer higher tiers (TEE / FROSTR / bonded) for more trust |
| **Relay** | Standard Nostr relays | Storage and ordering only; no enforcement |

Players verify every dealer event independently. The dealer has *no*
authority over economic outcomes — winners and pot splits are
deterministic functions of public events that every client computes.

## Event Kinds

| Kind | Name | Type | Description |
|------|------|------|-------------|
| `33650` | Dealer Profile | Addressable | Dealer's advertisement: capabilities, fees, trust claims, lud16 |
| `1650` | Table Open | Regular | Dealer announces a table is open for sit-down |
| `1651` | Sit Down | Regular | Player joins a table |
| `1652` | Hand Begin | Regular | Dealer commits to shuffle hash, declares button + blinds |
| `1653` | Hole Cards | Regular | Dealer publishes encrypted hole cards (one event per recipient) |
| `1654` | Action Request | Regular | Dealer announces whose turn + valid actions + timer |
| `1655` | Player Action | Regular | Player submits bet / call / raise / fold |
| `1656` | Community Cards | Regular | Dealer reveals flop / turn / river |
| `1657` | Showdown | Regular | Dealer reveals shown hole cards (or marks them mucked) |
| `1658` | Hand End | Regular | Dealer reveals shuffle seed for audit |
| `1659` | Dispute | Regular | Any client publishes proof of dealer misbehavior |

Kind 1660 is reserved for future "stand up" / "table close" events.

---

## 33650 — Dealer Profile

An addressable event ([NIP-33](33.md)) advertising a dealer service.
Identified by `kind + pubkey + d`.

### Content

Free-text description of the dealer service.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `d` | Yes | `<slug>` | Stable handle, e.g. `daniels-reference-dealer` |
| `name` | Yes | `<text>` | Human-readable dealer name |
| `lud16` | Yes | `<lud16>` | Lightning address for receiving optional fees |
| `caps` | Yes | `deal`, `bet`, `showdown`, ... | Capabilities. v1 dealers MUST claim all three. Reserved namespace for future role-splitting. |
| `variants` | Yes | `nlhe`, `plo`, ... | Supported game variants |
| `trust` | Yes | `commit-reveal` (and optionally `tee:<vendor>`, `frostr:<t-of-n>`, `bonded:<sats>`) | Trust tier claims. `commit-reveal` is the floor and MUST appear |
| `fee` | No | `<sats>` | Fee per hand collected as a zap to `lud16`. `0` if free |
| `attestation` | No | `<naddr or http url>` | Pointer to TEE attestation if claimed |
| `source` | No | `<url>` | Public source code URL for transparency claims |
| `relay` | No | `<wss://...>` | Preferred relay(s) for this dealer's events |
| `t` | No | `poker` | Hashtag |

### Example

```jsonc
{
  "kind": 33650,
  "content": "Open-source reference dealer. Single-operator, commit-reveal floor only. No bond. Test relay only — do not use with real stakes.",
  "tags": [
    ["d", "ref-dealer-001"],
    ["name", "Reference Dealer (Daniel)"],
    ["lud16", "dealer@nostrpoker.example"],
    ["caps", "deal", "bet", "showdown"],
    ["variants", "nlhe"],
    ["trust", "commit-reveal"],
    ["fee", "0"],
    ["source", "https://github.com/<user>/nostr-poker/tree/main/dealer"],
    ["relay", "wss://relay.nostrpoker.example"],
    ["t", "poker"]
  ]
}
```

---

## 1650 — Table Open

A dealer announces a table is open for sit-down. The table is
identified by this event's id; subsequent hand events `e`-tag this id.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `a` | Yes | `33650:<dealer-pubkey>:<dealer-d>` | Reference to dealer profile |
| `variant` | Yes | `nlhe` (etc) | Game variant |
| `blinds` | Yes | `<sb-sats>`, `<bb-sats>` | Small / big blind |
| `min_buyin` | Yes | `<sats>` | |
| `max_buyin` | Yes | `<sats>` | |
| `max_seats` | Yes | `<n>` | 2–9 |
| `action_timer` | Yes | `<seconds>` | Action timer per turn |
| `t` | No | `poker` | |

The dealer typically replaces the table-open event with an updated one
when seats fill (acknowledging sit-downs). To allow this in a regular
event we use a fresh kind 1650 referencing the original table-open via
`e`-tag, or the dealer may use kind 31650 (parameterized replaceable)
for table state — TBD; this is one of the open spec questions.

---

## 1651 — Sit Down

A player declares intent to take a seat at a table.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<table-open-event-id>` | Reference to the table |
| `seat` | No | `<n>` | Requested seat number; dealer assigns if absent |
| `buyin` | Yes | `<sats>` | Initial chip stack |
| `lud16` | Yes | `<lud16>` | Where this player receives settlement |
| `nwc_budget` | Yes | `<sats>` | NWC budget the player has authorized for this session (must be ≥ buyin) |

The dealer acknowledges by including this player in the next Hand
Begin's seat list. If the dealer rejects (table full, mismatched
buy-in), it publishes a Dispute or simply ignores; player times out.

---

## 1652 — Hand Begin

Published by the dealer at the start of each hand. Carries the deck
shuffle commitment.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<table-open-event-id>` | Table reference |
| `hand` | Yes | `<n>` | Sequential hand number, starting at 1 |
| `button` | Yes | `<seat-number>` | Dealer button position |
| `seats` | Yes | `<seat>`, `<pubkey>`, `<stack-sats>` | One tag per active seat (player or sitting-out) |
| `shuffle_commit` | Yes | `<sha256-hex>` | Commitment to the shuffled deck. See *Verification*. |
| `t` | No | `poker` | |

A `seats` tag has format `["seats", "1", "<pubkey>", "5000"]`.

---

## 1653 — Hole Cards

The dealer publishes one Hole Cards event per active player, each
encrypted to that player's pubkey via NIP-44.

### Content

NIP-44-encrypted JSON `{"cards":["Ah","Kd"]}` (cards in standard
shorthand: rank+suit). Decryptable only by the recipient.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<hand-begin-event-id>` | Hand reference |
| `p` | Yes | `<recipient-pubkey>` | The player these cards are for |
| `seat` | Yes | `<n>` | Recipient's seat (so non-recipients can render "seat 3 has cards" without decrypting) |

---

## 1654 — Action Request

The dealer announces whose action it is, the valid actions, the
required-bet, and the timer.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<hand-begin-event-id>` | |
| `street` | Yes | `preflop` \| `flop` \| `turn` \| `river` | |
| `to_act` | Yes | `<pubkey>` | Whose turn it is |
| `to_call` | Yes | `<sats>` | Amount needed to call (0 if option to check) |
| `min_raise` | Yes | `<sats>` | Minimum raise size |
| `pot` | Yes | `<sats>` | Current pot size |
| `expires_at` | Yes | `<unix-ts>` | Action timer expiration |

---

## 1655 — Player Action

A player publishes their action. Signed with the player's pubkey.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<action-request-event-id>` | The request being responded to |
| `action` | Yes | `fold` \| `check` \| `call` \| `bet` \| `raise` \| `allin` | |
| `amount` | If `bet`/`raise`/`call`/`allin` | `<sats>` | Total chips committed for this action |

The action MUST be valid for the request (e.g., `check` only if
`to_call` was 0; `min_raise` enforced for raises). Clients independently
validate the action against the request before accepting it as
authoritative.

If a player's `expires_at` passes without an action, the dealer
publishes a follow-up Action Request marking the player auto-folded
(or auto-checked if checking is free).

---

## 1656 — Community Cards

The dealer reveals community cards at the appropriate beat.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<hand-begin-event-id>` | |
| `street` | Yes | `flop` \| `turn` \| `river` | |
| `cards` | Yes | `<card>`, `<card>`, ... | Cards revealed at this street |

`flop` reveals 3 cards; `turn` and `river` reveal 1 each.

---

## 1657 — Showdown

The dealer reveals each remaining player's hole cards (or notes them
as mucked).

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<hand-begin-event-id>` | |
| `show` | One per remaining player | `<pubkey>`, `<card>`, `<card>` | Player's hole cards revealed |
| `muck` | One per mucked player | `<pubkey>` | Player declined to show |

**Note:** the dealer does *not* declare winners or distribute the pot.
Each client independently:
1. Evaluates each shown player's best 5-card hand (from their 2 hole
   cards + the 5 community cards) using a deterministic hand evaluator
   such as `pokersolver`
2. Determines winner(s) and any chopped pots
3. Computes how much each loser owes each winner from the betting
   history (the chain of 1655 events)
4. If they're a loser: triggers a NWC zap to each winner's `lud16`

This means *the dealer cannot lie about who won.*

---

## 1658 — Hand End

The dealer reveals the shuffle seed and full deck order for audit.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<hand-begin-event-id>` | |
| `shuffle_reveal` | Yes | `<seed-hex>` | The seed used for the shuffle |
| `deck_order` | Yes | `<card>`, `<card>`, ... × 52 | Resulting deck permutation |

Any client recomputes `sha256(seed || canonical(seats) || hand_n)` and
verifies it equals the `shuffle_commit` from kind 1652. The exact
canonicalization is part of the spec (TBD final form, but pinned
before production).

The deck order also lets clients verify each revealed card matches
its position: hole-cards-for-seat-1 are positions 1+2, seat-2 are 3+4,
etc., with community cards drawn from later positions per a fixed deal
order.

---

## 1659 — Dispute

Any client publishes a proof that the dealer misbehaved.

### Tags

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `<offending-event-id>` | The dealer event being disputed |
| `E` | Yes | `<table-open-event-id>` | Table reference |
| `kind` | Yes | `commit_mismatch` \| `bad_action_order` \| `wrong_card_revealed` \| `other` | Reason class |
| `evidence` | If applicable | `<text or pointer>` | Computed values demonstrating the violation |

Disputes are immutable signed evidence. They cause client harnesses
(by convention) to refuse further play with the dealer for the
remainder of the table, and to surface the dealer's misbehavior to
the user. NIP-32 labels and NIP-58 badge ecosystems can downgrade
the dealer's reputation based on dispute history.

---

## Verification

A complete external audit of one hand requires only public Nostr events:

1. Fetch the kind 1652 (Hand Begin) — note `shuffle_commit`
2. Fetch the kind 1658 (Hand End) — note `shuffle_reveal` and `deck_order`
3. Recompute `sha256(canonical(seed, seats, hand_n))` and confirm it
   equals the commit
4. Fetch all kind 1653 (Hole Cards) — non-recipients can verify the
   ciphertext but not the contents (until showdown)
5. Fetch all kind 1656 (Community Cards) and verify they match the
   appropriate positions in `deck_order`
6. Fetch kind 1657 (Showdown) — verify shown hole cards match their
   positions in `deck_order`
7. Fetch all kind 1655 (Player Action) — verify each was a valid
   response to the prior 1654 (Action Request)
8. Use a deterministic hand evaluator on the shown hole cards + the
   community cards to determine the winner(s)
9. Replay the betting history to compute pot distribution
10. Cross-check kind 9735 zap receipts to confirm settlement happened

If any check fails, kind 1659 dispute is the audit artifact.

## Reputation primitives

This NIP does not define reputation events. Existing NIPs are reused:

- **NIP-58 (Badges)** — a reviewer (e.g. an audit firm) issues a
  "Audited" badge to a dealer's pubkey. The harness can filter dealers
  by badges from issuers the user trusts.
- **NIP-32 (Labels)** — clients label dealer pubkeys with positive
  ("trusted") or negative ("fraud", "ran-off") observations.
- **NIP-02 (Follow lists)** — users may bias dealer choice toward
  dealers that are followed by people they follow.

A dispute (kind 1659) is *evidence* a labeling system can use, but
this NIP does not mandate any specific reputation aggregator.

## Trust tiers (above the floor)

The protocol's floor is commit-reveal. **v1-conformant dealers MUST
claim `commit-reveal` in their `trust` tag.** All other tier values
listed below are *reserved namespace* in the protocol — they describe
guarantees a dealer might offer in future versions of this NIP, but
v1 does not require any client or dealer to implement them.

Reserved tier values:

- `tee:nitro` — running inside an AWS Nitro Enclave; `attestation` tag
  points at a published attestation document the harness verifies
- `tee:sgx` — Intel SGX/TDX; same shape
- `frostr:t-of-n` — a FROSTR threshold signing group of `n` *independent*
  signers, `t` required to deal; signing group's attestation in the
  `attestation` tag. The threshold guarantee only holds if the N
  signers are operated by N distinct parties — a single operator
  running all N signers holds all the key shares and the trust claim
  collapses.
- `bonded:<sats>` — Lightning bond posted to a public escrow contract
  (a HOLD invoice or similar) that can be slashed via published proof
  of misbehavior
- `source:reproducible` — published source matches a binary hash via
  reproducible build; the `source` tag points at the build attestation

Higher tiers don't change the protocol — they change which dealer a
table can choose. The harness shows dealer claims and lets players
filter.

## Hand-flow state machine (informational)

```
       ┌──────────┐
       │ TableOpen│ ← 1650
       └────┬─────┘
            │ players publish 1651 (Sit Down)
            ▼
       ┌──────────┐
       │ HandBegin│ ← 1652  (shuffle_commit)
       └────┬─────┘
            │ dealer publishes 1653 (Hole Cards) per player
            ▼
       ┌──────────────────────┐
       │   PreflopAction      │
       │   (1654 ↔ 1655 loop) │
       └────┬─────────────────┘
            │ dealer publishes 1656 (Community Cards: flop)
            ▼
       ┌──────────────┐         …turn… …river…
       │  FlopAction  │
       └────┬─────────┘
            │ if all players folded except one, jump to End
            │ otherwise progress through Turn → River
            ▼
       ┌──────────┐
       │ Showdown │ ← 1657
       └────┬─────┘
            │ clients evaluate hands, settle via NWC zaps
            ▼
       ┌──────────┐
       │ HandEnd  │ ← 1658  (shuffle_reveal)
       └──────────┘
            │
            ▼ next hand begins (Hand Begin with hand=n+1)
```

## Settlement

Settlement is *not* a NIP-101p event kind. It uses existing primitives:

1. Each loser's client computes their owed amount from the hand state
   (showdown + betting history)
2. Loser's client builds a NIP-57 zap request to the winner's `lud16`
   for the owed amount, signs it
3. Loser's client uses NIP-47 NWC `pay_invoice` (with the BOLT-11
   from the lud16 callback) to actually send the payment
4. Winner's lud16 service publishes the kind 9735 zap receipt
5. All clients see the zap receipt and mark the debt as settled

Optional dealer fees: each loser additionally zaps the dealer's
`lud16` for their share of the per-hand fee from the dealer profile.
This is opt-in by virtue of having chosen that dealer.

## References

- [NIP-01: Basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-19: bech32-encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-32: Labeling](https://github.com/nostr-protocol/nips/blob/master/32.md)
- [NIP-33: Addressable events](https://github.com/nostr-protocol/nips/blob/master/33.md)
- [NIP-44: Versioned encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-46: Nostr Connect](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [NIP-47: Wallet Connect](https://github.com/nostr-protocol/nips/blob/master/47.md)
- [NIP-57: Lightning Zaps](https://github.com/nostr-protocol/nips/blob/master/57.md)
- [NIP-58: Badges](https://github.com/nostr-protocol/nips/blob/master/58.md)
- `pokersolver` — https://www.npmjs.com/package/pokersolver
- `bitcoin-connect` — https://github.com/getAlby/bitcoin-connect

## Open questions for the spec (review-block)

These are explicit unresolved details we want feedback on:

1. **Replaceable vs regular `Table Open`**: kind 1650 as a regular
   event with replacement-via-new-event, or kind 31650 as parameterized
   replaceable? Replaceable is cleaner but loses the immutable history.
2. **Shuffle canonicalization**: exact format for the input to the
   commit hash. We need a deterministic, language-agnostic
   canonicalization that all dealers and clients agree on.
3. **Action ordering tiebreaker**: when 1654 and 1655 events arrive
   in different orders at different relays, what's the canonical
   ordering? `created_at` then event id?
4. **Disconnect handling**: timer expiration auto-folds. Is there a
   "sit out" intermediate state? How is reconnect handled?
5. **Dealer downtime**: a dealer crashes mid-hand. Hand voids? Players'
   committed bets refunded? Or the table closes and reopens with a new
   `Hand Begin`?
6. **Side pots**: for v1.1. Sketch: extend `Showdown` to carry
   per-pot eligible players + amounts; clients compute side-pot
   distribution.
7. **Mental poker tier**: as a future "trustless dealer" trust claim,
   is the protocol shape compatible with multi-party shuffling, or
   does it need new event kinds?
8. **Fees** — best mechanism: per-hand zap to dealer (current
   proposal), or a stake-and-rake escrow (more like classical poker
   sites)?
