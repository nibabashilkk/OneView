<script lang="ts">
  import { popoverMotion } from "../../lib/motion";
  import type { ContextMenuItem } from "../../lib/contracts";

  export let open = false;
  export let x = 0;
  export let y = 0;
  export let items: ContextMenuItem[] = [];
  export let onClose: () => void;

  $: left = Math.min(Math.max(8, x), Math.max(8, windowWidth() - 244));
  $: top = Math.min(Math.max(8, y), Math.max(8, windowHeight() - Math.min(420, items.length * 38 + 16)));

  async function run(item: ContextMenuItem) {
    if (item.disabled) return;
    onClose();
    await item.run();
  }

  function windowWidth() { return typeof window === "undefined" ? 1024 : window.innerWidth; }
  function windowHeight() { return typeof window === "undefined" ? 768 : window.innerHeight; }
</script>

{#if open}
  <div class="fixed inset-0 z-[85]" role="presentation" on:mousedown={onClose} on:wheel={onClose} on:contextmenu={(event) => { event.preventDefault(); onClose(); }}>
    <div class="context-menu fixed w-60 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl shadow-zinc-950/15 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40" style={`left:${left}px;top:${top}px`} on:mousedown={(event) => event.stopPropagation()} transition:popoverMotion>
      {#each items as item (item.id)}
        {#if item.separatorBefore}<div class="my-1 border-t border-zinc-100 dark:border-zinc-800"></div>{/if}
        <button class="context-menu-item" disabled={item.disabled} on:click={() => void run(item)}>
          <span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {#if item.hint}<span class="ml-3 shrink-0 text-[10px] text-zinc-400">{item.hint}</span>{/if}
        </button>
      {/each}
    </div>
  </div>
{/if}
