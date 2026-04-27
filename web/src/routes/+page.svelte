<script lang="ts">
  // Pre-implementation placeholder. The harness UI will live here.
  // For now, point reviewers at the docs.
</script>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="text-3xl font-semibold">nostr-poker</h1>
    <p class="text-muted">
      Non-custodial online poker on Nostr with Lightning settlement
      and a marketplace of replaceable dealers.
    </p>
  </header>

  <div class="rounded-lg border border-border bg-card p-4 space-y-3">
    <p class="text-sm">
      <strong>Status:</strong> pre-implementation. We're sharing the
      design for feedback before writing the production code.
    </p>
    <ul class="text-sm space-y-1 list-disc pl-4 text-muted">
      <li>
        <a class="text-accent underline" href="https://github.com/danielwyler/nostr-poker/blob/main/README.md">
          README
        </a>
        — overview, architecture, what we want feedback on
      </li>
      <li>
        <a class="text-accent underline" href="https://github.com/danielwyler/nostr-poker/blob/main/docs/DESIGN.md">
          DESIGN.md
        </a>
        — architectural rationale, tradeoffs, open questions
      </li>
      <li>
        <a class="text-accent underline" href="https://github.com/danielwyler/nostr-poker/blob/main/docs/nip-101p-draft.md">
          NIP-101p draft
        </a>
        — protocol spec, event kinds, hand-flow state machine
      </li>
      <li>
        <a class="text-accent underline" href="https://github.com/danielwyler/nostr-poker/blob/main/CONTRIBUTING.md">
          CONTRIBUTING
        </a>
        — how to give feedback
      </li>
    </ul>
  </div>

  <p class="text-xs text-muted">
    The current SvelteKit scaffold under <code>web/</code> contains
    only reusable settlement plumbing (signer / NWC / relay
    abstractions) salvaged from earlier prototype work. The actual
    online-poker harness UI is not yet built.
  </p>
</section>
