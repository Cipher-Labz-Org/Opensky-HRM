/** Scroll a feedback banner into view after save/update/delete actions. */
export function scrollAlertIntoView(el: HTMLElement | null | undefined) {
  if (!el) return;
  window.requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
