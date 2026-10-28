#!/usr/bin/env python3
"""Browser QA — Bani Vyatki Analytics overview responsive iteration 03.

Requires: playwright==1.56.0 and Chromium; serves repository on localhost.
The test only reads the public static prototype. No CRM calls or writes.
"""
from __future__ import annotations

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BV_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
WIDTHS = [320, 360, 390, 430, 520, 600, 601, 720, 768, 900, 1024, 1140, 1200, 1440, 1920]
SCREENSHOTS = Path("artifacts/overview")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

checks = 0

def ensure(condition: bool, message: str):
    global checks
    if not condition:
        raise AssertionError(message)
    checks += 1

def simplify(value: str) -> str:
    return " ".join(value.split())

def css_visible(locator) -> bool:
    return locator.is_visible()

def check_scenario(page, width: int, choice: str):
    page.locator("#scenario").select_option(choice)
    revenue_plan = page.locator('[data-plan="revenue"]').inner_text()
    expected_plan = "6 240 000 ₽" if choice == "realistic" else "9 360 000 ₽"
    expected_pct = "90,4%" if choice == "realistic" else "60,3%"
    ensure(simplify(revenue_plan) == expected_plan, f"{width} {choice}: revenue plan {revenue_plan}")
    ensure(page.locator('[data-pct="revenue"]').inner_text().strip() == expected_pct,
           f"{width} {choice}: revenue pct")
    ensure(page.locator('[data-pct="margin"]').inner_text().strip() ==
           ("86,1%" if choice == "realistic" else "57,4%"),
           f"{width} {choice}: margin percent")
    ensure(page.locator('[data-pct="contracts"]').inner_text().strip() ==
           ("108,3%" if choice == "realistic" else "72,2%"),
           f"{width} {choice}: contracts percent")
    ensure(page.locator('[data-pct="qualified"]').inner_text().strip() ==
           ("187,7%" if choice == "realistic" else "140,2%"),
           f"{width} {choice}: qualified percent")

    ensure(page.locator("#company-table tr").count() == 6,
           f"{width} {choice}: company table row count")
    ensure(page.locator("#avito-table tr").count() == 5,
           f"{width} {choice}: Avito table row count")
    ensure(page.locator("#company-cards .plan-mobile-card").count() == 6,
           f"{width} {choice}: company mobile card count")
    ensure(page.locator("#avito-cards .plan-mobile-card").count() == 5,
           f"{width} {choice}: Avito mobile card count")
    ensure(page.locator(".plan-mobile-target.is-selected").count() == 11,
           f"{width} {choice}: 11 selected plan targets expected")
    ensure(all(simplify(t) == expected_plan for t in
               [page.locator("#company-cards .plan-mobile-card").first
                .locator(".plan-mobile-target.is-selected strong").inner_text()]),
           f"{width} {choice}: mobile card plan value differs")
    ensure(simplify(page.locator("#company-cards .plan-mobile-card").first
                    .locator(".plan-mobile-fact strong").inner_text()) == "5 643 000 ₽",
           f"{width} {choice}: actual revenue changed")
    ensure(simplify(page.locator("#avito-cards .plan-mobile-card").last
                    .locator(".plan-mobile-fact strong").inner_text()) == "10 886,63 ₽",
           f"{width} {choice}: Avito cost of sale changed")
    ensure(page.locator("[data-scenario-label]").first.inner_text() ==
           ("Реалистичный прогноз" if choice == "realistic" else "Оптимистичный прогноз"),
           f"{width} {choice}: scenario label mismatch")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])

    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 850}, device_scale_factor=1)
        problems = []
        page.on("pageerror", lambda exc: problems.append(str(exc)))
        response = page.goto(f"{BASE}/index.html", wait_until="load", timeout=30000)
        ensure(response is not None and response.status == 200, f"{width}: overview HTTP")
        page.locator("html.bv-overview-ready").wait_for(state="attached")
        ensure(not problems, f"{width}: browser JS errors: {problems}")

        ensure(page.locator(".kpi").count() == 4, f"{width}: four top-level KPIs")
        ensure(page.locator(".mini").count() == 3, f"{width}: three secondary KPIs")
        ensure(page.locator(".table-scroll[role='region'][tabindex='0']").count() == 2,
               f"{width}: accessible table regions")

        extent = page.evaluate("""() => ({
          doc: document.documentElement.scrollWidth,
          screen: document.documentElement.clientWidth,
          body: document.body.scrollWidth
        })""")
        ensure(extent["doc"] <= extent["screen"] + 1,
               f"{width}: document x-overflow {extent}")
        ensure(extent["body"] <= extent["screen"] + 1,
               f"{width}: body x-overflow {extent}")

        first = page.locator(".kpi").nth(0).bounding_box()
        second = page.locator(".kpi").nth(1).bounding_box()
        ensure(first is not None and second is not None, f"{width}: missing KPI rectangle")

        if width <= 600:
            ensure(css_visible(page.locator("#company-cards")),
                   f"{width}: mobile plan cards hidden")
            ensure(not css_visible(page.locator(".table-scroll").first),
                   f"{width}: wide table should be replaced by cards")
            ensure(abs(first["x"] - second["x"]) < 2,
                   f"{width}: KPI cards must stack on mobile")
            ensure(page.locator("#scenario").evaluate("(e)=>e.getBoundingClientRect().height") >= 44,
                   f"{width}: plan selector below 44px")
        else:
            ensure(css_visible(page.locator(".table-scroll").first),
                   f"{width}: semantic table hidden")
            ensure(not css_visible(page.locator("#company-cards")),
                   f"{width}: mobile cards visible on desktop")
            if 601 <= width <= 1140:
                ensure(abs(first["x"] - second["x"]) > 20,
                       f"{width}: expected two KPI columns")

        check_scenario(page, width, "realistic")
        if width in (320, 390, 600, 768, 1024, 1440, 1920):
            page.screenshot(path=str(SCREENSHOTS / f"overview-{width}-realistic.png"),
                            full_page=(width in (320, 390, 600, 768, 1440)))
        check_scenario(page, width, "optimistic")
        if width in (320, 390, 768, 1440):
            page.screenshot(path=str(SCREENSHOTS / f"overview-{width}-optimistic.png"),
                            full_page=(width in (320, 390, 768)))
        check_scenario(page, width, "realistic")

        # The table stays fully reachable by horizontal scroll on intermediate screens.
        if 601 <= width <= 900:
            scroll = page.locator(".table-scroll").first
            sizes = scroll.evaluate("""e => ({
              scrollWidth: e.scrollWidth,
              clientWidth: e.clientWidth
            })""")
            ensure(sizes["clientWidth"] > 0, f"{width}: table scroll region size")
            if sizes["scrollWidth"] > sizes["clientWidth"] + 1:
                scroll.evaluate("(e)=>e.scrollLeft=e.scrollWidth")
                ensure(scroll.evaluate("(e)=>e.scrollLeft") > 0,
                       f"{width}: cannot scroll table horizontally")

        page.close()

    # Progressive enhancement: if scripts fail, no-JS still shows
    # a scrollable semantic table rather than an empty mobile card container.
    ctx = browser.new_context(viewport={"width": 360, "height": 800},
                              java_script_enabled=False)
    nojs = ctx.new_page()
    nojs.goto(f"{BASE}/index.html", wait_until="load")
    ensure(css_visible(nojs.locator(".table-scroll").first),
           "No-JS mobile must keep the semantic table region visible")
    ensure(css_visible(nojs.locator("#bv-primary-nav")),
           "No-JS mobile menu should remain available")
    ctx.close()

    browser.close()

print(f"PASS: {checks} overview responsiveness and plan/fact assertions "
      f"across {len(WIDTHS)} viewport widths; "
      f"{len(list(SCREENSHOTS.glob('*.png')))} screenshots.")
