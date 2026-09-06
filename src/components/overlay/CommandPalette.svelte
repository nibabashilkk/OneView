<script lang="ts">
  import { tick } from "svelte";
  import { commandMatchesQuery, type AppCommand } from "../../commands/app-commands";
  import { backdropMotion, paletteMotion } from "../../lib/motion";

  export let open = false;
  export let commands: AppCommand[] = [];
  export let onClose: () => void;

  let input: HTMLInputElement;
  let query = "";
  let selected = 0;
  let lastOpen = false;

  $: results = commands
    .map((command) => ({ command, score: commandMatchesQuery(command, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
    .map((item) => item.command);

  $: if (open && !lastOpen) {
    lastOpen = true;
    query = "";
    selected = 0;
    void tick().then(() => input?.focus());
  } else if (!open && lastOpen) {
    lastOpen = false;
  }

  $: if (selected >= results.length) selected = Math.max(0, results.length - 1);

  async function run(command: AppCommand) {
    if (command.enabled === false) return;
    onClose();
    await command.run();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selected = results.length === 0 ? 0 : (selected + 1) % results.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selected = results.length === 0 ? 0 : (selected - 1 + results.length) % results.length;
      return;
    }
    if (event.key === "Enter" && results[selected]) {
      event.preventDefault();
      void run(results[selected]);
    }
  }

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function formatShortcut(value: string) {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    if (!isMac) return value.replace("Mod", "Ctrl");
    return value.replace("Mod", "⌘").replace("Ctrl", "⌃").replace("Shift", "⇧").replace("Alt", "⌥").replaceAll("+", "");
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[80] flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[1px] dark:bg-black/45" role="presentation" on:click={closeOnBackdrop} transition:backdropMotion>
    <section class="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50" role="dialog" aria-label="命令面板" transition:paletteMotion>
      <div class="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span class="text-zinc-400">⌘</span>
        <input bind:this={input} bind:value={query} class="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400" placeholder="输入命令，例如：复制、导出、设置…" on:keydown={handleKeydown} />
        <kbd class="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">Esc</kbd>
      </div>
      <div class="max-h-[420px] overflow-y-auto p-1.5">
        {#if results.length === 0}
          <div class="px-4 py-10 text-center text-xs text-zinc-400">没有匹配的命令</div>
        {:else}
          {#each results as command, index (command.id)}
            <button
              class:command-result-active={index === selected}
              class="command-result"
              disabled={command.enabled === false}
              on:mouseenter={() => selected = index}
              on:click={() => void run(command)}
            >
              <span class="min-w-0 flex-1 text-left">
                <span class="block truncate text-xs font-medium">{command.title}</span>
                {#if command.subtitle}<span class="mt-0.5 block truncate text-[10px] text-zinc-400">{command.subtitle}</span>{/if}
              </span>
              <span class="shrink-0 text-[10px] text-zinc-400">{command.group}</span>
              {#if command.shortcut}<kbd class="command-kbd">{formatShortcut(command.shortcut)}</kbd>{/if}
            </button>
          {/each}
        {/if}
      </div>
    </section>
  </div>
{/if}
