"use strict";
/*
 * Bani Vyatki Analytics — responsive navigation (iteration 02).
 *
 * Accessible progressive enhancement:
 * - no JavaScript: all navigation links remain visible on mobile;
 * - mobile (<=720px): toggle a non-modal, in-flow navigation panel;
 * - Escape closes the panel and returns focus to its button;
 * - click outside / navigation click closes the panel;
 * - breakpoint changes reset open state;
 * - desktop and tablet navigation never depend on this script.
 */
(() => {
  const sidebar = document.querySelector(".sidebar");
  const toggle = sidebar?.querySelector(".bv-menu-toggle");
  const nav = document.getElementById("bv-primary-nav");

  if (!sidebar || !toggle || !nav || !window.matchMedia) return;

  const mobile = window.matchMedia("(max-width: 720px)");
  const label = toggle.querySelector(".bv-menu-toggle-text");
  let open = false;

  const render = () => {
    const expanded = mobile.matches && open;
    sidebar.classList.toggle("bv-nav-open", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? "Закрыть меню разделов" : "Открыть меню разделов");
    if (label) label.textContent = expanded ? "Закрыть" : "Меню";
  };

  const close = (restoreFocus = false) => {
    if (!open) return;
    open = false;
    render();
    if (restoreFocus && mobile.matches) toggle.focus();
  };

  toggle.addEventListener("click", () => {
    open = !open;
    render();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && mobile.matches && open) {
      close(true);
    }
  });

  // This is an in-flow disclosure rather than a modal: no focus trap or
  // body scroll-lock is appropriate; ordinary outside interaction can close it.
  document.addEventListener("pointerdown", event => {
    if (mobile.matches && open && !sidebar.contains(event.target)) close();
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a[href]")) close();
  });

  const onBreakpointChange = () => {
    open = false;
    render();
  };
  if (typeof mobile.addEventListener === "function") {
    mobile.addEventListener("change", onBreakpointChange);
  } else if (typeof mobile.addListener === "function") {
    mobile.addListener(onBreakpointChange);
  }

  // Add the CSS enhancement flag only after all handlers are registered.
  // When JS is unavailable, the mobile menu stays expanded and navigable.
  document.documentElement.classList.add("bv-nav-ready");
  render();
})();
