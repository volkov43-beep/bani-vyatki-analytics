#!/usr/bin/env python3
"""Browser QA for iteration 02 using actual static pages (not mocked DOM).

Requires: python -m pip install playwright==1.56.0
          python -m playwright install chromium
Serves the repository over localhost in the GitHub Actions workflow.
No CRM access, secrets, or external network calls.
"""
from __future__ import annotations

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BV_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
ROUTES = ["index.html", "sources.html", "sales.html", "managers.html", "cycle.html"]
WIDTHS = [320, 360, 390, 768, 1024, 1440, 1920]
SHOTS = Path("artifacts/navigation")
SHOTS.mkdir(parents=True, exist_ok=True)
assertions = 0


def ok(condition: bool, label: str):
    global assertions
    if not condition:
        raise AssertionError(label)
    assertions += 1


def visible(locator) -> bool:
    return locator.is_visible()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    for width in WIDTHS:
        for route in ROUTES:
            page = browser.new_page(viewport={"width": width, "height": 800}, device_scale_factor=1)
            page_errors: list[str] = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            response = page.goto(f"{BASE}/{route}", wait_until="load", timeout=30000)
            ok(response is not None and response.status == 200, f"{width}/{route}: HTTP 200")
            page.locator(".sidebar").wait_for(state="visible")

            nav = page.locator("#bv-primary-nav")
            toggle = page.locator(".bv-menu-toggle")
            page_links = nav.locator("a[href]")
            ok(page_links.count() == 5, f"{width}/{route}: 5 navigation links")
            ok(nav.locator('a[aria-current="page"]').count() == 1,
               f"{width}/{route}: only one active page")
            ok(not page_errors, f"{width}/{route}: JavaScript errors: {page_errors}")

            sidebar_box = page.locator(".sidebar").bounding_box()
            ok(sidebar_box is not None and sidebar_box["x"] >= -1
               and sidebar_box["width"] <= width + 2, f"{width}/{route}: sidebar overflow")

            if width <= 720:
                ok(visible(toggle), f"{width}/{route}: toggle should be visible")
                ok(not visible(nav), f"{width}/{route}: initial menu should be collapsed")
                ok(toggle.get_attribute("aria-expanded") == "false",
                   f"{width}/{route}: initial aria-expanded")

                if route == "index.html" and width in (320, 390):
                    page.screenshot(path=str(SHOTS / f"home-{width}-closed.png"))

                toggle.click()
                ok(visible(nav), f"{width}/{route}: menu opens")
                ok(toggle.get_attribute("aria-expanded") == "true",
                   f"{width}/{route}: aria-expanded=true")
                ok(nav.locator('a[aria-current="page"]').is_visible(),
                   f"{width}/{route}: current page accessible when open")

                if route == "index.html" and width in (320, 390):
                    page.screenshot(path=str(SHOTS / f"home-{width}-open.png"))

                page.keyboard.press("Escape")
                ok(not visible(nav), f"{width}/{route}: Escape closes")
                ok(toggle.get_attribute("aria-expanded") == "false",
                   f"{width}/{route}: Escape resets expanded")
                ok(toggle.evaluate("(el)=>document.activeElement===el"),
                   f"{width}/{route}: Escape restores button focus")

                toggle.click()
                toggle.click()
                ok(not visible(nav), f"{width}/{route}: second click closes menu")

            else:
                ok(not visible(toggle), f"{width}/{route}: mobile button should be hidden")
                ok(visible(nav), f"{width}/{route}: navigation remains visible")
                if width <= 1140:
                    link = nav.locator("a[href='./sources.html']")
                    ok(bool(link.get_attribute("aria-label")),
                       f"{width}/{route}: compact rail label missing")
                    link.focus()
                    content = link.evaluate("(el)=>getComputedStyle(el,'::after').content")
                    ok("Источники обращений" in content,
                       f"{width}/{route}: keyboard tooltip not visible: {content}")
                    ok(link.evaluate("(el)=>getComputedStyle(el).outlineStyle") != "none",
                       f"{width}/{route}: no visible keyboard outline")

                if width in (768, 1440) and route in ("index.html", "managers.html", "cycle.html"):
                    page.screenshot(path=str(SHOTS / f"{route[:-5]}-{width}.png"))

            page.close()

    # No-JS fallback: primary navigation must remain usable on small screens.
    nojs = browser.new_context(viewport={"width": 360, "height": 800}, java_script_enabled=False)
    p = nojs.new_page()
    p.goto(f"{BASE}/sources.html", wait_until="load")
    ok(visible(p.locator("#bv-primary-nav")), "No-JS: nav must remain visible")
    ok(not visible(p.locator(".bv-menu-toggle")), "No-JS: inert button must be hidden")
    ok(p.locator('#bv-primary-nav a[href="./cycle.html"]').is_visible(),
       "No-JS: all working links are reachable")
    nojs.close()

    # Real cross-page navigation: should land on another page with the correct active item.
    mobile = browser.new_page(viewport={"width": 390, "height": 800})
    mobile.goto(f"{BASE}/index.html", wait_until="load")
    mobile.locator(".bv-menu-toggle").click()
    mobile.locator('#bv-primary-nav a[href="./sources.html"]').click()
    mobile.wait_for_url("**/sources.html")
    ok(mobile.locator('#bv-primary-nav a[aria-current="page"][href="./sources.html"]').count() == 1,
       "Mobile link opens the correct section")
    ok(not visible(mobile.locator("#bv-primary-nav")),
       "Menu starts collapsed on destination page")

    # Resize desktop -> mobile and back: mobile menu state must not get stranded.
    mobile.set_viewport_size({"width": 1024, "height": 800})
    ok(visible(mobile.locator("#bv-primary-nav")), "Tablet rail visible after resize")
    mobile.set_viewport_size({"width": 360, "height": 800})
    ok(not visible(mobile.locator("#bv-primary-nav")),
       "Resized back to mobile: menu is collapsed")
    mobile.close()
    browser.close()

print(f"PASS: {assertions} Chromium navigation assertions at {WIDTHS}; "
      f"{len(list(SHOTS.glob('*.png')))} screenshots captured.")
