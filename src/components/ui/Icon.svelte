<script lang="ts">
  export let name:
    | "sidebar"
    | "search"
    | "command"
    | "reveal"
    | "folder"
    | "file"
    | "settings"
    | "plugin"
    | "theme"
    | "save"
    | "export"
    | "recent"
    | "chevron"
    | "close"
    | "document"
    | "outline"
    | "refresh"
    | "more"
    | "plus"
    | "code" = "file";
  export let size = 16;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === "sidebar"}
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8.25 7v10" stroke-width="2.1" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  {:else if name === "command"}
    <path d="M9 6.5A2.5 2.5 0 1 0 6.5 9H17.5A2.5 2.5 0 1 0 15 6.5V17.5A2.5 2.5 0 1 0 17.5 15H6.5A2.5 2.5 0 1 0 9 17.5Z" />
  {:else if name === "reveal"}
    <path d="M4 7.5h5l1.7 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <path d="M4 7.5V6a2 2 0 0 1 2-2h3l1.5 2H14" />
    <path d="m13 13 2-2 2 2" />
    <path d="M15 11v5" />
  {:else if name === "folder"}
    <path d="M3.5 7.5h6l2-2h8a1.5 1.5 0 0 1 1.5 1.5v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1.5 1.5 0 0 1 .5-1.5Z" />
  {:else if name === "file" || name === "document"}
    <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4" />
    {#if name === "document"}<path d="M9 12h6M9 15.5h6" />{/if}
  {:else if name === "settings"}
    <circle cx="12" cy="12" r="3" />
    <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7L10.5 2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7L0 10.5v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7Z" transform="translate(2.25 0) scale(.81)" />
  {:else if name === "plugin"}
    <path d="M8.2 4.5h3.1a2.1 2.1 0 1 1 3.4 0h2.8a2 2 0 0 1 2 2v2.8a2.1 2.1 0 1 0 0 3.4v2.8a2 2 0 0 1-2 2h-3a2.1 2.1 0 1 1-3.4 0H8.2a2 2 0 0 1-2-2v-2.8a2.1 2.1 0 1 1 0-3.4V6.5a2 2 0 0 1 2-2Z" />
  {:else if name === "theme"}
    <path d="M20 15.2A8 8 0 0 1 8.8 4 8.1 8.1 0 1 0 20 15.2Z" />
  {:else if name === "save"}
    <path d="M5 4h12l2 2v14H5Z" />
    <path d="M8 4v5h8V4M8 20v-7h8v7" />
  {:else if name === "export"}
    <path d="M12 3v12" />
    <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
    <path d="M5 13.5V20h14v-6.5" />
  {:else if name === "recent"}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  {:else if name === "chevron"}
    <path d="m8 10 4 4 4-4" />
  {:else if name === "close"}
    <path d="m7 7 10 10M17 7 7 17" />
  {:else if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "outline"}
    <path d="M8 6h12M8 12h9M8 18h6" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  {:else if name === "refresh"}
    <path d="M20 7v5h-5" />
    <path d="M18.2 17a8 8 0 1 1 1.4-8" />
  {:else if name === "code"}
    <path d="m8.5 8-4 4 4 4" />
    <path d="m15.5 8 4 4-4 4" />
    <path d="m13.5 5-3 14" />
  {:else if name === "more"}
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  {/if}
</svg>
