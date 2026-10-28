#!/usr/bin/env python3
"""Bani Vyatki Analytics — responsive sources browser tests, iteration 04.

Uses real static pages served from a local HTTP server. The app has no
Bitrix connection; no external data or secrets are used.
Requires playwright==1.56.0 and its Chromium binary.
"""
from __future__ import annotations
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("BV_PREVIEW_BASE","http://127.0.0.1:8765").rstrip("/")
WIDTHS=[320,360,390,430,520,600,601,720,768,900,1024,1140,1200,1440,1920]
SHOTS=Path("artifacts/sources")
SHOTS.mkdir(parents=True, exist_ok=True)
checks=0

def ok(value,why):
    global checks
    if not value:
        raise AssertionError(why)
    checks+=1

def text(locator):
    return " ".join(locator.inner_text().split())

def current(page):
    return [text(page.locator(f"#{i}")) for i in
            ("totalKpi","qualifiedKpi","shareKpi","excludedKpi")]

def source(page,name,total,qualified,share,excluded):
    page.locator("#sourceFilter").select_option(name)
    ok(current(page)==[str(total),str(qualified),share,str(excluded)],
       f"{name} KPIs: {current(page)}")
    ok(page.locator("#sourcesTable tr").count()==(5 if name=="all" else 2),
       f"{name} row count")
    ok(page.locator("#sourceCards .source-mobile-card").count()==
       (5 if name=="all" else 1),f"{name} mobile card count")
    ok(page.locator("#dailyChart rect[data-day]").count()==30,
       f"{name}: missing interactive days")
    ok(text(page.locator(".quality-badge"))==f"{qualified} из {total}",
       f"{name}: quality badge")
    ok(text(page.locator("#sourcesTable tr").last.locator("td").last)==
       ("13" if name=="all" else {"avito":"8","vk":"3","calls":"2","other":"0"}[name]),
       f"{name}: contracts from wrong cohort")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
    for width in WIDTHS:
        page=browser.new_page(viewport={"width":width,"height":850},device_scale_factor=1)
        errors=[]
        page.on("pageerror", lambda e: errors.append(str(e)))
        response=page.goto(f"{BASE}/sources.html",wait_until="load",timeout=30000)
        ok(response is not None and response.status==200,f"{width}: HTTP 200")
        page.locator("html.bv-sources-ready").wait_for(state="attached")
        ok(not errors, f"{width}: JS errors {errors}")
        extent=page.evaluate("""() => ({
          html: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          body: document.body.scrollWidth
        })""")
        ok(extent["html"]<=extent["viewport"]+1,
           f"{width}: document horizontal overflow {extent}")
        ok(extent["body"]<=extent["viewport"]+1,
           f"{width}: body horizontal overflow {extent}")
        ok(page.locator(".s-kpi").count()==4,f"{width}: 4 KPI cards")
        ok(current(page)==["222","122","55,0%","100"],
           f"{width}: all-source KPI mismatch {current(page)}")
        ok(page.locator(".daily-chart-viewport[role='region'][tabindex='0']").count()==1,
           f"{width}: chart scroll region is not keyboard accessible")
        ok(page.locator(".s-table-scroll[role='region'][tabindex='0']").count()==1,
           f"{width}: table scroll region is not keyboard accessible")
        ok(page.locator("#dailyChart rect[data-day]").count()==30,
           f"{width}: expected 30 day hit rectangles")
        ok(text(page.locator("#selectedDayLabel"))=="14 сентября",
           f"{width}: default day changed")
        ok(text(page.locator("#selectedDayDetails"))=="37 обращений · 16 целевых",
           f"{width}: selected day data changed")
        if width<=600:
            ok(page.locator("#sourceCards").is_visible(),
               f"{width}: mobile cards hidden")
            ok(not page.locator(".s-table-scroll").is_visible(),
               f"{width}: wide table visible despite cards")
            ok(page.locator("#sourceCards .source-mobile-card").count()==5,
               f"{width}: four sources + total expected")
            ok(not page.locator("#sourcesTableHint").is_visible(),
               f"{width}: misleading table scroll hint")
        else:
            ok(page.locator(".s-table-scroll").is_visible(),
               f"{width}: table hidden")
            ok(not page.locator("#sourceCards").is_visible(),
               f"{width}: mobile cards visible on desktop")
        viewport=page.locator("#dailyChartViewport")
        measurements=viewport.evaluate("""e=>({
          scroll:e.scrollWidth,client:e.clientWidth,left:e.scrollLeft
        })""")
        must_scroll=(measurements["scroll"]>measurements["client"]+2)
        ok(page.locator("#dailyScrollHint").is_visible()==must_scroll,
           f"{width}: chart hint incorrect for {measurements}")
        if width<=900:
            ok(must_scroll,f"{width}: scrollable 30-day chart expected")
            ok(measurements["left"]>0,
               f"{width}: initial viewport should center selected day: {measurements}")
            rect=page.locator("#dailyChart rect[data-day='14']").bounding_box()
            ok(rect is not None and rect["width"]>=24,
               f"{width}: day tap target too narrow {rect}")
        else:
            ok(not must_scroll,
               f"{width}: full-width chart unexpectedly scrolling")
        if width==320:
            xs=page.locator(".s-kpi").all()
            a,b=xs[0].bounding_box(),xs[1].bounding_box()
            ok(abs(a["x"]-b["x"])<2,
               "320: KPI cards should stack")
        if width in (390,430,600):
            xs=page.locator(".s-kpi").all()
            a,b=xs[0].bounding_box(),xs[1].bounding_box()
            ok(abs(a["x"]-b["x"])>20,
               f"{width}: expected two KPI columns")

        # Source filters and quality counters must use original CRM data.
        if width in (320,390,768,1440):
            source(page,"avito",167,107,"64,1%",60)
            ok(text(page.locator("#selectedDayDetails"))==
               "36 обращений · 15 целевых",
               "Avito selected day totals changed")
            source(page,"vk",21,6,"28,6%",15)
            source(page,"calls",29,6,"20,7%",23)
            source(page,"other",5,3,"60,0%",2)
            source(page,"all",222,122,"55,0%",100)
        # View switch must not change all-source monthly totals.
        page.locator("#viewQualified").click()
        ok(page.locator("#viewQualified").get_attribute("aria-pressed")=="true",
           f"{width}: qualified toggle")
        ok(current(page)==["222","122","55,0%","100"],
           f"{width}: toggle changed KPI")
        page.locator("#viewAll").click()
        ok(page.locator("#viewAll").get_attribute("aria-pressed")=="true",
           f"{width}: all view toggle")

        # Date navigation, boundary disable and reset.
        page.locator("#nextDay").click()
        ok(text(page.locator("#selectedDayLabel"))=="15 сентября",
           f"{width}: next day")
        ok(text(page.locator("#selectedDayDetails"))=="22 обращений · 5 целевых",
           f"{width}: day15 values")
        page.locator("#prevDay").click()
        ok(text(page.locator("#selectedDayLabel"))=="14 сентября",
           f"{width}: previous day")
        ok(page.locator("#resetDay").is_disabled(),
           f"{width}: reset should disable at default day")
        # Selecting a day using SVG keyboard must preserve focus after rerender.
        hit=page.locator("#dailyChart rect[data-day='28']")
        hit.focus()
        page.keyboard.press("Enter")
        ok(text(page.locator("#selectedDayDetails"))=="34 обращений · 31 целевых",
           f"{width}: accessible SVG day selection data")
        ok(page.locator("#dailyChart rect[data-day='28']").evaluate(
           "(e)=>document.activeElement===e"),
           f"{width}: keyboard focus lost after selecting a bar")
        page.locator("#resetDay").click()
        ok(text(page.locator("#selectedDayLabel"))=="14 сентября",
           f"{width}: reset day")
        if width in (320,390,600,768,1024,1440,1920):
            page.screenshot(
                path=str(SHOTS/f"sources-{width}-overview.png"),
                full_page=width in (320,390,768,1440))
        if width in (320,390,768,1440):
            page.locator("#sourceFilter").select_option("avito")
            page.screenshot(
                path=str(SHOTS/f"sources-{width}-avito.png"),
                full_page=width in (320,390,768))
        page.close()

    # No-JS mode must never hide the conventional HTML table or navigation.
    context=browser.new_context(viewport={"width":360,"height":800},java_script_enabled=False)
    nojs=context.new_page()
    nojs.goto(f"{BASE}/sources.html",wait_until="load")
    ok(nojs.locator(".s-table-scroll").is_visible(),
       "No-JS: conventional table region hidden")
    ok(nojs.locator("#bv-primary-nav").is_visible(),
       "No-JS: navigation is hidden")
    context.close()

    # Touch: pan the chart and operate mobile day buttons without hovering.
    touch=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,
                              device_scale_factor=2,has_touch=True)
    phone=touch.new_page()
    phone.goto(f"{BASE}/sources.html",wait_until="load")
    phone.locator("html.bv-sources-ready").wait_for(state="attached")
    initial_scroll=phone.locator("#dailyChartViewport").evaluate("(e)=>e.scrollLeft")
    phone.locator("#dailyChartViewport").evaluate("(e)=>e.scrollLeft += 130")
    after_scroll=phone.locator("#dailyChartViewport").evaluate("(e)=>e.scrollLeft")
    ok(after_scroll>initial_scroll,
       "Touch context: chart should support horizontal scrolling")
    phone.locator("#nextDay").tap()
    ok(text(phone.locator("#selectedDayLabel"))=="15 сентября",
       "Touch: next-day button failed")
    phone.close()
    touch.close()
    browser.close()

print(f"PASS: {checks} sources interaction and responsive assertions at "
      f"{len(WIDTHS)} widths; {len(list(SHOTS.glob('*.png')))} screenshots.")
