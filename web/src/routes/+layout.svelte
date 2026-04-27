<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<main class="min-h-screen p-4 max-w-2xl mx-auto">
  {@render children()}
</main>
