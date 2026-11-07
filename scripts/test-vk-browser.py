#!/usr/bin/env python3
"""Bani Vyatki Analytics / section 06 «ВКонтакте»: responsive browser QA.

Actual static page served on localhost; requires Playwright 1.56.0 Chromium.
Checks approved July–October 2026 aggregates, month switching, responsive
reflow (15 widths), touch targets, readable text contrast and absence of
contacts. Does not connect to VK, Bitrix24 or any external service.
Run: python -m http.server 8765 & python scripts/test-vk-browser.py
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.getenv("BV_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
WIDTHS = [320, 360, 390, 430, 520, 600, 601, 720, 768, 900, 1024, 1140, 1200, 1440, 1920]
SHOTS = Path("artifacts/vk")
SHOTS.mkdir(parents=True, exist_ok=True)
checks = 0

# Approved aggregates (iteration 1). "None" means the export is still pending.
EXPECTED = {
    "Июль":     dict(subscribers="1 884", reach="12 355", subscribed="78", content="16", messages="19",
                     leads=None, deals=None, ads_known=True),
    "Август":   dict(subscribers="1 951", reach="27 261", subscribed="82", content="11", messages="25",
                     leads=None, deals=None, ads_known=True),
    "Сентябрь": dict(subscribers="1 969", reach="9 420", subscribed="26", content="19", messages="20",
                     leads="21", deals="3", ads_known=False),
    "Октябрь":  dict(subscribers="2 141", reach="15 674", subscribed="186", content="18", messages="20",
                     leads=None, deals=None, ads_known=True),
}


def ensure(condition, why):
    global checks
    if not condition:
        raise AssertionError(why)
    checks += 1


def text(locator):
    return " ".join(locator.inner_text().split())


def kpi_value(page, key):
    return text(page.locator(f'#vkKpis [data-kpi="{key}"] strong')).replace(" чел.", "").replace(" шт.", "")


def contrast(page, selector):
    return page.locator(selector).first.evaluate("""(el) => {
      const parse = s => { const m = (s||"").match(/rgba?\\(([\\d.]+)[, ]+([\\d.]+)[, ]+([\\d.]+)(?:[, /]+([\\d.]+))?\\)/);
        return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
      const lum = c => { const r = c.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4));
        return .2126*r[0] + .7152*r[1] + .0722*r[2]; };
      const fg = parse(getComputedStyle(el).color); let node = el, bg = null;
      while (node) { const b = parse(getComputedStyle(node).backgroundColor); if (b && b[3] >= .99) { bg = b; break; } node = node.parentElement; }
      bg = bg || [255,255,255,1];
      return (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
    }""")


def select_month(page, name):
    page.locator("#vkMonthSwitch button", has_text=name).click()
    ensure(page.locator("#vkMonthSwitch button[aria-pressed='true']").count() == 1, f"{name}: one active month")
    ensure(text(page.locator("#vkMonthSwitch button[aria-pressed='true']")) == name, f"{name}: active month label")


def check_month(page, name, width):
    exp = EXPECTED[name]
    for key in ("subscribers", "reach", "subscribed", "content", "messages"):
        ensure(kpi_value(page, key) == exp[key], f"{width}/{name}: KPI {key} = {kpi_value(page, key)!r}, expected {exp[key]!r}")
    ensure(text(page.locator("#vkTotalValue")) == exp["reach"], f"{width}/{name}: total reach panel")
    for step in ("leads", "deals"):
        value = text(page.locator(f'#vkFunnel [data-step="{step}"] strong'))
        if exp[step] is None:
            ensure(value == "—", f"{width}/{name}: pending CRM {step} must be shown as a dash")
            ensure("ждём выгрузку" in text(page.locator(f'#vkFunnel [data-step="{step}"]')), f"{width}/{name}: pending note")
        else:
            ensure(value == exp[step], f"{width}/{name}: CRM {step} = {value}")
    badge = text(page.locator("#vkAdsBadge"))
    ensure(("ждём выгрузку" in badge) != exp["ads_known"], f"{width}/{name}: ads status badge {badge!r}")
    ensure(page.locator("#vkPlan .vk-plan-row").count() == 4, f"{width}/{name}: four formats plan/fact")
    ensure(page.locator("#vkFormats tbody tr").count() == 4, f"{width}/{name}: four format rows")
    ensure(page.locator("#vkTotal .vk-total-col").count() == len(EXPECTED), f"{width}/{name}: reach column per month")
    ensure(page.locator("#vkTotal .vk-total-col.is-current").count() == 1, f"{width}/{name}: selected reach month")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        response = page.goto(f"{BASE}/vk.html", wait_until="load", timeout=30000)
        ensure(response is not None and response.status == 200, f"{width}: HTTP 200")
        page.locator("html.bv-vk-ready").wait_for(state="attached", timeout=10000)
        ensure(not errors, f"{width}: JavaScript errors {errors}")
        ensure(page.locator("main h1").count() == 1 and text(page.locator("main h1")) == "ВКонтакте", f"{width}: heading")
        ensure(page.locator('#bv-primary-nav a[aria-current="page"][href="./vk.html"]').count() == 1, f"{width}: active nav item")
        ensure(page.locator("#vkKpis .vk-kpi").count() == 5, f"{width}: five KPI cards")
        n_months = page.evaluate("window.BV_VK.months.length")
        last = page.evaluate("window.BV_VK.months[window.BV_VK.months.length - 1].name")
        ensure(n_months == len(EXPECTED), f"{width}: every month in vk-data.js needs approved values in EXPECTED")
        ensure(page.locator("#vkMonthSwitch button").count() == n_months, f"{width}: month buttons = months in data")
        ensure(text(page.locator("#vkMonthSwitch button[aria-pressed='true']")) == last, f"{width}: latest month selected by default")
        check_month(page, last, width)

        metrics = page.evaluate("""() => ({html: document.documentElement.scrollWidth, body: document.body.scrollWidth,
            viewport: document.documentElement.clientWidth,
            panels: [...document.querySelectorAll('.vk-panel')].filter(p => p.scrollWidth > p.clientWidth + 1).map(p => p.querySelector('h2')?.textContent)})""")
        ensure(metrics["html"] <= metrics["viewport"] + 1, f"{width}: page horizontal overflow {metrics}")
        ensure(metrics["body"] <= metrics["viewport"] + 1, f"{width}: body horizontal overflow {metrics}")
        ensure(not metrics["panels"], f"{width}: panel content overflows: {metrics['panels']}")
        svg_w = page.locator("#vkLine svg").evaluate("el => el.getBoundingClientRect().width")
        host_w = page.locator("#vkLine").evaluate("el => el.getBoundingClientRect().width")
        ensure(svg_w <= host_w + 1, f"{width}: subscriber chart wider than its panel ({svg_w} > {host_w})")
        axis_px = page.locator("#vkLine .vk-axis").first.evaluate("el => el.getBoundingClientRect().height")
        ensure(axis_px >= 9, f"{width}: chart labels too small ({axis_px}px)")

        if width <= 720:
            for i in range(4):
                h = page.locator("#vkMonthSwitch button").nth(i).bounding_box()["height"]
                ensure(h >= 43.5, f"{width}: month button touch target {h}px")
        for sel in (".vk-panel-header p", "#vkKpis .vk-kpi p", ".vk-legend", ".vk-method p"):
            ratio = contrast(page, sel)
            ensure(ratio >= 4.5, f"{width}: {sel} contrast {ratio:.2f}:1")

        if width in (360, 768, 1440):
            page.screenshot(path=str(SHOTS / f"vk-{width}-october.png"), full_page=True)

        if width in (360, 390, 1024, 1440):
            for name in EXPECTED:
                select_month(page, name)
                check_month(page, name, width)
                info = page.evaluate("n => { const m = window.BV_VK.months.find(x => x.name === n); return {id: m.id, complete: m.content.complete, through: m.content.through}; }", name)
                year, month = map(int, info["id"].split("-"))
                days = (__import__("calendar").monthrange(year, month))[1]
                ensure(page.locator("#vkCalendar .vk-cal-day").count() == days, f"{width}/{name}: calendar days")
                unknown = 0 if info["complete"] else days - int(info["through"][-2:])
                ensure(page.locator("#vkCalendar .vk-cal-day.is-unknown").count() == unknown, f"{width}/{name}: days without content export")
                ensure(page.locator("#vkPlanBadge").is_visible() == (not info["complete"]), f"{width}/{name}: partial content badge")
            select_month(page, "Июль")
            ensure("к июню" in text(page.locator('#vkKpis [data-kpi="reach"] .vk-trend')), f"{width}: July compares with June")
            page.locator("#vkTopErr").click()
            ensure(page.locator("#vkTopErr").get_attribute("aria-pressed") == "true", f"{width}: ERR ranking toggle")
            ensure(page.locator("#vkTop .vk-top-item").count() == 3, f"{width}: three leaders")
            page.locator("#vkTopReach").click()
            select_month(page, "Сентябрь")
            if width == 390:
                page.screenshot(path=str(SHOTS / "vk-390-september.png"), full_page=True)
            select_month(page, last)

        body = page.locator("main").inner_text()
        ensure(not re.search(r"@|\+7\s?\(?\d|\b8\d{10}\b", body), f"{width}: contacts must not be published")
        page.close()

    # Keyboard: month switch is a set of real buttons reachable with Tab.
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(f"{BASE}/vk.html", wait_until="load")
    page.locator("html.bv-vk-ready").wait_for(state="attached")
    page.locator("#vkMonthSwitch button").first.focus()
    page.keyboard.press("Enter")
    ensure(text(page.locator("#vkMonthSwitch button[aria-pressed='true']")) == "Июль", "keyboard: Enter selects month")
    ensure(page.evaluate("document.activeElement.tagName") == "BUTTON", "keyboard: focus stays on a button")
    page.close()
    browser.close()

print(f"PASS: {checks} VK section assertions at {len(WIDTHS)} viewport widths; "
      f"{len(list(SHOTS.glob('*.png')))} screenshots.")
