export type ViewerViewport = {
  scrollTop: number;
  progress: number;
  activeHeadingId: string | null;
};

type HeadingOffset = { id: string; top: number };

export class ViewportTracker {
  private headings: HeadingOffset[] = [];
  private frame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private imageCleanup: Array<() => void> = [];

  constructor(
    private readonly scrollHost: HTMLElement,
    private readonly content: HTMLElement,
    private readonly onChange: (viewport: ViewerViewport) => void,
  ) {}

  start() {
    this.rebuildHeadingOffsets();
    this.schedule();
    this.scrollHost.addEventListener("scroll", this.schedule, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      this.resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          this.rebuildHeadingOffsets();
          this.schedule();
        }, 90);
      });
      this.resizeObserver.observe(this.content);
    }

    this.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      const refresh = () => {
        this.rebuildHeadingOffsets();
        this.schedule();
      };
      image.addEventListener("load", refresh);
      image.addEventListener("error", refresh);
      this.imageCleanup.push(() => {
        image.removeEventListener("load", refresh);
        image.removeEventListener("error", refresh);
      });
    });
  }

  stop() {
    this.scrollHost.removeEventListener("scroll", this.schedule);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.imageCleanup.forEach((cleanup) => cleanup());
    this.imageCleanup = [];
  }

  refresh() {
    this.rebuildHeadingOffsets();
    this.schedule();
  }

  private readonly schedule = () => {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.emit();
    });
  };

  private rebuildHeadingOffsets() {
    const hostTop = this.scrollHost.getBoundingClientRect().top;
    const scrollTop = this.scrollHost.scrollTop;
    this.headings = [...this.content.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")]
      .map((heading) => ({
        id: heading.id,
        top: heading.getBoundingClientRect().top - hostTop + scrollTop,
      }))
      .sort((left, right) => left.top - right.top);
  }

  private emit() {
    const scrollTop = this.scrollHost.scrollTop;
    const scrollable = Math.max(0, this.scrollHost.scrollHeight - this.scrollHost.clientHeight);
    const progress = scrollable <= 1 ? 1 : Math.min(1, Math.max(0, scrollTop / scrollable));
    const marker = scrollTop + 40;

    let activeHeadingId: string | null = this.headings[0]?.id ?? null;
    let left = 0;
    let right = this.headings.length - 1;
    while (left <= right) {
      const middle = (left + right) >> 1;
      if (this.headings[middle].top <= marker) {
        activeHeadingId = this.headings[middle].id;
        left = middle + 1;
      } else {
        right = middle - 1;
      }
    }

    this.onChange({ scrollTop, progress, activeHeadingId });
  }
}
