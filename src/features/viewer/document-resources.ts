import type { ResourceRequest, ResourceResolution } from "../../lib/contracts";
import { isTauri } from "../../lib/runtime";
import { localAssetUrl, resolveDocumentResources } from "../../services/resource-service";

export async function enhanceDocumentResources(
  container: HTMLElement,
  documentPath: string,
): Promise<void> {
  prepareImages(container);
  if (!isTauri()) return;

  const requests = collectRequests(container);
  if (requests.length === 0) return;

  const resolutions = await resolveDocumentResources(documentPath, requests);
  const index = new Map<string, ResourceResolution>();
  for (const resolution of resolutions) {
    index.set(resourceKey(resolution.kind, resolution.raw), resolution);
  }

  container.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    const raw = image.getAttribute("src") ?? "";
    const resolution = index.get(resourceKey("image", raw));
    if (!resolution) return;

    if (resolution.exists) {
      image.src = localAssetUrl(resolution.path);
      image.dataset.localPath = resolution.path;
      image.classList.remove("local-image-missing");
    } else {
      image.classList.remove("image-loading");
      image.classList.add("local-image-missing", "image-error");
      image.title = `找不到本地图片：${resolution.path}`;
    }
  });

  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const raw = anchor.getAttribute("href") ?? "";
    const resolution = index.get(resourceKey("link", raw));
    if (!resolution) return;

    anchor.dataset.localPath = resolution.path;
    anchor.dataset.localExists = String(resolution.exists);
    anchor.dataset.localMarkdown = String(resolution.markdown);
    if (resolution.fragment) anchor.dataset.localFragment = resolution.fragment;
    if (!resolution.exists) anchor.classList.add("local-link-missing");
  });
}

function prepareImages(container: HTMLElement) {
  container.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";

    const settle = (state: "loaded" | "error") => {
      image.classList.remove("image-loading", "image-loaded", "image-error");
      image.classList.add(state === "loaded" ? "image-loaded" : "image-error");
    };

    image.addEventListener("load", () => settle("loaded"), { once: true });
    image.addEventListener("error", () => settle("error"), { once: true });

    if (image.complete) {
      settle(image.naturalWidth > 0 ? "loaded" : "error");
      return;
    }

    image.classList.add("image-loading");
  });
}

function collectRequests(container: HTMLElement): ResourceRequest[] {
  const requests: ResourceRequest[] = [];
  const seen = new Set<string>();

  container.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    push(image.getAttribute("src"), "image");
  });
  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    push(anchor.getAttribute("href"), "link");
  });

  return requests;

  function push(raw: string | null, kind: ResourceRequest["kind"]) {
    const value = raw?.trim() ?? "";
    if (!value || value.startsWith("#") || isVirtualOrRemote(value)) return;
    const key = resourceKey(kind, value);
    if (seen.has(key)) return;
    seen.add(key);
    requests.push({ raw: value, kind });
  }
}

function resourceKey(kind: string, raw: string) {
  return `${kind}\u0000${raw}`;
}

function isVirtualOrRemote(raw: string) {
  const value = raw.toLowerCase();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("asset:") ||
    value.startsWith("javascript:") ||
    raw.startsWith("//")
  );
}
