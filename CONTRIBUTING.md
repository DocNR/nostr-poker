# Contributing to nostr-poker

Right now (pre-implementation), the most valuable contributions are
**critique and pointers**, not code. We're sharing the design before
building so we don't waste cycles on the wrong architecture.

## How to give feedback

Pick whichever lane is easiest for you:

### 1. GitHub issues (preferred)

Open an issue with a clear title and your concern, suggestion, or
pointer to prior art. Tag with one of:

- `architecture` — the overall shape of the system
- `protocol` — NIP-101p details (event kinds, tags, flows)
- `trust-model` — commit-reveal, attacks, defenses
- `ux` — player flow, dealer discovery, error handling
- `prior-art` — pointers to existing work we should know about
- `security` — concrete attacks or vulnerabilities
- `nitpick` — typos, wording, naming

### 2. Pull requests on the docs

If you have a concrete proposed change to `docs/DESIGN.md` or
`docs/nip-101p-draft.md`, open a PR. Even partial drafts are welcome —
we'll iterate.

### 3. Direct contact

If you'd rather discuss in private (e.g., responsible disclosure of an
attack, or you're a known protocol designer who'd rather chat first):
- Reach out to Daniel on Nostr: `npub…` *(TBD — fill in)*
- Or email: `danieljwyler@gmail.com`

## What we're most uncertain about

If you only have time for one read-through, the highest-value chunks
to push on are:

1. **`README.md` § "What we want feedback on"** — the explicit list of
   open questions
2. **`docs/DESIGN.md` § "Open questions"** — the longer list of
   architectural and protocol uncertainties
3. **`docs/nip-101p-draft.md` § "Open questions for the spec"** — the
   protocol-level details we haven't pinned down

## What we're not looking for (yet)

- Implementation PRs against the harness or reference dealer — there's
  no implementation to review yet
- Style/lint nitpicks on docs — substance first; we'll pass docs
  through editing later
- Rebrandings or repositioning — the high-level positioning is set;
  it's the architectural details that are still in motion

## Code of conduct

Be useful, be kind, assume good faith. Critique the design, not the
designer. If a feedback exchange escalates, step away and come back
later.

## License

By contributing you agree your contributions will be licensed under
the project's MIT license (see `LICENSE`).
