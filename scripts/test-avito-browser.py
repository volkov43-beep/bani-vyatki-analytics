#!/usr/bin/env python3
"""Bani Vyatki Analytics / section 07 «Авито: объявления»: responsive browser QA.

Actual static page served on localhost; requires Playwright 1.56.0 Chromium.
Checks approved August–November 2026 aggregates from daily Avito Pro exports,
month switching, the daily charts and table, listing groups and their filter,
responsive reflow (15 widths), touch targets, readable text contrast and the
absence of contacts. Does not connect to Avito, Bitrix24 or any external service.
Run: python -m http.server 8765 & python scripts/test-avito-browser.py
Optional: BV_CHROME=/path/to/chrome to use an installed browser.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.getenv("BV_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
WIDTHS = [320, 360, 390, 430, 520, 600, 601, 720, 768, 860, 900, 1024, 1160, 1440, 1920]
SHOTS = Path("artifacts/avito")
SHOTS.mkdir(parents=True, exist_ok=True)
checks = 0

# Approved aggregates. Totals = sum of the daily Avito Pro exports; costs = money + written-off bonuses.
EXPECTED = {
    "Август":   dict(views="7 133", contacts="126", cr="1,8%", cost="118 857 ₽", cpc="943 ₽", days=31, loaded=31,
                    listings=30, groups={"work": 4, "look": 9, "hidden": 5, "weak": 7, "few": 5}),
    "Сентябрь": dict(views="4 489", contacts="112", cr="2,5%", cost="85 493 ₽", cpc="763 ₽", days=30, loaded=30,
                    listings=26, groups={"work": 4, "look": 6, "hidden": 5, "weak": 4, "few": 7}),
    "Октябрь": dict(views="7 491", contacts="115", cr="1,5%", cost="87 916 ₽", cpc="764 ₽", days=31, loaded=31,
                    listings=30, groups={"work": 4, "look": 4, "hidden": 3, "weak": 4, "few": 15}),
    "Ноябрь":  dict(views="626", contacts="10", cr="1,6%", cost="15 756 ₽", cpc="1 576 ₽", days=30, loaded=6,
                    listings=22, groups=None),
}


def ensure(condition, why):
    global checks
    if not condition:
        raise AssertionError(why)
    checks += 1


def text(locator):
    return " ".join(locator.inner_text().split())


def tc(locator):
    """Text of elements that may be collapsed (the daily table lives in a closed <details>)."""
    return " ".join((locator.text_content() or "").split())


def kpi(page, key):
    return text(page.locator(f'#avKpis [data-kpi="{key}"] strong'))


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
    page.locator("#avMonthSwitch button", has_text=name).click()
    ensure(page.locator("#avMonthSwitch button[aria-pressed='true']").count() == 1, f"{name}: one active month")
    ensure(text(page.locator("#avMonthSwitch button[aria-pressed='true']")) == name, f"{name}: active month label")


def check_month(page, name, width):
    exp = EXPECTED[name]
    for key in ("views", "contacts", "cr", "cost", "cpc"):
        ensure(kpi(page, key) == exp[key], f"{width}/{name}: KPI {key} = {kpi(page, key)!r}, expected {exp[key]!r}")
    # daily table: one row per calendar day + total; unloaded days are marked, not zero
    rows = page.locator("#avDailyTable tbody tr")
    ensure(rows.count() == exp["days"] + 1, f"{width}/{name}: daily table rows")
    ensure(page.locator("#avDailyTable tbody tr.is-empty").count() == exp["days"] - exp["loaded"], f"{width}/{name}: pending days")
    total = page.locator("#avDailyTable tr.is-total td")
    ensure(tc(total.nth(2)) == exp["views"] and tc(total.nth(3)) == exp["contacts"], f"{width}/{name}: daily table totals")
    ensure(page.locator("#avDaily .av-mini").count() == 3, f"{width}/{name}: three daily charts")
    ensure(page.locator("#avDaily .av-mini").first.locator(".av-empty").count() == exp["days"] - exp["loaded"],
           f"{width}/{name}: empty placeholders for days not loaded")
    # listings
    ensure(page.locator("#avTable tbody tr").count() == exp["listings"], f"{width}/{name}: listing rows")
    ensure(page.locator("#avCards li").count() == exp["listings"], f"{width}/{name}: listing cards")
    ensure(page.locator('#avGroups [data-group="all"] b').inner_text() == str(exp["listings"]), f"{width}/{name}: all-group count")
    if exp["groups"]:
        for g, n in exp["groups"].items():
            ensure(page.locator(f'#avTable tbody tr[data-group="{g}"]').count() == n, f"{width}/{name}: group {g} = {n}")
    ranks = [int(x) for x in page.locator("#avTable tbody th").all_inner_texts()]
    ensure(sorted(ranks) == list(range(1, exp["listings"] + 1)), f"{width}/{name}: ranks 1..N")


with sync_playwright() as p:
    launch = {"args": ["--no-sandbox"]}
    if os.getenv("BV_CHROME"):
        launch["executable_path"] = os.environ["BV_CHROME"]
    browser = p.chromium.launch(**launch)
    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"{BASE}/avito.html", wait_until="load")
        page.wait_for_selector("html.bv-avito-ready")
        ensure(not errors, f"{width}: JS errors {errors}")
        # default month is the latest one
        ensure(text(page.locator("#avMonthSwitch button[aria-pressed='true']")) == "Ноябрь", f"{width}: default month")
        ensure("6 из 30" in text(page.locator("#avMonthNote")), f"{width}: partial month note")
        for name in EXPECTED:
            select_month(page, name)
            check_month(page, name, width)
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            ensure(overflow <= 1, f"{width}/{name}: horizontal page overflow {overflow}px")
            chart_w = page.locator("#avDaily svg").first.bounding_box()["width"]
            panel_w = page.locator("#avDaily").bounding_box()["width"]
            ensure(chart_w <= panel_w + 1, f"{width}/{name}: daily chart wider than its panel")
        # table on wide screens, cards on narrow ones
        select_month(page, "Октябрь")
        if width <= 860:
            ensure(page.locator("#avCards").is_visible() and not page.locator(".av-table-wrap").is_visible(), f"{width}: cards on mobile")
            ensure(page.locator("#avCards li:visible").count() == 10, f"{width}: first 10 cards")
            page.locator("#avCardsMore").click()
            ensure(page.locator("#avCards li:visible").count() == 30, f"{width}: show-more reveals all cards")
        else:
            ensure(page.locator(".av-table-wrap").is_visible() and not page.locator("#avCards").is_visible(), f"{width}: table on desktop")
        # group filter
        page.locator('#avGroups [data-group="look"]').click()
        ensure(page.locator("#avTable tbody tr").count() == 4, f"{width}: filter by group")
        ensure(all(g == "look" for g in page.locator("#avTable tbody tr").evaluate_all("rs => rs.map(r => r.dataset.group)")), f"{width}: filtered group only")
        page.locator('#avGroups [data-group="all"]').click()
        ensure(page.locator("#avTable tbody tr").count() == 30, f"{width}: reset filter")
        # sort by views: first row has the most views
        page.locator("#avSort").select_option("views")
        ensure(text(page.locator("#avTable tbody tr").first.locator("td").nth(4)) == "3 093", f"{width}: sort by views")
        page.locator("#avSort").select_option("contacts")
        ensure(text(page.locator("#avTable tbody tr").first.locator("td").nth(6)) == "38", f"{width}: sort by contacts")
        if width <= 720:
            for sel in ("#avMonthSwitch button", "#avGroups button", "#avSort", ".bv-menu-toggle"):
                h = page.locator(sel).first.bounding_box()["height"]
                ensure(h >= 43.5, f"{width}: touch target {sel} = {h:.0f}px")
        for sel in (".av-kpi p", ".av-mini-title span", ".av-panel-header p", ".av-scatter-caption", ".av-title small", ".av-rules-th"):
            ratio = contrast(page, sel)
            ensure(ratio >= 4.5, f"{width}: {sel} contrast {ratio:.2f}:1")
        if width in (360, 768, 1440):
            page.screenshot(path=str(SHOTS / f"avito-{width}.png"), full_page=True)
        page.close()

    # keyboard: daily charts respond to arrows with a tooltip
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(f"{BASE}/avito.html")
    page.wait_for_selector("html.bv-avito-ready")
    select_month(page, "Октябрь")
    page.locator("#avDaily").focus()
    page.keyboard.press("ArrowRight")
    ensure(page.locator("#avTip").is_visible(), "keyboard: tooltip on arrow")
    ensure("1 октября" in text(page.locator("#avTip")) and "Просмотры: 137" in text(page.locator("#avTip")), "keyboard: 1 October values")
    page.keyboard.press("Escape")
    ensure(not page.locator("#avTip").is_visible(), "keyboard: Escape hides tooltip")
    # no contacts or external links in rendered content
    body = page.locator("main").inner_text()
    ensure(not re.search(r"\+7|\b8\d{10}\b|@", body), "no phone numbers or e-mails on the page")
    page.close()
    browser.close()

print(f"PASS: {checks} Avito section assertions at {len(WIDTHS)} viewport widths; screenshots in {SHOTS}/")
