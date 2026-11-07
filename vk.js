"use strict";
/* Bani Vyatki Analytics — раздел 06 «ВКонтакте» (прототип, итерация 1).
 * Все значения берутся из window.BV_VK (vk-data.js). null = данные ещё не выгружены. */
(() => {
  const data = window.BV_VK;
  if (!data || !Array.isArray(data.months)) return;
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0});
  const fmt = n => (n === null || n === undefined) ? "—" : nf.format(n);
  const pct = (n, d = 1) => (n === null || n === undefined) ? "—" :
    new Intl.NumberFormat("ru-RU", {minimumFractionDigits: d, maximumFractionDigits: d}).format(n * 100) + "%";
  const rub = n => (n === null || n === undefined) ? "—" :
    new Intl.NumberFormat("ru-RU", {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(n) + " ₽";
  const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + nf.format(Math.abs(n));
  const SVG = "http://www.w3.org/2000/svg";
  const FORMATS = [
    {id: "posts", name: "Посты"}, {id: "clips", name: "Клипы"},
    {id: "stories", name: "Истории"}, {id: "video", name: "Видео"}
  ];
  const months = data.months;
  const state = {month: months.length - 1, top: "reach"};

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  function svg(tag, attrs, text) {
    const n = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  const prevOf = i => i > 0 ? months[i - 1] : data.reference;
  function change(cur, prev) {
    if (cur === null || prev === null || prev === undefined || prev === 0) return null;
    return cur / prev - 1;
  }
  function pendingNote(text) { return el("span", "vk-pending", text || "ждём выгрузку"); }

  /* ---------- month switch ---------- */
  function drawSwitch() {
    const wrap = $("vkMonthSwitch");
    // Buttons are created once and only change state: keyboard focus is never lost.
    if (wrap.children.length !== months.length) {
      wrap.replaceChildren();
      months.forEach((m, i) => {
        const b = el("button", "", m.name);
        b.type = "button";
        b.addEventListener("click", () => { state.month = i; renderMonth(); });
        wrap.append(b);
      });
    }
    [...wrap.children].forEach((b, i) => {
      b.classList.toggle("active", i === state.month);
      b.setAttribute("aria-pressed", String(i === state.month));
    });
  }

  /* ---------- KPI ---------- */
  function kpi(glyph, color, title, value, unit, trend, trendClass, foot) {
    const a = el("article", "vk-kpi");
    const top = el("div", "vk-kpi-top");
    top.append(el("span", "vk-glyph " + color, glyph));
    if (trend) top.append(el("span", "vk-trend " + trendClass, trend));
    const strong = el("strong", "", value + " ");
    if (unit) strong.append(el("small", "", unit));
    a.append(top, el("h2", "", title), strong, el("p", "", foot));
    return a;
  }
  function drawKpis() {
    const m = months[state.month], p = prevOf(state.month), a = m.audience, c = m.content.formats;
    const wrap = $("vkKpis");
    const pc = c.posts.count + c.clips.count;
    const [lo, hi] = [data.norms.posts[0] + data.norms.clips[0], data.norms.posts[1] + data.norms.clips[1]];
    const normState = pc < lo ? ["ниже нормы " + lo + "–" + hi, "negative"] : pc > hi ? ["выше нормы " + lo + "–" + hi, "positive"] : ["в норме " + lo + "–" + hi, "positive"];
    const subChange = change(a.subscribed, p.audience.subscribed);
    const msgChange = change(a.firstMessages, p.audience.firstMessages);
    const DATIVE = {"Июнь": "июню", "Июль": "июлю", "Август": "августу", "Сентябрь": "сентябрю", "Октябрь": "октябрю", "Ноябрь": "ноябрю", "Декабрь": "декабрю"};
    const trendText = v => v === null ? "" : (v >= 0 ? "↗ +" : "↘ −") + pct(Math.abs(v)) + " к " + (DATIVE[p.name] || p.name.toLowerCase());
    wrap.replaceChildren(
      kpi("◎", "green", "Подписчиков на конец месяца", fmt(a.end), "чел.", signed(a.net) + " за месяц", a.net >= 0 ? "positive" : "negative",
        "На начало месяца: " + fmt(a.start)),
      kpi("◉", "green", "Итого охват за месяц", fmt(a.reachTotal), "", trendText(change(a.reachTotal, p.audience.reachTotal)),
        change(a.reachTotal, p.audience.reachTotal) === null || change(a.reachTotal, p.audience.reachTotal) >= 0 ? "positive" : "negative",
        "Посты, клипы, истории и видео вместе"),
      kpi("↗", "gold", "Подписались", fmt(a.subscribed), "чел.", trendText(subChange), subChange === null || subChange >= 0 ? "positive" : "negative",
        "Отписались: " + fmt(a.unsubscribed) + " · с рекламы: " + (a.fromAds === null ? "ждём выгрузку" : fmt(a.fromAds))),
      kpi("▤", "olive", "Постов и клипов", fmt(pc), "шт.", normState[0], normState[1],
        "Истории: " + fmt(c.stories.count) + " · видео: " + fmt(c.video.count) + (m.content.complete ? "" : " · учтено по 20.10")),
      kpi("✉", "brown", "Первые сообщения", fmt(a.firstMessages), "чел.", trendText(msgChange), msgChange === null || msgChange >= 0 ? "positive" : "negative",
        "Начатые переписки — ещё не заявки")
    );
    ["subscribers", "reach", "subscribed", "content", "messages"].forEach((k, n) => { wrap.children[n].dataset.kpi = k; });
  }

  /* ---------- daily subscribers line ---------- */
  function drawLine() {
    const host = $("vkLine");
    const W = Math.max(280, Math.round(host.clientWidth || 760)), H = W < 520 ? 230 : 270, L = W < 520 ? 40 : 46, R = 14, T = 22, B = 30;
    const pts = data.daily.map(([d, v]) => [new Date(d + "T00:00:00"), v]);
    const t0 = pts[0][0].getTime(), t1 = pts[pts.length - 1][0].getTime();
    const vals = pts.map(p => p[1]);
    const yMin = Math.floor((Math.min(...vals) - 20) / 50) * 50, yMax = Math.ceil((Math.max(...vals) + 20) / 50) * 50;
    const x = t => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y = v => T + (yMax - v) / (yMax - yMin) * (H - T - B);
    const summary = "Подписчики по дням: " + months.map(m => m.name.toLowerCase() + " — " + fmt(m.audience.end) + " на конец месяца").join(", ") + ".";
    const root = svg("svg", {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "vk-line-svg", role: "img", "aria-label": summary});
    const step = W < 520 ? 100 : 50;
    for (let v = yMin; v <= yMax; v += step) {
      root.append(svg("line", {x1: L, x2: W - R, y1: y(v), y2: y(v), class: "vk-grid-line"}));
      root.append(svg("text", {x: L - 8, y: y(v) + 4, class: "vk-axis", "text-anchor": "end"}, fmt(v)));
    }
    const sel = months[state.month];
    const ms = new Date(sel.id + "-01T00:00:00").getTime();
    const me = new Date(new Date(ms).getFullYear(), new Date(ms).getMonth() + 1, 0).getTime();
    root.append(svg("rect", {x: x(Math.max(ms, t0)), y: T, width: x(me) - x(Math.max(ms, t0)), height: H - T - B, class: "vk-sel-band"}));
    data.adPeriods.forEach(([a, b]) => {
      const xa = x(new Date(a + "T00:00:00").getTime()), xb = x(new Date(b + "T00:00:00").getTime() + 864e5 * .9);
      root.append(svg("rect", {x: xa, y: T, width: Math.max(2, xb - xa), height: H - T - B, class: "vk-ad-band"}));
    });
    const area = pts.map((p, i) => (i ? "L" : "M") + x(p[0].getTime()).toFixed(1) + " " + y(p[1]).toFixed(1)).join(" ");
    root.append(svg("path", {d: area + ` L ${x(t1)} ${H - B} L ${x(t0)} ${H - B} Z`, class: "vk-area"}));
    root.append(svg("path", {d: area, class: "vk-line"}));
    months.forEach((m, i) => {
      const d = new Date(m.id + "-15T00:00:00").getTime();
      root.append(svg("text", {x: x(d), y: H - 8, class: "vk-axis" + (i === state.month ? " is-current" : ""), "text-anchor": "middle"}, W < 520 ? m.label.toLowerCase() : m.name.toLowerCase()));
      const endDay = pts.filter(p => p[0].getMonth() === new Date(d).getMonth()).pop();
      if (endDay) {
        const cx = x(endDay[0].getTime()), cy = y(endDay[1]);
        root.append(svg("circle", {cx, cy, r: 4.5, class: "vk-point" + (i === state.month ? " is-current" : "")}));
        root.append(svg("text", {x: cx - (i === months.length - 1 ? 4 : 0), y: cy - 10, class: "vk-point-label", "text-anchor": i === months.length - 1 ? "end" : "middle"}, fmt(endDay[1])));
      }
    });
    root.append(svg("text", {x: x(t0) + 2, y: y(pts[0][1]) - 10, class: "vk-point-label"}, fmt(pts[0][1])));
    host.replaceChildren(root);
  }
  // The chart is drawn for the real container width (no horizontal scroll, readable labels).
  let lineWidth = 0, lineFrame = 0;
  function watchLine() {
    const host = $("vkLine");
    const redraw = () => {
      cancelAnimationFrame(lineFrame);
      lineFrame = requestAnimationFrame(() => {
        const w = Math.round(host.clientWidth);
        if (w && Math.abs(w - lineWidth) > 2) { lineWidth = w; drawLine(); }
      });
    };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(host);
    else window.addEventListener("resize", redraw);
  }

  /* ---------- monthly flows ---------- */
  function drawFlow() {
    const wrap = $("vkFlow");
    wrap.replaceChildren();
    wrap.setAttribute("aria-label", "Подписки по месяцам: " + months.map(m => m.name.toLowerCase() + " — подписались " + fmt(m.audience.subscribed) +
      (m.audience.fromAds ? " (с рекламы " + fmt(m.audience.fromAds) + ")" : "") + ", отписались " + fmt(m.audience.unsubscribed)).join("; ") + ".");
    const ceiling = Math.max(...months.map(m => m.audience.subscribed));
    months.forEach((m, i) => {
      const a = m.audience, col = el("div", "vk-flow-col" + (i === state.month ? " is-current" : ""));
      col.append(el("span", "vk-flow-net", signed(a.net)));
      const bars = el("div", "vk-flow-bars");
      const sub = el("div", "vk-flow-stack");
      const ads = a.fromAds || 0, org = a.subscribed - ads;
      const h = v => Math.max(v ? 3 : 0, Math.round(170 * v / ceiling)) + "px";
      const segA = el("i", "vk-seg ads"); segA.style.height = h(ads); if (ads) segA.title = "С рекламы: " + ads;
      const segO = el("i", "vk-seg organic"); segO.style.height = h(org); segO.title = "Остальные: " + org;
      sub.append(el("b", "vk-flow-val", fmt(a.subscribed)), segA, segO);
      const un = el("div", "vk-flow-stack");
      const segU = el("i", "vk-seg unsub"); segU.style.height = h(a.unsubscribed);
      un.append(el("b", "vk-flow-val muted", fmt(a.unsubscribed)), segU);
      bars.append(sub, un);
      col.append(bars, el("span", "vk-flow-label", m.label));
      if (ads) col.title = `${m.name}: подписались ${a.subscribed} (с рекламы ${ads}), отписались ${a.unsubscribed}`;
      wrap.append(col);
    });
  }

  /* ---------- total monthly reach ---------- */
  const REACH_FORMATS = [["posts", "Посты"], ["clips", "Клипы"], ["stories", "Истории"], ["video", "Видео"]];
  function drawTotal() {
    const i = state.month, wrap = $("vkTotal");
    wrap.replaceChildren();
    wrap.setAttribute("aria-label", "Итого охват по месяцам: " + months.map(m => m.name.toLowerCase() + " — " + fmt(m.audience.reachTotal)).join(", ") + ".");
    const ceiling = Math.max(...months.map(m => m.audience.reachTotal));
    months.forEach((m, j) => {
      const a = m.audience, prev = prevOf(j).audience.reachTotal, ch = change(a.reachTotal, prev);
      const col = el("div", "vk-total-col" + (j === i ? " is-current" : ""));
      col.append(el("span", "vk-total-change " + (ch === null ? "" : ch >= 0 ? "up" : "down"), ch === null ? "" : (ch >= 0 ? "+" : "−") + pct(Math.abs(ch), 0)));
      col.append(el("b", "vk-total-val", fmt(a.reachTotal)));
      const stack = el("div", "vk-total-stack");
      stack.style.height = Math.max(6, Math.round(190 * a.reachTotal / ceiling)) + "px";
      REACH_FORMATS.slice().reverse().forEach(([f, name]) => {
        const v = a.reachByFormat[f], seg = el("i", "vk-seg f-" + f);
        seg.style.flexGrow = String(v);
        seg.title = name + ": " + fmt(v);
        stack.append(seg);
      });
      col.append(stack, el("span", "vk-flow-label", m.label));
      col.title = m.name + ": итого " + fmt(a.reachTotal);
      wrap.append(col);
    });
    const m = months[i], a = m.audience, pv = prevOf(i), pa = pv.audience;
    const d = $("vkTotalDetail");
    d.replaceChildren();
    const ch = change(a.reachTotal, pa.reachTotal);
    const head = el("div", "vk-total-head");
    const totalStrong = el("strong", "", fmt(a.reachTotal)); totalStrong.id = "vkTotalValue";
    head.append(el("span", "", m.name + " 2026"), totalStrong,
      el("span", "vk-trend " + (ch === null || ch >= 0 ? "positive" : "negative"), ch === null ? "—" : (ch >= 0 ? "↗ +" : "↘ −") + pct(Math.abs(ch)) + " к прошлому месяцу"));
    const list = el("ul", "vk-total-list");
    REACH_FORMATS.forEach(([f, name]) => {
      const v = a.reachByFormat[f], share = v / a.reachTotal;
      const prevV = pv.audience.reachByFormat ? pv.audience.reachByFormat[f] : null;
      const fc = change(v, prevV);
      const li = el("li");
      const bar = el("span", "vk-share"); const fill = el("i", "f-" + f); fill.style.width = (share * 100).toFixed(1) + "%"; bar.append(fill);
      li.append(el("span", "vk-total-name", name), bar, el("b", "", fmt(v)), el("small", "", pct(share, 0)),
        el("em", fc === null ? "" : fc >= 0 ? "up" : "down", fc === null ? "" : (fc >= 0 ? "+" : "−") + pct(Math.abs(fc), 0)));
      list.append(li);
    });
    d.append(head, list, el("p", "vk-ads-caption", "Один человек мог попасть в охват в разные дни и через разные форматы, поэтому это не число уникальных людей, а объём показов аудитории. Сравнивать месяцы между собой корректно."));
  }

  /* ---------- plan / fact ---------- */
  function drawPlan() {
    const m = months[state.month], wrap = $("vkPlan");
    wrap.replaceChildren();
    const badge = $("vkPlanBadge");
    badge.hidden = m.content.complete;
    badge.textContent = "Учтено по 20.10 · ждём выгрузку";
    FORMATS.forEach(f => {
      const fact = m.content.formats[f.id].count, [lo, hi] = data.norms[f.id];
      const max = Math.max(hi * 1.6, fact * 1.1, 1);
      const row = el("div", "vk-plan-row");
      const head = el("div", "vk-plan-head");
      head.append(el("span", "vk-plan-name", f.name), el("span", "vk-plan-norm", "норма " + (lo === hi ? lo : lo + "–" + hi) + " в месяц"));
      const st = fact < lo ? ["ниже нормы", "below"] : fact > hi ? ["выше нормы", "above"] : ["в норме", "ok"];
      const val = el("div", "vk-plan-val");
      val.append(el("strong", "", fmt(fact)), el("span", "vk-status " + st[1], st[0]));
      const track = el("div", "vk-plan-track");
      const zone = el("span", "vk-plan-zone"); zone.style.left = (lo / max * 100) + "%"; zone.style.width = Math.max(1.2, (hi - lo) / max * 100) + "%";
      const bar = el("i", "vk-plan-fill " + st[1]); bar.style.width = (fact / max * 100) + "%";
      track.append(zone, bar);
      track.setAttribute("aria-hidden", "true");
      row.append(head, val, track);
      wrap.append(row);
    });
  }

  /* ---------- calendar ---------- */
  function drawCalendar() {
    const m = months[state.month], wrap = $("vkCalendar");
    const [Y, Mo] = m.id.split("-").map(Number);
    const first = new Date(Y, Mo - 1, 1), days = new Date(Y, Mo, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const sets = Object.fromEntries(FORMATS.map(f => [f.id, new Set(m.content.formats[f.id].days)]));
    wrap.replaceChildren();
    ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach(d => wrap.append(el("span", "vk-cal-head", d)));
    for (let i = 0; i < offset; i++) wrap.append(el("span", "vk-cal-empty"));
    let active = 0;
    for (let d = 1; d <= days; d++) {
      const cell = el("span", "vk-cal-day");
      const unknown = !m.content.complete && d > 20;
      if (unknown) cell.classList.add("is-unknown");
      cell.append(el("b", "", d));
      const dots = el("span", "vk-cal-dots");
      const labels = [];
      FORMATS.forEach(f => { if (sets[f.id].has(d)) { dots.append(el("i", "vk-dot " + f.id)); labels.push(f.name.toLowerCase()); } });
      if (labels.length) { cell.classList.add("has-pub"); active++; }
      cell.title = unknown ? d + " — данные ещё не выгружены" : d + (labels.length ? ": " + labels.join(", ") : ": без публикаций");
      cell.append(dots);
      wrap.append(cell);
    }
    const known = m.content.complete ? days : 20;
    $("vkCalSubtitle").textContent = `Дней с публикациями: ${active} из ${known}` + (m.content.complete ? "" : " (учтено по 20.10)");
  }

  /* ---------- formats table + reach stats ---------- */
  function drawFormats() {
    const i = state.month, m = months[i], prev = i > 0 ? months[i - 1] : null;
    const body = $("vkFormats").tBodies[0];
    body.replaceChildren();
    FORMATS.forEach(f => {
      const c = m.content.formats[f.id], pc = prev ? prev.content.formats[f.id] : null;
      const tr = el("tr");
      const th = el("th", "", f.name); th.scope = "row";
      const ch = pc && c.medianReach && pc.medianReach ? c.medianReach / pc.medianReach - 1 : null;
      const chCell = el("td");
      if (ch === null) chCell.textContent = "—";
      else chCell.append(el("span", "result " + (ch >= 0 ? "good" : "bad"), (ch >= 0 ? "+" : "−") + pct(Math.abs(ch), 0)));
      tr.append(th, el("td", "", fmt(c.count)), el("td", "cell-actual", fmt(c.medianReach)), el("td", "", c.medianErr === null ? "—" : pct(c.medianErr)), chCell);
      body.append(tr);
    });
    const stats = $("vkReachStats");
    stats.replaceChildren();
    const mini = (title, key, format, note) => {
      const box = el("div", "mini vk-mini");
      box.append(el("span", "", title), el("b", "", format(m.audience[key])));
      const spark = el("div", "vk-spark");
      const max = Math.max(...months.map(x => x.audience[key] || 0));
      months.forEach((x, j) => {
        const s = el("i", j === i ? "is-current" : "");
        s.style.height = Math.max(3, Math.round(34 * (x.audience[key] || 0) / max)) + "px";
        s.title = x.name + ": " + format(x.audience[key]);
        spark.append(s);
      });
      box.append(spark, el("small", "", note));
      return box;
    };
    stats.append(
      mini("Охват постов среди неподписчиков", "nonSubscriberShare", v => pct(v, 0), "Чем выше доля, тем больше новых людей видят посты")
    );
  }

  /* ---------- top publications ---------- */
  function drawTop() {
    const list = months[state.month].top[state.top], wrap = $("vkTop");
    wrap.replaceChildren();
    if (!list.length) { wrap.append(el("li", "vk-top-empty", "Нет публикаций, подходящих под критерий")); return; }
    list.forEach((t, k) => {
      const li = el("li", "vk-top-item");
      const meta = el("div", "vk-top-meta");
      const d = new Date(t.date + "T00:00:00");
      meta.append(el("span", "vk-top-rank", k + 1), el("span", "vk-top-fmt " + (t.format === "Пост" ? "posts" : "clips"), t.format),
        el("span", "vk-top-date", d.toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit"})));
      const nums = el("div", "vk-top-nums");
      nums.append(el("b", state.top === "reach" ? "is-key" : "", fmt(t.reach) + " охват"), el("b", state.top === "err" ? "is-key" : "", pct(t.err) + " ERR"));
      li.append(meta, el("p", "vk-top-text", t.text), nums);
      wrap.append(li);
    });
  }
  function bindTop() {
    const buttons = {reach: $("vkTopReach"), err: $("vkTopErr")};
    Object.entries(buttons).forEach(([k, b]) => b.addEventListener("click", () => {
      state.top = k;
      Object.entries(buttons).forEach(([kk, bb]) => { bb.classList.toggle("active", kk === k); bb.setAttribute("aria-pressed", String(kk === k)); });
      drawTop();
    }));
  }

  /* ---------- ads ---------- */
  function drawAds() {
    const i = state.month, m = months[i];
    const max = Math.max(...months.map(x => x.ads.spend || 0));
    const bars = $("vkAdsBars");
    bars.replaceChildren();
    bars.setAttribute("aria-label", "Расход на рекламу по месяцам: " + months.map(x => x.name.toLowerCase() + " — " + (x.ads.spend === null ? "нет данных" : rub(Math.round(x.ads.spend)))).join(", ") + ".");
    months.forEach((x, j) => {
      const col = el("div", "vk-ads-col" + (j === i ? " is-current" : ""));
      const known = x.ads.spend !== null;
      col.append(el("span", "vk-ads-val", known ? fmt(Math.round(x.ads.spend)) + " ₽" : "нет данных"));
      const bar = el("i", "vk-ads-bar" + (known ? "" : " is-unknown"));
      bar.style.height = known ? Math.max(4, Math.round(130 * x.ads.spend / max)) + "px" : "130px";
      col.append(bar, el("span", "vk-ads-label", x.label));
      col.append(el("span", "vk-ads-sub", known ? fmt(x.ads.subscribers) + " подп." : "—"));
      bars.append(col);
    });
    const a = m.ads, d = $("vkAdsDetail");
    d.replaceChildren();
    const badge = $("vkAdsBadge");
    badge.textContent = a.status;
    badge.className = "vk-badge" + (a.spend === null ? " is-pending" : "");
    const cps = a.spendSubscriptions !== null && a.subscribers ? a.spendSubscriptions / a.subscribers : null;
    const tiles = el("div", "vk-ads-tiles");
    [["Расход за месяц", rub(a.spend), "все кампании"], ["Подписчиков с рекламы", fmt(a.subscribers), "по данным кабинета"],
     ["Цена подписчика", cps === null ? "—" : rub(Math.round(cps * 100) / 100), "кампании на подписку"]]
      .forEach(([k, v, note]) => { const t = el("div", "mini"); t.append(el("span", "", k), el("b", "", v), el("small", "", note)); tiles.append(t); });
    d.append(el("h3", "", m.name + " 2026"), tiles);
    if (a.campaigns.length) {
      const ul = el("ul", "vk-campaigns");
      a.campaigns.forEach(c => ul.append(el("li", "", c)));
      d.append(el("p", "vk-ads-caption", "Кампании месяца:"), ul);
    } else {
      d.append(el("p", "vk-ads-caption", "Отчёт кабинета за этот месяц ещё не выгружен."));
    }
    const knownMonths = months.filter(x => x.ads.spend !== null);
    const sumSpend = knownMonths.reduce((s, x) => s + x.ads.spend, 0);
    const sumSubSpend = knownMonths.reduce((s, x) => s + x.ads.spendSubscriptions, 0), sumSubs = knownMonths.reduce((s, x) => s + x.ads.subscribers, 0);
    const missing = months.filter(x => x.ads.spend === null).map(x => x.name.toLowerCase());
    d.append(el("p", "vk-ads-total", `Июль – октябрь${missing.length ? " (без: " + missing.join(", ") + ")" : ""}: расход ${rub(Math.round(sumSpend))}, из них на подписку ${rub(Math.round(sumSubSpend))} — ${fmt(sumSubs)} подписчиков, в среднем ${rub(Math.round(sumSubSpend / sumSubs * 100) / 100)} за подписчика.`));
  }

  /* ---------- funnel ---------- */
  function drawFunnel() {
    const m = months[state.month], a = m.audience, crm = m.crm;
    const steps = [
      ["Новые подписчики", a.subscribed, "сообщество ВК"],
      ["Первые сообщения", a.firstMessages, "написали сообществу впервые"],
      ["Обращения в CRM", crm ? crm.leads : null, "источник «ВКонтакте»"],
      ["Целевые обращения", crm ? crm.target : null, "по методике отчёта"],
      ["Договоры", crm ? crm.deals : null, "заключены в месяце"]
    ];
    const wrap = $("vkFunnel");
    wrap.replaceChildren();
    const keys = ["subscribed", "messages", "leads", "target", "deals"];
    steps.forEach(([title, val, note], k) => {
      const li = el("li", "vk-step" + (val === null ? " is-pending" : "") + (k === steps.length - 1 ? " is-final" : ""));
      li.dataset.step = keys[k];
      li.append(el("span", "vk-step-title", title));
      if (val === null) li.append(el("strong", "", "—"), pendingNote("ждём выгрузку CRM"));
      else li.append(el("strong", "", fmt(val)), el("small", "", note));
      wrap.append(li);
    });
  }

  function renderMonth() {
    drawSwitch(); drawKpis(); drawLine(); drawFlow(); drawTotal(); drawPlan(); drawCalendar(); drawFormats(); drawTop(); drawAds(); drawFunnel();
  }
  bindTop();
  renderMonth();
  watchLine();
  document.documentElement.classList.add("bv-vk-ready");
})();
