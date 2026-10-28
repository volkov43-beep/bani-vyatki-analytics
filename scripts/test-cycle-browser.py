#!/usr/bin/env python3
"""Bani Vyatki Analytics · Cycle responsive browser QA · iteration 07.

Static local HTTP, Playwright 1.56.0/Chromium. No access to CRM.
Tests both DOM presentation modes against the same contract data.
"""
from __future__ import annotations
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("BV_PREVIEW_BASE","http://127.0.0.1:8765").rstrip("/")
WIDTHS=[320,360,390,430,520,600,601,720,768,900,1024,1140,1200,1440,1920]
SHOTS=Path("artifacts/cycle")
SHOTS.mkdir(parents=True,exist_ok=True)
checks=0

def ok(condition,description):
    global checks
    if not condition:
        raise AssertionError(description)
    checks+=1

def txt(locator):
    return " ".join(locator.inner_text().split())

def total_cards(page,which):
    return page.locator(which+" .cycle-contract-card").count()

def verify(page,context,width,num_deals,avg,median,quick,coverage,revenue):
    ending = ("договоров" if num_deals % 100 in (11,12,13,14) or num_deals % 10 in (0,5,6,7,8,9)
              else "договор" if num_deals % 10 == 1 else "договора")
    ok(txt(page.locator("#cycleKnownCount"))==f"{num_deals} {ending}",
       f"{width}/{context}: known count")
    ok(txt(page.locator("#cycleAverage"))==(avg+" дн." if num_deals else "—"),
       f"{width}/{context}: average: {txt(page.locator('#cycleAverage'))}")
    ok(txt(page.locator("#cycleMedian"))==(median+" дн." if num_deals else "—"),
       f"{width}/{context}: median")
    ok(txt(page.locator("#cycleQuickShare"))==(quick+" %" if num_deals else "—"),
       f"{width}/{context}: quick percent")
    ok(txt(page.locator("#cycleCoverage"))==f"{num_deals} из {num_deals}",
       f"{width}/{context}: date coverage")
    ok(page.locator("#cycleDistribution .cycle-group").count()==3,
       f"{width}/{context}: distribution groups")
    ok(page.locator("#cycleMissingRows tr").count()==(num_deals if num_deals else 1),
       f"{width}/{context}: original table rows")
    ok(total_cards(page,"#cycleDateCards")==num_deals,
       f"{width}/{context}: mobile date cards")
    ok(total_cards(page,"#cycleTimelineCards")==num_deals,
       f"{width}/{context}: mobile timeline cards")
    ok(txt(page.locator("#cycleMissingTotal tr td").first)==revenue,
       f"{width}/{context}: source date table sum")
    if num_deals:
        ok(revenue in txt(page.locator("#cycleDateCards .cycle-cards-total")),
           f"{width}/{context}: mobile date total mismatch")
        ok(revenue in txt(page.locator("#cycleTimelineCards .cycle-cards-total")),
           f"{width}/{context}: mobile timeline total mismatch")
    ok(page.locator("#cycleReset").is_disabled()==(context=="all"),
       f"{width}/{context}: reset state")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
    for width in WIDTHS:
        page=browser.new_page(viewport={"width":width,"height":850},device_scale_factor=1)
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        response=page.goto(f"{BASE}/cycle.html",wait_until="load",timeout=30000)
        ok(response is not None and response.status==200,f"{width}: HTTP 200")
        page.locator("html.bv-cycle-ready").wait_for(state="attached")
        ok(not errors,f"{width}: browser errors: {errors}")
        dims=page.evaluate("""() => ({
          doc:document.documentElement.scrollWidth,
          body:document.body.scrollWidth,
          viewport:document.documentElement.clientWidth
        })""")
        ok(dims["doc"]<=dims["viewport"]+1,
           f"{width}: document horizontal overflow {dims}")
        ok(dims["body"]<=dims["viewport"]+1,
           f"{width}: body horizontal overflow {dims}")
        ok(page.locator(".cycle-kpi").count()==4,f"{width}: four KPIs")
        verify(page,"all",width,13,"11,5","9","46,2","100%","5 643 000 ₽")
        ok(page.locator("#cycleDistribution .cycle-group b").all_inner_texts()==["6","6","1"],
           f"{width}: fast/mid/long group counts changed")
        ok(page.locator("#cycleTimeline .cycle-timeline-row").count()==13,
           f"{width}: 13 original timeline rows")
        ok(page.locator("#cycleManagerBars .cycle-breakdown-row").count()==3,
           f"{width}: three manager breakdowns")
        ok(page.locator("#cycleSourceBars .cycle-breakdown-row").count()==3,
           f"{width}: three source breakdowns")
        ok(txt(page.locator("#cycleInsightLabel"))=="4 договора по обращениям до сентября",
           f"{width}: cross-month deals changed")
        ok("1 934 000 ₽" in txt(page.locator("#cycleInsightText")),
           f"{width}: cross-month revenue changed")
        ok(page.locator("#cycleDateCards .cycle-card-basis").count()==13,
           f"{width}: missing data-source labels")
        ok(page.locator("#cycleDateCards .cycle-card-basis").all_inner_texts().count(
           "Начало: дата создания сделки в CRM")==3,
           f"{width}: CRM proxy dates must remain 3")
        ok(page.locator("#cycleDateCards .cycle-card-basis").all_inner_texts().count(
           "Начало: дата обращения из маркетингового отчёта")==10,
           f"{width}: report dates must remain 10")
        for reg,hint in [
            (".cycle-timeline-wrap","#cycleTimelineHint"),
            (".cycle-table-scroll","#cycleTableHint")
        ]:
            region=page.locator(reg)
            ok(region.get_attribute("tabindex")=="0",
               f"{width}/{reg}: keyboard access missing")
            sizes=region.evaluate("e=>({scroll:e.scrollWidth,client:e.clientWidth})")
            has_overflow=region.is_visible() and sizes["scroll"]>sizes["client"]+2
            ok(page.locator(hint).is_visible()==has_overflow,
               f"{width}/{reg}: misleading horizontal-scroll hint {sizes}")

        if width<=600:
            ok(page.locator("#cycleTimelineCards").is_visible(),
               f"{width}: mobile timeline hidden")
            ok(page.locator("#cycleDateCards").is_visible(),
               f"{width}: mobile date cards hidden")
            ok(not page.locator(".cycle-timeline-wrap").is_visible(),
               f"{width}: timeline table should be replaced")
            ok(not page.locator(".cycle-table-scroll").is_visible(),
               f"{width}: wide 7-column table should be replaced")
            a=page.locator(".cycle-kpi").nth(0).bounding_box()
            b=page.locator(".cycle-kpi").nth(1).bounding_box()
            ok(a and b and abs(a["x"]-b["x"])<2,
               f"{width}: KPI cards should stack")
        else:
            ok(page.locator(".cycle-timeline-wrap").is_visible(),
               f"{width}: desktop timeline hidden")
            ok(page.locator(".cycle-table-scroll").is_visible(),
               f"{width}: audit table hidden")
            ok(not page.locator("#cycleTimelineCards").is_visible(),
               f"{width}: mobile timeline showing on desktop")
            ok(not page.locator("#cycleDateCards").is_visible(),
               f"{width}: mobile date cards showing on desktop")
            if width<=1190:
                a=page.locator(".cycle-kpi").nth(0).bounding_box()
                b=page.locator(".cycle-kpi").nth(1).bounding_box()
                ok(a and b and abs(a["x"]-b["x"])>20,
                   f"{width}: expected two KPI columns")
        if width in (601,720,768,900):
            region=page.locator(".cycle-table-scroll")
            measurements=region.evaluate("e=>({scroll:e.scrollWidth,client:e.clientWidth})")
            ok(measurements["scroll"]>measurements["client"]+2,
               f"{width}: detailed table should scroll inside panel")
            region.evaluate("e=>e.scrollLeft=e.scrollWidth")
            ok(region.evaluate("e=>e.scrollLeft")>0,
               f"{width}: detailed table cannot be horizontally panned")

        if width in (320,390,600,768,1024,1440,1920):
            page.screenshot(path=str(SHOTS/f"cycle-{width}-all.png"),
                            full_page=width in (320,390,768,1440))

        if width in (320,390,768,1440):
            page.locator("#cycleManager").select_option("ilya")
            verify(page,"ilya",width,4,"8,8","6","50","100%","1 868 000 ₽")
            page.locator("#cycleSource").select_option("vk")
            verify(page,"ilya-vk",width,1,"23","23","0","100%","363 000 ₽")
            ok("13.08.2026" in txt(page.locator("#cycleDateCards")),
               f"{width}: verified CRM date missing")
            page.screenshot(path=str(SHOTS/f"cycle-{width}-ilya-vk.png"),
                            full_page=width in (320,390,768))
            page.locator("#cycleReset").click()
            verify(page,"all",width,13,"11,5","9","46,2","100%","5 643 000 ₽")

            page.locator("#cycleSource").select_option("avito")
            verify(page,"avito",width,8,"13,1","9,5","37,5","100%","3 349 000 ₽")
            page.locator("#cycleReset").click()

            page.locator("#cycleSource").select_option("other")
            verify(page,"other",width,0,"","","","0%","0 ₽")
            ok(page.locator("#cycleDateCards .cycle-no-data").count()==1,
               f"{width}: expected empty mobile date message")
            page.locator("#cycleReset").click()
        # Sorting is independent of financial filters and changes both views.
        page.locator("#cycleSort").select_option("shortest")
        ok("04.09.2026" in txt(page.locator("#cycleTimelineCards .cycle-contract-card").first),
           f"{width}: shortest cycle should be first on mobile")
        ok(txt(page.locator("#cycleTimeline .cycle-timeline-row").first.locator(".cycle-days"))=="0",
           f"{width}: sorted original timeline not updated")
        page.locator("#cycleSort").select_option("date")
        ok("02.09.2026" in txt(page.locator("#cycleTimelineCards .cycle-contract-card").first),
           f"{width}: date ascending sort not reflected in mobile")
        page.locator("#cycleReset").click()
        ok(txt(page.locator("#cycleTimeline .cycle-timeline-row").first.locator(".cycle-days"))=="44",
           f"{width}: reset to longest expected")
        page.close()

    nojs=browser.new_context(viewport={"width":360,"height":800},java_script_enabled=False)
    page=nojs.new_page()
    page.goto(f"{BASE}/cycle.html",wait_until="load")
    ok(page.locator("#bv-primary-nav").is_visible(),
       "No-JS fallback must keep navigation usable")
    ok(page.locator(".cycle-timeline-wrap").is_visible(),
       "No-JS must not hide original timeline")
    ok(page.locator(".cycle-table-scroll").is_visible(),
       "No-JS must not hide original audit table")
    nojs.close()

    touch=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=2,
                              is_mobile=True,has_touch=True)
    page=touch.new_page()
    page.goto(f"{BASE}/cycle.html",wait_until="load")
    page.locator("html.bv-cycle-ready").wait_for(state="attached")
    page.locator("#cycleManager").select_option("ilya")
    ok("1 868 000 ₽" in txt(page.locator("#cycleDateCards .cycle-cards-total")),
       "Touch: Ilya revenue mismatch")
    page.locator("#cycleReset").tap()
    ok("5 643 000 ₽" in txt(page.locator("#cycleDateCards .cycle-cards-total")),
       "Touch: reset lost company total")
    page.close();touch.close()
    browser.close()

print(f"PASS: {checks} cycle-time and responsive assertions on "
      f"{len(WIDTHS)} widths; {len(list(SHOTS.glob('*.png')))} screenshots.")
