#!/usr/bin/env python3
"""Bani Vyatki Analytics / Iteration 06: managers responsive browser QA.

Chromium test of real local HTML and JS. No CRM access or file writes by app.
Requires playwright==1.56.0 and its installed Chromium binary.
"""
from __future__ import annotations
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("BV_PREVIEW_BASE","http://127.0.0.1:8765").rstrip("/")
WIDTHS=[320,360,390,430,520,600,601,720,768,900,1024,1140,1200,1440,1920]
SHOTS=Path("artifacts/managers")
SHOTS.mkdir(parents=True,exist_ok=True)
checks=0

def ok(value,message):
    global checks
    if not value:
        raise AssertionError(message)
    checks+=1

def text(node):
    return " ".join(node.inner_text().split())

def money(page):
    return text(page.locator("#mgrRevenueTotal"))

def assert_totals(page, who, source, count, revenue, display_rows, source_cards):
    ok(page.locator("#mgrPerson").input_value()==who,f"{who}/{source}: employee filter")
    ok(page.locator("#mgrSource").input_value()==source,f"{who}/{source}: source filter")
    ok(text(page.locator("#mgrDealsCount"))==count,f"{who}/{source}: deal count")
    ok(money(page)==revenue,f"{who}/{source}: revenue total {money(page)}")
    ok(page.locator("#mgrTable tr").count()==display_rows,
       f"{who}/{source}: manager rows")
    ok(page.locator("#mgrSummaryCards .mgr-summary-card").count()==display_rows,
       f"{who}/{source}: summary mobile card parity")
    ok(page.locator("#mgrMatrixCards .mgr-matrix-card").count()==source_cards,
       f"{who}/{source}: source matrix mobile parity")
    ok(page.locator("#mgrDealsTotals tr").count()==1,
       f"{who}/{source}: detailed sales footer")
    ok(page.locator("#mgrDealsTotals tr").inner_text().strip().endswith("—"),
       f"{who}/{source}: unknown deal margin must remain missing")
    ok(page.locator("#mgrDealCards .mgr-mobile-total").count()==1,
       f"{who}/{source}: missing mobile deal totals")
    ok("Маржа: нет данных" in text(page.locator("#mgrDealCards .mgr-mobile-total")),
       f"{who}/{source}: missing margin is not zero")
    ok(page.locator("#mgrResetFilters").is_disabled()==(who=="all" and source=="all"),
       f"{who}/{source}: reset state")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
    for width in WIDTHS:
        page=browser.new_page(viewport={"width":width,"height":850},device_scale_factor=1)
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        response=page.goto(f"{BASE}/managers.html",wait_until="load",timeout=30000)
        ok(response is not None and response.status==200, f"{width}: HTTP 200")
        page.locator("html.bv-managers-ready").wait_for(state="attached")
        ok(not errors,f"{width}: JavaScript errors {errors}")
        sizes=page.evaluate("""() => ({
          html:document.documentElement.scrollWidth,
          body:document.body.scrollWidth,
          client:document.documentElement.clientWidth
        })""")
        ok(sizes["html"]<=sizes["client"]+1,
           f"{width}: document horizontal overflow {sizes}")
        ok(sizes["body"]<=sizes["client"]+1,
           f"{width}: body horizontal overflow {sizes}")
        ok(page.locator(".mgr-kpi").count()==4,f"{width}: four company KPI")
        ok(text(page.locator(".mgr-kpi").nth(0).locator("strong"))=="222",
           f"{width}: inquiries KPI changed")
        ok(text(page.locator(".mgr-kpi").nth(1).locator("strong"))=="122",
           f"{width}: qualified KPI changed")
        ok(text(page.locator(".mgr-kpi").nth(2).locator("strong"))=="13 шт.",
           f"{width}: deals KPI changed")
        ok(text(page.locator(".mgr-kpi").nth(3).locator("strong"))=="5 643 000 ₽",
           f"{width}: revenue KPI changed")
        ok(page.locator("#mgrBars button[data-manager]").count()==4,
           f"{width}: workload manager buttons")
        ok(page.locator("#mgrRevenueBars .mgr-revenue-row").count()==4,
           f"{width}: revenue chart rows")
        ok(page.locator("#mgrPlans .mgr-plan-item").count()==3,
           f"{width}: margin plan count changed")
        ok(page.locator("#mgrSummaryCards .mgr-summary-card").count()==4,
           f"{width}: should render four employee cards")
        ok(page.locator("#mgrSummaryCards .mgr-mobile-total").count()==1,
           f"{width}: should render totals card")
        ok(page.locator("#mgrDealCards .mgr-deal-card").count()==13,
           f"{width}: 13 deal cards missing")
        ok(page.locator("#mgrMatrixCards .mgr-matrix-card").count()==4,
           f"{width}: 4 source matrix cards missing")
        ok(page.locator("#mgrDeals tr").count()==13,
           f"{width}: 13 original detailed rows missing")
        ok(page.locator("#mgrTable tr").count()==4,
           f"{width}: 4 original manager rows missing")
        ok(page.locator("#mgrMatrix tr").count()==4,
           f"{width}: 4 original source matrix rows missing")
        ok(money(page)=="5 643 000 ₽",f"{width}: total sales mismatch")
        ok("Нет данных" in text(page.locator("#mgrSummaryCards .mgr-mobile-total")),
           f"{width}: unknown margin incorrectly omitted")
        ok(page.locator(".mgr-deal-card .is-margin").count()==13,
           f"{width}: all 13 mobile contract margins must be visible")
        ok(all("Не заполнено" in t for t in page.locator(".mgr-deal-card .is-margin").all_inner_texts()),
           f"{width}: missing contract margins silently set to zero")

        for box, hint in [
            (".mgr-table-panel .mgr-table-scroll","#mgrSummaryHint"),
            (".mgr-deals-panel .mgr-table-scroll","#mgrDealsHint"),
            (".mgr-heat-panel .mgr-matrix-scroll","#mgrMatrixHint")
        ]:
            region=page.locator(box)
            ok(region.get_attribute("tabindex")=="0",f"{width}/{box}: keyboard scroll region")
            vis=region.is_visible()
            metrics=region.evaluate("""e=>({client:e.clientWidth,scroll:e.scrollWidth})""")
            must_hint=vis and metrics["scroll"]>metrics["client"]+2
            ok(page.locator(hint).is_visible()==must_hint,
               f"{width}/{box}: inaccurate scroll hint {metrics}")

        if width<=600:
            ok(page.locator("#mgrSummaryCards").is_visible(),f"{width}: missing manager mobile cards")
            ok(page.locator("#mgrDealCards").is_visible(),f"{width}: missing contract mobile cards")
            ok(page.locator("#mgrMatrixCards").is_visible(),f"{width}: missing source mobile cards")
            ok(not page.locator(".mgr-table-panel .mgr-table-scroll").is_visible(),
               f"{width}: 9-column table should be replaced by cards")
            ok(not page.locator(".mgr-deals-panel .mgr-table-scroll").is_visible(),
               f"{width}: deal table should be replaced")
            ok(not page.locator(".mgr-heat-panel .mgr-matrix-scroll").is_visible(),
               f"{width}: source table should be replaced")
            a=page.locator(".mgr-kpi").nth(0).bounding_box()
            b=page.locator(".mgr-kpi").nth(1).bounding_box()
            ok(abs(a["x"]-b["x"])<2,f"{width}: KPI should stack")
            first=page.locator(".mgr-summary-card").first
            ok("2 390 000 ₽" in text(first),
               f"{width}: top performer personal revenue changed")
            ok("Нет данных" in text(first),
               f"{width}: unknown personal margin not shown")
        else:
            ok(not page.locator("#mgrSummaryCards").is_visible(),f"{width}: mobile cards visible")
            ok(page.locator(".mgr-table-panel .mgr-table-scroll").is_visible(),
               f"{width}: summary desktop table hidden")
            ok(page.locator(".mgr-deals-panel .mgr-table-scroll").is_visible(),
               f"{width}: detailed desktop table hidden")
            ok(page.locator(".mgr-heat-panel .mgr-matrix-scroll").is_visible(),
               f"{width}: desktop source matrix hidden")
        if width in (601,720,768):
            region=page.locator(".mgr-table-panel .mgr-table-scroll")
            d=region.evaluate("e=>({client:e.clientWidth,scroll:e.scrollWidth})")
            ok(d["scroll"]>d["client"]+2,f"{width}: financial table expected to scroll")
            region.evaluate("e=>e.scrollLeft=e.scrollWidth")
            ok(region.evaluate("e=>e.scrollLeft")>0,f"{width}: table can't be panned")
        if width in (320,390,600,768,1024,1440,1920):
            page.screenshot(path=str(SHOTS/f"managers-{width}-all.png"),
                            full_page=width in (320,390,768,1440))

        # Always check each source and manager on mobile/tablet/desktop exemplars.
        if width in (320,390,768,1440):
            page.locator("#mgrPerson").select_option("ilya")
            assert_totals(page,"ilya","all","4 договора","1 868 000 ₽",1,1)
            ok(page.locator("#mgrDeals tr").count()==4,f"{width}: Ilya 4 deals")
            page.locator("#mgrSource").select_option("vk")
            assert_totals(page,"ilya","vk","1 договор","363 000 ₽",1,1)
            ok(page.locator("#mgrDeals tr").count()==1,f"{width}: Ilya VK 1 deal")
            if width in (320,390,768,1440):
                page.screenshot(path=str(SHOTS/f"managers-{width}-ilya-vk.png"),
                                full_page=width in (320,390,768))
            page.locator("#mgrResetFilters").click()
            assert_totals(page,"all","all","13 договоров","5 643 000 ₽",4,4)

            page.locator("#mgrSource").select_option("avito")
            assert_totals(page,"all","avito","8 договоров","3 349 000 ₽",4,4)
            ok(page.locator("#mgrDeals tr").count()==8,f"{width}: Avito 8 deals")
            page.locator("#mgrSource").select_option("other")
            assert_totals(page,"all","other","0 договоров","0 ₽",4,4)
            ok(page.locator("#mgrDeals tr").count()==1,
               f"{width}: empty deal table must show placeholder")
            ok(page.locator("#mgrDealCards .mgr-deal-card").count()==0,
               f"{width}: no invented contract on empty source")
            page.locator("#mgrPerson").select_option("mikhail")
            assert_totals(page,"mikhail","other","0 договоров","0 ₽",1,1)
            page.locator("#mgrResetFilters").click()
            assert_totals(page,"all","all","13 договоров","5 643 000 ₽",4,4)

            # Keyboard bar-button rerender must restore focus.
            bar=page.locator('#mgrBars button[data-manager="danil"]')
            bar.focus()
            page.keyboard.press("Enter")
            ok(page.locator("#mgrPerson").input_value()=="danil",f"{width}: bar filter")
            ok(page.locator('#mgrBars button[data-manager="danil"]').evaluate(
                "(el)=>document.activeElement===el"),f"{width}: keyboard focus lost")
            ok(money(page)=="2 390 000 ₽",f"{width}: Danil revenue")
            page.locator("#mgrResetFilters").click()
        page.close()

    # Progressive enhancement fallback: JS unavailable must keep the
    # conventional scrollable tables and accessible navigation on mobile.
    nojs=browser.new_context(viewport={"width":360,"height":800},java_script_enabled=False)
    p=nojs.new_page()
    p.goto(f"{BASE}/managers.html",wait_until="load")
    ok(p.locator("#bv-primary-nav").is_visible(),"No-JS: navigation hidden")
    ok(p.locator(".mgr-table-panel .mgr-table-scroll").is_visible(),
       "No-JS: summary financial table hidden")
    ok(p.locator(".mgr-deals-panel .mgr-table-scroll").is_visible(),
       "No-JS: contract detail table hidden")
    ok(p.locator(".mgr-heat-panel .mgr-matrix-scroll").is_visible(),
       "No-JS: source matrix hidden")
    nojs.close()

    touch=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=2,
                              is_mobile=True,has_touch=True)
    p=touch.new_page()
    p.goto(f"{BASE}/managers.html",wait_until="load")
    p.locator("html.bv-managers-ready").wait_for(state="attached")
    p.locator("#mgrSource").select_option("avito")
    ok(money(p)=="3 349 000 ₽","Touch context: source filter wrong")
    p.locator("#mgrResetFilters").tap()
    ok(money(p)=="5 643 000 ₽","Touch context: reset filter wrong")
    p.close()
    touch.close()
    browser.close()

print(f"PASS: {checks} managers financial and responsive checks at "
      f"{len(WIDTHS)} widths; {len(list(SHOTS.glob('*.png')))} screenshots.")
