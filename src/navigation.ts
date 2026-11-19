import type { MouseEvent } from "react";

export const practiceUrl = (id: string) =>
  `/practice/${encodeURIComponent(id)}`;

// Keep real link behavior for new tabs, copied URLs, and modified clicks.
export function followLink(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  const url = new URL(event.currentTarget.href);
  const destination = url.pathname + url.search + url.hash;
  if (destination === location.pathname + location.search + location.hash)
    return;
  history.pushState(null, "", destination);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
