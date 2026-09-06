<script lang="ts">
  import { onMount } from "svelte";
  import { search } from "../../stores/search";
  import { popoverMotion } from "../../lib/motion";

  let input: HTMLInputElement;

  onMount(() => {
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      search.close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) search.previous();
      else search.next();
    }
  }
</script>

<div class="app-searchbar absolute right-4 top-3 z-30 flex h-10 items-center gap-1 rounded-xl border border-zinc-200 bg-white/95 p-1 shadow-lg shadow-zinc-950/10 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-black/30" transition:popoverMotion>
  <input
    bind:this={input}
    class="h-8 w-56 rounded-lg bg-transparent px-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
    placeholder="在文档中查找"
    value={$search.query}
    on:input={(event) => search.setQuery(event.currentTarget.value)}
    on:keydown={handleKeydown}
  />

  <span class="min-w-14 px-1 text-center text-[11px] tabular-nums text-zinc-400">
    {#if $search.query}
      {$search.total === 0 ? "0 / 0" : `${$search.current + 1} / ${$search.total}`}
    {/if}
  </span>

  <button
    class:search-option-active={$search.caseSensitive}
    class="search-option-btn"
    title="区分大小写"
    on:click={search.toggleCaseSensitive}
  >Aa</button>
  <button
    class:search-option-active={$search.wholeWord}
    class="search-option-btn"
    title="全词匹配"
    on:click={search.toggleWholeWord}
  >W</button>
  <div class="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700"></div>
  <button class="search-nav-btn" title="上一个（Shift+Enter）" on:click={search.previous}>↑</button>
  <button class="search-nav-btn" title="下一个（Enter）" on:click={search.next}>↓</button>
  <button class="search-nav-btn" title="关闭" on:click={search.close}>×</button>
</div>
