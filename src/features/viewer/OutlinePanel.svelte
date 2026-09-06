<script lang="ts">
  import { sidePanelMotion } from "../../lib/motion";
  import { afterUpdate } from "svelte";
  import type { OutlineItem } from "../../lib/contracts";
  import Icon from "../../components/ui/Icon.svelte";

  export let items: OutlineItem[] = [];
  export let documentId = "";
  export let activeId: string | null = null;
  export let onJump: (id: string) => void;
  export let embedded = false;

  let aside: HTMLElement;
  let lastActiveKey = "";

  afterUpdate(() => {
    if (!aside || !activeId) return;
    const activeKey = `${documentId}:${activeId}`;
    if (activeKey === lastActiveKey) return;
    lastActiveKey = activeKey;
    const target = aside.querySelector<HTMLElement>("[data-outline-active='true']");
    target?.scrollIntoView({ block: "nearest" });
  });
</script>

<aside bind:this={aside} class:embedded class="app-outline" transition:sidePanelMotion={{ side: "left" }}>
  <div class="outline-header">
    <span class="outline-header-icon"><Icon name="outline" size={14} /></span>
    <span>文档大纲</span>
    {#if items.length > 0}<span class="outline-count">{items.length}</span>{/if}
  </div>
  {#if items.length === 0}
    <div class="outline-empty">当前文档没有标题</div>
  {:else}
    <nav class="outline-nav">
      {#each items as item}
        <button
          class:outline-active={item.id === activeId}
          class="outline-item"
          style={`--outline-indent:${Math.max(0, item.level - 1) * 12}px`}
          data-outline-active={item.id === activeId ? "true" : undefined}
          title={item.title}
          on:click={() => onJump(item.id)}
        >
          <span class="outline-item-marker"></span>
          <span class="truncate">{item.title}</span>
        </button>
      {/each}
    </nav>
  {/if}
</aside>
