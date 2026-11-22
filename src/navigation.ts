import type { MouseEvent } from "react";

export const practiceUrl = (id: string) =>
  `/practice/${encodeURIComponent(id)}`;

export function navigateTo(href: string) {
  const url = new URL(href, location.origin);
  const destination = url.pathname + url.search + url.hash;
  if (destination === location.pathname + location.search + location.hash)
    return;
  history.pushState(null, "", destination);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

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
  navigateTo(event.currentTarget.href);
}
