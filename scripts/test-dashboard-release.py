#!/usr/bin/env python3
"""Bani Vyatki Analytics — comprehensive responsive release audit, iteration 08.

Uses real pages from localhost, not mocked UI. Covers all five dashboard routes,
inter-page navigation, responsive reflow, selected WCAG-like semantics and
cross-module September facts. Never connects to Bitrix or publishes client data.

Required: Python 3.11+, playwright==1.56.0; Chromium, Firefox, WebKit browsers.
Run: python -m http.server 8765 & python scripts/test-dashboard-release.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BV_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
ENGINE = os.environ.get("BV_BROWSER", "chromium").lower()
if ENGINE not in {"chromium", "firefox", "webkit"}:
    raise ValueError("BV_BROWSER must be chromium, firefox or webkit")

WIDTHS = [320, 360, 390, 768, 1024, 1440, 1920] if ENGINE == "chromium" else [360, 768, 1440]
ROUTES = ["index.html", "sources.html", "sales.html", "managers.html", "cycle.html"]
SELECTORS = {
    "index.html": "html.bv-overview-ready",
    "sources.html": "html.bv-sources-ready",
    "sales.html": "#stageBars .stage-row",
    "managers.html": "html.bv-managers-ready",
    "cycle.html": "html.bv-cycle-ready",
}
SHOTS = Path("artifacts/final-qa") / ENGINE
SHOTS.mkdir(parents=True, exist_ok=True)
assertions = 0
samples: list[dict] = []
warnings: list[str] = []


def chk(value: bool, reason: str):
    global assertions
    if not value:
        raise AssertionError(f"[{ENGINE}] {reason}")
    assertions += 1


def normal(s: str) -> str:
    return " ".join(s.split())


def txt(page, selector: str) -> str:
    return normal(page.locator(selector).first.inner_text())


def contrast_sample(page, selector, minimum=4.5):
    """Sample visible text against nearest flat computed ancestor background.

    A deliberately narrow machine check: transparent/gradient/translucent
    backgrounds can be composited, so this is NOT a full WCAG color audit.
    """
    return page.locator(selector).first.evaluate("""(element) => {
      const parse=(s)=>{
        const m=(s||"").match(/rgba?\\(([\\d.]+)[, ]+([\\d.]+)[, ]+([\\d.]+)(?:[, /]+([\\d.]+))?\\)/);
        return m ? [+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]] : null;
      };
      const lum=rgb=>{
        const r=rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
        return .2126*r[0]+.7152*r[1]+.0722*r[2];
      };
      const fg=parse(getComputedStyle(element).color);
      let node=element, background=null;
      while(node){
        const style=getComputedStyle(node),b=parse(style.backgroundColor);
        if(b && b[3] >= .99){ background=b; break; }
        node=node.parentElement;
      }
      if(!background)background=[255,255,255,1];
      const ratio=(Math.max(lum(fg),lum(background))+.05)/(Math.min(lum(fg),lum(background))+.05);
      return {ratio:Number(ratio.toFixed(2)),fg:String(getComputedStyle(element).color),
        bg:background,content:element.textContent.trim().slice(0,90)};
    }""")


def wait_route(page, route):
    page.locator(SELECTORS[route]).first.wait_for(state="attached", timeout=10000)


def common(page, route, width):
    global warnings
    chk(page.locator("main").count()==1, f"{route}/{width}: exactly one main landmark")
    chk(page.locator("main h1").count()==1, f"{route}/{width}: exactly one page h1")
    chk(page.locator("#bv-primary-nav a[href]").count()==5, f"{route}/{width}: 5 live page links")
    chk(page.locator('#bv-primary-nav a[aria-current="page"]').count()==1,
        f"{route}/{width}: one active navigation item")
    chk(page.locator('#bv-primary-nav a[aria-current="page"]').get_attribute("href")=="./"+route,
        f"{route}/{width}: active page link points to wrong route")
    chk(page.locator("#bv-primary-nav .nav-link.pending").count()==1,
        f"{route}/{width}: one disabled future section")
    chk(page.locator("#bv-primary-nav .nav-link.pending").get_attribute("href") is None,
        f"{route}/{width}: future section must not be a false link")
    chk(page.locator(".sidebar .brand img[alt]").count()==1,
        f"{route}/{width}: logo accessible text missing")
    chk(page.locator(".topbar").count()==1, f"{route}/{width}: topbar missing")
    chk(page.locator(".sidebar").count()==1, f"{route}/{width}: sidebar missing")
    metrics=page.evaluate("""() => ({
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth
    })""")
    chk(metrics["html"]<=metrics["viewport"]+1,
        f"{route}/{width}: HTML horizontal overflow {metrics}")
    chk(metrics["body"]<=metrics["viewport"]+1,
        f"{route}/{width}: body horizontal overflow {metrics}")
    menu=page.locator(".bv-menu-toggle")
    nav=page.locator("#bv-primary-nav")
    if width<=720:
        chk(menu.is_visible(), f"{route}/{width}: mobile menu toggle invisible")
        chk(not nav.is_visible(), f"{route}/{width}: mobile menu initially open")
        chk(menu.get_attribute("aria-expanded")=="false",
            f"{route}/{width}: expanded state mismatch")
    else:
        chk(nav.is_visible(), f"{route}/{width}: desktop/tablet navigation absent")
        chk(not menu.is_visible(), f"{route}/{width}: mobile toggle visible on desktop")

    # Primary content text must be readable against its nearest solid background.
    # This is a targeted control, not a complete accessibility certification.
    for selector, threshold in [("main h1",3.0),("main .subtitle",4.5)]:
        if page.locator(selector).count():
            reading=contrast_sample(page,selector)
            samples.append({"browser":ENGINE,"route":route,"width":width,
                            "selector":selector,**reading})
            chk(reading["ratio"]>=threshold,
                f"{route}/{width}: {selector} contrast {reading['ratio']}:1 < {threshold}:1")
    for selector in ("main select",):
        for i in range(page.locator(selector).count()):
            input=page.locator(selector).nth(i)
            chk(input.get_attribute("id") is not None,
                f"{route}/{width}: select without ID")
            id_=input.get_attribute("id")
            has_label=page.locator('label[for="'+id_+'"]').count()>0 or \
                input.evaluate("(el)=>!!el.closest('label')")
            chk(has_label, f"{route}/{width}: select #{id_} missing visible label")


def modules(page, route, width):
    if route=="index.html":
        chk(page.locator(".kpi").count()==4,f"{route}/{width}: KPI missing")
        chk(txt(page,'[data-plan="revenue"]')=="6 240 000 ₽",
            f"{route}/{width}: realistic plan changed")
        chk(txt(page,'[data-pct="revenue"]')=="90,4%",f"{route}/{width}: plan % changed")
        chk("5 643 000 ₽" in normal(page.locator(".kpi").first.inner_text()),
            f"{route}/{width}: revenue changed")
        page.locator("#scenario").select_option("optimistic")
        chk(txt(page,'[data-plan="revenue"]')=="9 360 000 ₽",
            f"{route}/{width}: optimistic plan changed")
        chk(txt(page,'[data-pct="revenue"]')=="60,3%",
            f"{route}/{width}: optimistic percent changed")
        page.locator("#scenario").select_option("realistic")
        chk(page.locator("#company-cards .plan-mobile-card").count()==6,
            f"{route}/{width}: company cards changed")
        chk(page.locator("#avito-cards .plan-mobile-card").count()==5,
            f"{route}/{width}: Avito cards changed")
    elif route=="sources.html":
        chk(txt(page,"#totalKpi")=="222",f"{route}/{width}: 222 CRM inquiries")
        chk(txt(page,"#qualifiedKpi")=="122",f"{route}/{width}: 122 qualified")
        chk(page.locator("#dailyChart rect[data-day]").count()==30,
            f"{route}/{width}: 30 days missing")
        page.locator("#sourceFilter").select_option("avito")
        chk(txt(page,"#totalKpi")=="167" and txt(page,"#qualifiedKpi")=="107",
            f"{route}/{width}: Avito source changed")
        page.locator("#sourceFilter").select_option("all")
        page.locator("#nextDay").click()
        chk(txt(page,"#selectedDayLabel")=="15 сентября",
            f"{route}/{width}: day navigation")
        page.locator("#resetDay").click()
    elif route=="sales.html":
        chk(page.locator(".sales-kpi").count()==4,f"{route}/{width}: KPI count")
        chk("5 643 000" in txt(page,".sales-kpi:nth-child(2) strong"),
            f"{route}/{width}: contract revenue")
        chk(txt(page,"#cohortTotal")=="222 обращения",
            f"{route}/{width}: September cohort")
        chk(txt(page,"#qualifiedStageCount")=="122",
            f"{route}/{width}: qualified cohort")
        chk(page.locator("#stageBars .stage-row").count()==8,
            f"{route}/{width}: 8 stage groups")
        page.locator("#pipelineSource").select_option("avito")
        chk(txt(page,"#cohortTotal")=="167 обращений",
            f"{route}/{width}: Avito cohort")
        page.locator("#resetPipelineSource").click()
        page.locator("#metricRevenue").click()
        chk(txt(page,"#trendDiff")=="+2 000 100 ₽",
            f"{route}/{width}: revenue trend")
    elif route=="managers.html":
        chk(txt(page,"#mgrRevenueTotal")=="5 643 000 ₽",
            f"{route}/{width}: full contract revenue")
        chk(page.locator("#mgrDeals .known-sales").count()==13,
            f"{route}/{width}: 13 attributed deals")
        chk(page.locator("#mgrDealCards .mgr-deal-card").count()==13,
            f"{route}/{width}: 13 mobile deal cards")
        chk(page.locator("#mgrDealCards .is-margin").count()==13,
            f"{route}/{width}: unknown deal margin placeholders")
        chk("Нет данных" in txt(page,"#mgrSummaryCards .mgr-mobile-total"),
            f"{route}/{width}: company margin must not be allocated")
        page.locator("#mgrPerson").select_option("ilya")
        chk(txt(page,"#mgrRevenueTotal")=="1 868 000 ₽",
            f"{route}/{width}: Ilya attribution")
        page.locator("#mgrResetFilters").click()
    elif route=="cycle.html":
        chk(txt(page,"#cycleAverage")=="11,5 дн.",
            f"{route}/{width}: mean 150/13 changed")
        chk(txt(page,"#cycleMedian")=="9 дн.",
            f"{route}/{width}: median changed")
        chk(page.locator("#cycleDateCards .cycle-contract-card").count()==13,
            f"{route}/{width}: 13 dated sales missing")
        chk(page.locator("#cycleDateCards .cycle-card-basis").count()==13,
            f"{route}/{width}: date basis missing")
        chk(txt(page,"#cycleDistribution .cycle-group:first-child b")=="6",
            f"{route}/{width}: fast deal count")
        page.locator("#cycleManager").select_option("ilya")
        chk(txt(page,"#cycleAverage")=="8,8 дн.",
            f"{route}/{width}: Ilya mean")
        page.locator("#cycleReset").click()
        page.locator("#cycleSort").select_option("shortest")
        chk(txt(page,"#cycleTimeline .cycle-timeline-row:first-child .cycle-days")=="0",
            f"{route}/{width}: cycle sorting")
        page.locator("#cycleReset").click()


def test_navigation(browser, width):
    page=browser.new_page(viewport={"width":width,"height":860})
    failures=[]
    page.on("pageerror",lambda error:failures.append(str(error)))
    for route in ROUTES:
        response=page.goto(f"{BASE}/{route}",wait_until="load",timeout=30000)
        chk(response is not None and response.status==200,
            f"journey/{width}: {route} page not loaded")
        wait_route(page,route)
        chk(not failures,f"journey/{width}: JS errors: {failures}")
        if width<=720:
            page.locator(".bv-menu-toggle").click()
            chk(page.locator("#bv-primary-nav").is_visible(),
                f"journey/{width}: mobile menu can't open")
            chk(page.locator(".bv-menu-toggle").get_attribute("aria-expanded")=="true",
                f"journey/{width}: mobile menu aria state wrong")
            page.keyboard.press("Escape")
            chk(not page.locator("#bv-primary-nav").is_visible(),
                f"journey/{width}: Escape did not close mobile menu")
            page.locator(".bv-menu-toggle").click()
            chk(page.locator("#bv-primary-nav").is_visible(),
                f"journey/{width}: reopened mobile menu absent")
        target=ROUTES[(ROUTES.index(route)+1)%len(ROUTES)]
        page.locator('#bv-primary-nav a[href="./'+target+'"]').click()
        page.wait_for_url("**/"+target)
        wait_route(page,target)
        chk(page.locator('#bv-primary-nav a[aria-current="page"]').get_attribute("href")=="./"+target,
            f"journey/{width}: wrong destination {target}")
    page.close()


def screenshot(page,route,width):
    if width in (360,768,1440):
        page.screenshot(path=str(SHOTS/f"{route[:-5]}-{width}.png"),full_page=True)
    elif width in (320,1920) and route in ("index.html","cycle.html"):
        page.screenshot(path=str(SHOTS/f"{route[:-5]}-{width}.png"),full_page=False)


with sync_playwright() as playwright:
    browser=getattr(playwright,ENGINE).launch(headless=True)
    for width in WIDTHS:
        for route in ROUTES:
            page=browser.new_page(viewport={"width":width,"height":860},device_scale_factor=1)
            errors=[]
            fails=[]
            page.on("pageerror",lambda err:errors.append(str(err)))
            page.on("requestfailed",lambda req:fails.append(req.url+" "+str(req.failure)))
            result=page.goto(f"{BASE}/{route}",wait_until="load",timeout=30000)
            chk(result is not None and result.status==200,f"{route}/{width}: HTTP error")
            wait_route(page,route)
            chk(not errors,f"{route}/{width}: JavaScript errors: {errors}")
            chk(not fails,f"{route}/{width}: asset request failures: {fails}")
            common(page,route,width)
            modules(page,route,width)
            screenshot(page,route,width)
            page.close()

    for viewport in ([360,768,1440] if ENGINE=="chromium" else [360]):
        test_navigation(browser,viewport)

    # Responsive reflow proxy at 200%: effective CSS viewport width is
    # reduced from 640 to 320. This is NOT the same as a real OS/browser zoom test.
    if ENGINE=="chromium":
        for route in ROUTES:
            page=browser.new_page(viewport={"width":640,"height":850})
            page.goto(f"{BASE}/{route}",wait_until="load")
            wait_route(page,route)
            page.set_viewport_size({"width":320,"height":850})
            page.wait_for_timeout(80)
            sizes=page.evaluate("""() => ({
              scroll:document.documentElement.scrollWidth,
              client:document.documentElement.clientWidth
            })""")
            chk(sizes["scroll"]<=sizes["client"]+1,
                f"reflow/200%-proxy/{route}: overflow {sizes}")
            page.screenshot(path=str(SHOTS/f"reflow-{route[:-5]}.png"),full_page=False)
            page.close()

        # Browser honors reduced motion for animated chart bars/progress.
        page=browser.new_page(viewport={"width":360,"height":860},reduced_motion="reduce")
        page.goto(f"{BASE}/index.html",wait_until="load")
        page.locator("html.bv-overview-ready").wait_for(state="attached")
        duration=page.locator(".progress-fill").first.evaluate("(el)=>getComputedStyle(el).transitionDuration")
        chk(duration in ("0s","0.00001s","0.01ms"),
            "reduced motion: animated KPI progress remains active: "+duration)
        page.close()

        # Without JavaScript the navigation is still reachable on every page.
        ctx=browser.new_context(viewport={"width":360,"height":860},java_script_enabled=False)
        for route in ROUTES:
            page=ctx.new_page()
            page.goto(f"{BASE}/{route}",wait_until="load")
            chk(page.locator("#bv-primary-nav").is_visible(),
                "no-JS navigation absent: "+route)
            chk(not page.locator(".bv-menu-toggle").is_visible(),
                "inert no-JS menu button visible: "+route)
            page.close()
        ctx.close()

    browser.close()

summary={
    "browser":ENGINE,
    "routes":ROUTES,
    "widths":WIDTHS,
    "checks_passed":assertions,
    "screenshots":len(list(SHOTS.glob("*.png"))),
    "contrast_samples":samples,
    "warnings":warnings,
    "scope_note":"Computed contrast samples and CSS-width reflow proxy; not WCAG certification or native 200% browser zoom.",
}
(SHOTS/"qa-results.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"PASS [{ENGINE}]: {assertions} end-to-end responsive assertions across "
      f"{len(ROUTES)} routes × {len(WIDTHS)} widths; "
      f"{len(list(SHOTS.glob('*.png')))} screenshots.")
