#!/usr/bin/env python3
"""Bani Vyatki Analytics / iteration 05: Sales + CRM pipeline browser QA.

Actual static pages served on localhost; requires Playwright 1.56.0 Chromium.
Does not connect to CRM or publish customer details.
"""
from __future__ import annotations

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("BV_PREVIEW_BASE","http://127.0.0.1:8765").rstrip("/")
WIDTHS=[320,360,390,430,520,600,601,720,768,900,1024,1140,1200,1440,1920]
SHOTS=Path("artifacts/sales")
SHOTS.mkdir(parents=True,exist_ok=True)
checks=0

def ensure(condition,why):
    global checks
    if not condition:
        raise AssertionError(why)
    checks+=1

def text(locator):
    return " ".join(locator.inner_text().split())

def state_metrics(page):
    return {
        "total": text(page.locator("#cohortTotal")),
        "qualified":text(page.locator("#qualifiedStageCount")),
        "excluded":text(page.locator("#excludedStageCount")),
        "share":text(page.locator("#stageQualifiedPct")),
        "reasons":text(page.locator("#reasonsTotal"))
    }

def choose(page,value,total,qualified,excluded,share,reasons):
    page.locator("#pipelineSource").select_option(value)
    actual=state_metrics(page)
    expected=dict(total=f"{total} обращений",qualified=str(qualified),
                  excluded=str(excluded),share=share,reasons=f"{reasons} обращений")
    ensure(actual==expected,f"{value}: wrong CRM stage metrics: {actual}; expected {expected}")
    ensure(page.locator("#stageBars .stage-row").count()==8,
           f"{value}: 8 stage groups required")
    ensure(page.locator("#stageBars .stage-row[role='listitem']").count()==8,
           f"{value}: inaccessible stage list")
    ensure(page.locator(".contract-source[aria-pressed='true']").count()==
           (0 if value=="all" else 1),f"{value}: source selection mismatch")
    ensure(page.locator("#resetPipelineSource").is_disabled()==(value=="all"),
           f"{value}: reset disabled mismatch")
    ensure(page.locator("#pipelineSource").input_value()==value,
           f"{value}: filter select mismatch")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
    for width in WIDTHS:
        page=browser.new_page(viewport={"width":width,"height":850},device_scale_factor=1)
        errors=[]
        page.on("pageerror",lambda ex:errors.append(str(ex)))
        response=page.goto(f"{BASE}/sales.html",wait_until="load",timeout=30000)
        ensure(response is not None and response.status==200,f"{width}: HTTP 200")
        page.locator("#stageBars .stage-row").first.wait_for(state="visible")
        ensure(not errors,f"{width}: JS errors {errors}")
        doc=page.evaluate("""() => ({
           page: document.documentElement.scrollWidth,
           viewport: document.documentElement.clientWidth,
           body: document.body.scrollWidth
        })""")
        ensure(doc["page"]<=doc["viewport"]+1,f"{width}: document x-overflow {doc}")
        ensure(doc["body"]<=doc["viewport"]+1,f"{width}: body x-overflow {doc}")
        ensure(page.locator(".sales-kpi").count()==4,f"{width}: 4 KPI cards")
        ensure(page.locator(".monthly-bars .month-col").count()==4,
               f"{width}: expected 4 month bars")
        ensure(page.locator(".contract-source").count()==4,
               f"{width}: expected 4 channel buttons")
        ensure(text(page.locator(".sales-kpi").nth(0).locator("strong"))=="13 шт.",
               f"{width}: monthly contracts changed")
        ensure(text(page.locator(".sales-kpi").nth(1).locator("strong"))=="5 643 000 ₽",
               f"{width}: monthly revenue changed")
        ensure(text(page.locator(".sales-kpi").nth(2).locator("strong"))=="47 встреч",
               f"{width}: tours changed")
        ensure(page.locator("#metricContracts").get_attribute("aria-pressed")=="true",
               f"{width}: default metric is not contracts")
        ensure(text(page.locator("#trendDiff"))=="+6 договоров",
               f"{width}: contract trend changed")
        choose(page,"all",222,122,100,"55,0%",114)
        viewport=page.locator("#salesTrendViewport")
        dims=viewport.evaluate("""e=>({width:e.clientWidth,scroll:e.scrollWidth})""")
        actual_scroll=dims["scroll"]>dims["width"]+2
        ensure(page.locator("#salesTrendScrollHint").is_visible()==actual_scroll,
               f"{width}: misleading chart scroll hint {dims}")
        ensure(viewport.get_attribute("tabindex")=="0",
               f"{width}: trend not keyboard-scrollable")
        if width<=600:
            box_a=page.locator(".sales-kpi").nth(0).bounding_box()
            box_b=page.locator(".sales-kpi").nth(1).bounding_box()
            ensure(abs(box_a["x"]-box_b["x"])<2,
                   f"{width}: cards must stack")
            ensure(page.locator(".stage-row").first.evaluate(
                 "(e)=>getComputedStyle(e).gridTemplateAreas")=='"label number" "bar bar"',
                   f"{width}: stage row should use label/bar split")
        elif width<=1160:
            box_a=page.locator(".sales-kpi").nth(0).bounding_box()
            box_b=page.locator(".sales-kpi").nth(1).bounding_box()
            ensure(abs(box_a["x"]-box_b["x"])>20,
                   f"{width}: expected two KPI columns")
        if width==320:
            ensure(actual_scroll,f"{width}: monthly graph must remain scrollable")
            viewport.evaluate("(e)=>e.scrollLeft=e.scrollWidth")
            ensure(viewport.evaluate("(e)=>e.scrollLeft")>0,
                   f"{width}: graph not scrollable on narrow viewport")
        if width in (320,390,768,1024,1440,1920):
            page.screenshot(path=str(SHOTS/f"sales-{width}-overview.png"),
                            full_page=(width in (320,390,768,1440)))
        page.locator("#metricRevenue").click()
        ensure(page.locator("#metricRevenue").get_attribute("aria-pressed")=="true",
               f"{width}: revenue toggle aria-pressed")
        ensure(text(page.locator("#trendDiff"))=="+2 000 100 ₽",
               f"{width}: revenue trend changed")
        ensure("5 643 000 ₽" in " ".join(page.locator("#salesTrend").get_attribute("aria-label").split()),
               f"{width}: monthly revenue graph not accessible")
        page.locator("#metricContracts").click()
        ensure(text(page.locator("#trendDiff"))=="+6 договоров",
               f"{width}: contracts toggle reset")
        if width in (320,390,768,1440):
            choose(page,"avito",167,107,60,"64,1%",71)
            ensure(page.locator("#lossRows .loss-line").count()==6,
                   f"{width}: expected Avito reasons")
            ensure(text(page.locator("#stageBars .stage-row").nth(5).locator(".stage-count")).startswith("4"),
                   f"{width}: Avito September cohort contracts")
            page.screenshot(path=str(SHOTS/f"sales-{width}-avito.png"),
                            full_page=(width in (320,390,768)))
            choose(page,"vk",21,6,15,"28,6%",16)
            choose(page,"calls",29,6,23,"20,7%",24)
            choose(page,"other",5,3,2,"60,0%",3)
            choose(page,"all",222,122,100,"55,0%",114)
            # Clicking a source bar is a live filter, then reset via button.
            page.locator(".contract-source").first.click()
            ensure(page.locator("#pipelineSource").input_value()=="avito",
                   f"{width}: bar click filter")
            page.locator("#resetPipelineSource").click()
            ensure(page.locator("#pipelineSource").input_value()=="all",
                   f"{width}: reset button filter")
        page.close()

    # Progressive no-JS: static headline, KPI and notes remain available.
    nojs=browser.new_context(viewport={"width":360,"height":800},java_script_enabled=False)
    p=nojs.new_page()
    p.goto(f"{BASE}/sales.html",wait_until="load")
    ensure(p.locator("#bv-primary-nav").is_visible(),
           "No-JS fallback navigation should be visible")
    ensure(p.locator(".sales-kpi").count()==4,
           "No-JS static KPI figures should remain in HTML")
    ensure(p.locator("#pipelineSource").is_visible(),
           "No-JS stage filter should remain visible; it is not interactive")
    nojs.close()

    # Mobile/touch: both channel filter and reset should remain operable.
    touch=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=2,
                              is_mobile=True,has_touch=True)
    p=touch.new_page()
    p.goto(f"{BASE}/sales.html",wait_until="load")
    p.locator(".contract-source").first.tap()
    ensure(p.locator("#pipelineSource").input_value()=="avito","Touch source filter")
    p.locator("#resetPipelineSource").tap()
    ensure(p.locator("#pipelineSource").input_value()=="all","Touch filter reset")
    p.close()
    touch.close()
    browser.close()

print(f"PASS: {checks} sales and funnel responsive assertions at "
      f"{len(WIDTHS)} viewport widths; {len(list(SHOTS.glob('*.png')))} screenshots.")
