<script lang="ts">
  import { toastMotion } from "../../lib/motion";
  import { notice } from "../../stores/notice";
</script>

{#if $notice}
  <div class="pointer-events-none fixed inset-x-0 bottom-11 z-[90] flex justify-center px-4" aria-live="polite">
    <div class="rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs font-medium text-zinc-700 shadow-xl shadow-zinc-950/10 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:shadow-black/30" transition:toastMotion>
      {$notice.message}
    </div>
  </div>
{/if}
