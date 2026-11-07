"use strict";
/* Bani Vyatki Analytics — раздел 07 «Авито: объявления» (прототип).
 * Все значения считаются из window.BV_AVITO (avito-data.js): одна строка rows = одно объявление за один день.
 * Данные Авито не смешиваются с CRM-итогами разделов 01–05. */
(() => {
  const data = window.BV_AVITO;
  if (!data || !Array.isArray(data.rows) || !Array.isArray(data.months)) return;
  const $ = id => document.getElementById(id);
  const F = Object.fromEntries(data.fields.map((f, i) => [f, i]));
  const SVG = "http://www.w3.org/2000/svg";
  const nf0 = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0});
  const nf1 = new Intl.NumberFormat("ru-RU", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const fmt = n => (n === null || n === undefined || !isFinite(n)) ? "—" : nf0.format(n);
  const fmt1 = n => (n === null || n === undefined || !isFinite(n)) ? "—" : nf1.format(n);
  const pct = n => (n === null || n === undefined || !isFinite(n)) ? "—" : nf1.format(n * 100) + "%";
  const rub = n => (n === null || n === undefined || !isFinite(n)) ? "—" : nf0.format(Math.round(n)) + " ₽";
  const MONTH_GEN = {"01": "января", "02": "февраля", "03": "марта", "04": "апреля", "05": "мая", "06": "июня", "07": "июля", "08": "августа", "09": "сентября", "10": "октября", "11": "ноября", "12": "декабря"};
  const DATIVE = {"Январь": "январю", "Февраль": "февралю", "Март": "марту", "Апрель": "апрелю", "Май": "маю", "Июнь": "июню", "Июль": "июлю", "Август": "августу", "Сентябрь": "сентябрю", "Октябрь": "октябрю", "Ноябрь": "ноябрю", "Декабрь": "декабрю"};
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  };
  const dayLabel = iso => +iso.slice(8) + " " + MONTH_GEN[iso.slice(5, 7)];

  /* Группы объявлений: правила — в docs/avito.md. Цвета проверены на различимость (в т.ч. при дальтонизме). */
  const MIN_VIEWS = 30;
  const GROUPS = [
    {id: "work", name: "Работают", color: "#1e6b3e", rule: "Много просмотров, пишут чаще среднего", action: "Держать. Продвижение — в первую очередь сюда."},
    {id: "look", name: "Смотрят, но не пишут", color: "#c07a35", rule: "Много просмотров, конверсия ниже средней", action: "Проверить цену, первое фото и начало текста."},
    {id: "hidden", name: "Пишут, но мало видят", color: "#2f6ea8", rule: "Конверсия выше средней, просмотров мало", action: "Добавить продвижение или усилить заголовок."},
    {id: "weak", name: "Слабые", color: "#8f3f20", rule: "Мало просмотров и низкая конверсия", action: "Переделать заголовок, фото, цену — или снять."},
    {id: "few", name: "Мало просмотров", color: "#9aa094", rule: "Меньше " + MIN_VIEWS + " просмотров за месяц — конверсию оценивать рано", action: "Проверить, показывается ли объявление; решить, нужно ли его продвигать."}
  ];
  const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));

  const months = data.months;
  const state = {month: months.length - 1, group: "all", sort: "contacts", day: null, allCards: false};
  const CARDS_LIMIT = 10;

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
  function listingTitle(l) {
    if (l.pair) return "2 объявления: «" + l.titles.join("» и «") + "»";
    return l.title || "Название уточняется";
  }
  function listingMeta(l) {
    const place = l.address === l.city ? l.city : l.address.startsWith(l.city) ? l.address : l.city + ", " + l.address;
    return place + " · " + l.category + " · " + fmt(l.price) + " ₽";
  }

  /* ---------- aggregation ---------- */
  const blank = () => ({shows: 0, views: 0, contacts: 0, chat: 0, phone: 0, phoneAndChat: 0, discount: 0, favorites: 0, money: 0, promo: 0, bonus: 0, listings: 0});
  function add(t, r) {
    t.shows += r[F.shows]; t.views += r[F.views]; t.contacts += r[F.contacts]; t.chat += r[F.chat];
    t.phone += r[F.phone]; t.phoneAndChat += r[F.phoneAndChat]; t.discount += r[F.discountReplies];
    t.favorites += r[F.favorites]; t.money += r[F.spendMoney]; t.promo += r[F.spendPromo]; t.bonus += r[F.spendBonus];
    t.listings += r[F.listingsInRow];
    return t;
  }
  const cost = t => t.money + t.bonus;
  const byDay = data.dates.map(() => blank());
  data.rows.forEach(r => add(byDay[r[F.day]], r));

  function monthDays(m) {
    const out = [];
    for (let d = 1; d <= m.days; d++) {
      const iso = m.id + "-" + String(d).padStart(2, "0");
      const i = data.dates.indexOf(iso);
      out.push({iso, d, i, t: i >= 0 ? byDay[i] : null});
    }
    return out;
  }
  const cache = new Map();
  function monthStats(mi) {
    if (cache.has(mi)) return cache.get(mi);
    const m = months[mi];
    const days = monthDays(m);
    const loaded = days.filter(x => x.t);
    const total = loaded.reduce((t, x) => {
      Object.keys(t).forEach(k => { t[k] += x.t[k]; });
      return t;
    }, blank());
    const per = new Map();
    data.rows.forEach(r => {
      if (!data.dates[r[F.day]].startsWith(m.id)) return;
      const li = r[F.listing];
      if (!per.has(li)) per.set(li, {l: data.listings[li], t: blank(), active: 0, daily: new Array(m.days).fill(null)});
      const p = per.get(li);
      add(p.t, r); p.active += 1;
      p.daily[+data.dates[r[F.day]].slice(8) - 1] = r[F.views];
    });
    const list = [...per.values()].map(p => ({
      ...p, views: p.t.views, contacts: p.t.contacts, cost: cost(p.t), shows: p.t.shows,
      vpd: p.t.views / p.active, cr: p.t.views ? p.t.contacts / p.t.views : null,
      cpc: p.t.contacts ? cost(p.t) / p.t.contacts : null,
      isNew: p.l.published.startsWith(m.id)
    }));
    // Пороги: средняя конверсия месяца и медиана просмотров в день среди объявлений, где просмотров достаточно.
    const avgCr = total.views ? total.contacts / total.views : 0;
    const rated = list.filter(x => x.views >= MIN_VIEWS).map(x => x.vpd).sort((a, b) => a - b);
    const medVpd = rated.length ? (rated.length % 2 ? rated[(rated.length - 1) / 2] : (rated[rated.length / 2 - 1] + rated[rated.length / 2]) / 2) : 0;
    list.forEach(x => {
      if (x.views < MIN_VIEWS) x.group = "few";
      else {
        const hi = x.vpd >= medVpd, good = x.cr >= avgCr;
        x.group = hi && good ? "work" : hi ? "look" : good ? "hidden" : "weak";
      }
    });
    [...list].sort((a, b) => b.contacts - a.contacts || b.views - a.views || a.l.id.localeCompare(b.l.id))
      .forEach((x, i) => { x.rank = i + 1; });
    const s = {m, days, loaded, total, list, avgCr, medVpd, n: loaded.length};
    cache.set(mi, s);
    return s;
  }
  const perDay = (s, v) => s.n ? v / s.n : null;

  /* ---------- month switch ---------- */
  function drawSwitch() {
    const wrap = $("avMonthSwitch");
    if (wrap.children.length !== months.length) {
      wrap.replaceChildren();
      months.forEach((m, i) => {
        const b = el("button", "", m.name);
        b.type = "button";
        b.addEventListener("click", () => { state.month = i; state.day = null; state.group = "all"; state.allCards = false; render(); });
        wrap.append(b);
      });
    }
    [...wrap.children].forEach((b, i) => {
      b.classList.toggle("active", i === state.month);
      b.setAttribute("aria-pressed", String(i === state.month));
    });
    const m = months[state.month];
    $("avMonthNote").textContent = m.complete ? "Все " + m.days + " " + plural(m.days, "день", "дня", "дней") + " месяца"
      : "Загружено " + (+m.from.slice(8)) + "–" + dayLabel(m.to) + ": " + m.loadedDays + " из " + m.days + " " + plural(m.days, "дня", "дней", "дней");
  }

  /* ---------- KPI ---------- */
  function kpi(key, glyph, color, title, value, unit, trend, foot) {
    const a = el("article", "av-kpi");
    a.dataset.kpi = key;
    const top = el("div", "av-kpi-top");
    top.append(el("span", "av-glyph " + color, glyph));
    if (trend) top.append(el("span", "av-trend " + trend[1], trend[0]));
    const strong = el("strong", "", value);
    if (unit) { strong.append(" "); strong.append(el("small", "", unit)); }
    a.append(top, el("h2", "", title), strong, el("p", "", foot));
    return a;
  }
  function drawKpis() {
    const s = monthStats(state.month), t = s.total;
    const p = state.month > 0 ? monthStats(state.month - 1) : null;
    const to = p ? " к " + (DATIVE[p.m.name] || p.m.name.toLowerCase()) : "";
    // Сравнение — по среднему за день: незаконченный месяц сопоставим с полным.
    const trend = (cur, prev, lowerIsBetter) => {
      if (!p || cur === null || prev === null || !prev) return null;
      const v = cur / prev - 1, good = lowerIsBetter ? v <= 0 : v >= 0;
      return [(v >= 0 ? "↗ +" : "↘ −") + pct(Math.abs(v)) + to, lowerIsBetter === null ? "neutral" : good ? "positive" : "negative"];
    };
    const pp = (cur, prev) => {
      if (!p || cur === null || prev === null) return null;
      const v = (cur - prev) * 100;
      return [(v >= 0 ? "↗ +" : "↘ −") + nf1.format(Math.abs(v)) + " п.п." + to, v >= 0 ? "positive" : "negative"];
    };
    const cr = t.views ? t.contacts / t.views : null, pcr = p && p.total.views ? p.total.contacts / p.total.views : null;
    const cpc = t.contacts ? cost(t) / t.contacts : null, pcpc = p && p.total.contacts ? cost(p.total) / p.total.contacts : null;
    const daily = p ? " · сравнение по среднему за день" : "";
    $("avKpis").replaceChildren(
      kpi("views", "◉", "green", "Просмотры объявлений", fmt(t.views), "", trend(perDay(s, t.views), p && perDay(p, p.total.views)),
        "Показы в поиске: " + fmt(t.shows) + " · из показа в просмотр " + pct(t.shows ? t.views / t.shows : null)),
      kpi("contacts", "✉", "gold", "Контакты", fmt(t.contacts), "", trend(perDay(s, t.contacts), p && perDay(p, p.total.contacts)),
        "Написали в чат: " + fmt(t.chat) + " · смотрели телефон: " + fmt(t.phone + t.phoneAndChat) + " · в избранное: " + fmt(t.favorites)),
      kpi("cr", "%", "olive", "Конверсия в контакт", pct(cr), "", pp(cr, pcr),
        "Контакты / просмотры" + daily),
      kpi("cost", "₽", "brown", "Затраты на объявления", rub(cost(t)), "", trend(perDay(s, cost(t)), p && perDay(p, cost(p.total)), null),
        "Деньгами " + rub(t.money) + (t.bonus ? " · бонусами " + rub(t.bonus) : "") + " · на продвижение " + pct(t.money ? t.promo / t.money : null) + " денег"),
      kpi("cpc", "◇", "green", "Цена контакта", rub(cpc), "", trend(cpc, pcpc, true),
        "Затраты / контакты · в среднем " + fmt1(perDay(s, t.contacts)) + " " + plural(Math.round(perDay(s, t.contacts) || 0), "контакт", "контакта", "контактов") + " в день")
    );
  }

  /* ---------- daily small multiples ---------- */
  const METRICS = [
    {id: "views", name: "Просмотры", get: t => t.views, f: fmt},
    {id: "contacts", name: "Контакты", get: t => t.contacts, f: fmt},
    {id: "cost", name: "Затраты, ₽", get: t => cost(t), f: v => fmt(Math.round(v))}
  ];
  function niceMax(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  let dailyGeom = null;
  function drawDaily() {
    const s = monthStats(state.month), host = $("avDaily");
    const W = Math.max(280, Math.round(host.clientWidth || 900)), small = W < 560;
    const L = small ? 46 : 58, R = 10, n = s.m.days, slot = (W - L - R) / n;
    const bw = Math.max(3, Math.min(24, slot * 0.68));
    const x = d => L + slot * (d - 1) + (slot - bw) / 2;
    host.replaceChildren();
    $("avDailySubtitle").textContent = s.m.name + " " + s.m.id.slice(0, 4) + ": " + (s.m.complete ? "все дни месяца" : "загружено " + s.n + " из " + n + " дней") +
      ". Три графика с общей шкалой дней — видно, как расход и просмотры отражаются на контактах.";
    METRICS.forEach((mt, k) => {
      const vals = s.days.map(d => d.t ? mt.get(d.t) : null);
      const max = niceMax(Math.max(1, ...vals.filter(v => v !== null)));
      const H = small ? 92 : 104, T = 18, B = k === METRICS.length - 1 ? 24 : 8, ph = H - T - B;
      const y = v => T + ph - v / max * ph;
      const avg = s.n ? vals.filter(v => v !== null).reduce((a, b) => a + b, 0) / s.n : 0;
      const total = vals.filter(v => v !== null).reduce((a, b) => a + b, 0);
      const fig = el("figure", "av-mini");
      fig.dataset.metric = mt.id;
      const cap = el("figcaption", "av-mini-title");
      cap.append(el("b", "", mt.name), el("span", "", "за месяц " + mt.f(total) + " · в среднем " + (mt.id === "contacts" ? fmt1(avg) : mt.f(avg)) + " в день"));
      const root = svg("svg", {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "av-mini-svg", role: "img",
        "aria-label": mt.name + " по дням, " + s.m.name.toLowerCase() + ": всего " + mt.f(total) + ", в среднем " + mt.f(avg) + " в день. Подробные значения — в таблице по дням."});
      [0, max / 2, max].filter(v => mt.id === "cost" || Number.isInteger(v)).forEach(v => {
        root.append(svg("line", {x1: L, x2: W - R, y1: y(v), y2: y(v), class: "av-grid-line" + (v === 0 ? " base" : "")}));
        if (v) root.append(svg("text", {x: L - 7, y: y(v) + 4, class: "av-axis", "text-anchor": "end"}, mt.id === "cost" && v >= 1000 ? nf1.format(v / 1000).replace(",0", "") + " тыс." : fmt(v)));
      });
      s.days.forEach((d, i) => {
        const v = vals[i];
        if (v === null) {
          root.append(svg("rect", {x: x(d.d), y: T, width: bw, height: ph, rx: 3, class: "av-empty"}));
          return;
        }
        const h = Math.max(v > 0 ? 2 : 0, v / max * ph), r = Math.min(4, bw / 2, h);
        const x0 = x(d.d), y0 = T + ph - h;
        const path = h <= 0 ? "" : `M${x0} ${T + ph} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + bw - r} Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + r} V${T + ph} Z`;
        if (path) root.append(svg("path", {d: path, class: "av-bar" + (state.day === d.d ? " is-active" : "")}));
        else root.append(svg("line", {x1: x0, x2: x0 + bw, y1: T + ph - .5, y2: T + ph - .5, class: "av-zero"}));
      });
      if (s.n) {
        root.append(svg("line", {x1: L, x2: W - R, y1: y(avg), y2: y(avg), class: "av-avg"}));
      }
      if (k === METRICS.length - 1) {
        const step = small ? 7 : n > 16 ? 5 : 1;
        s.days.forEach(d => {
          if (d.d === 1 || d.d % step === 0 && d.d <= n - 2 || d.d === n)
            root.append(svg("text", {x: x(d.d) + bw / 2, y: H - 6, class: "av-axis", "text-anchor": "middle"}, d.d));
        });
      }
      if (state.day) root.append(svg("rect", {x: L + slot * (state.day - 1), y: T - 4, width: slot, height: ph + 4, class: "av-cross"}));
      fig.append(cap, root);
      host.append(fig);
    });
    dailyGeom = {L, slot, n, W};
    drawDailyTable();
  }
  function dayFromEvent(ev) {
    const host = $("avDaily"), r = host.getBoundingClientRect(), g = dailyGeom;
    if (!g) return null;
    const px = (ev.clientX - r.left) * g.W / r.width;
    const d = Math.floor((px - g.L) / g.slot) + 1;
    return d >= 1 && d <= g.n ? d : null;
  }
  function showTip(d, anchor) {
    const tip = $("avTip"), s = monthStats(state.month), day = s.days[d - 1];
    if (!day) { tip.hidden = true; return; }
    tip.replaceChildren(el("b", "", dayLabel(day.iso)));
    if (!day.t) tip.append(el("span", "", "День ещё не загружен"));
    else {
      const t = day.t;
      [["Просмотры", fmt(t.views)], ["Контакты", fmt(t.contacts)], ["Показы", fmt(t.shows)], ["В избранное", fmt(t.favorites)],
        ["Затраты", rub(cost(t)) + (t.bonus ? " (бонусами " + rub(t.bonus) + ")" : "")], ["Объявлений", fmt(t.listings)]]
        .forEach(([k, v]) => { const row = el("span", ""); row.append(k + ": ", el("strong", "", v)); tip.append(row); });
    }
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = anchor.x + 14, top = anchor.y - th - 10;
    if (left + tw > window.innerWidth - 8) left = anchor.x - tw - 14;
    if (top < 8) top = anchor.y + 16;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = Math.max(8, top) + "px";
  }
  function bindDaily() {
    const host = $("avDaily");
    host.tabIndex = 0;
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Графики по дням. Стрелки влево и вправо выбирают день.");
    host.addEventListener("pointermove", ev => {
      const d = dayFromEvent(ev);
      if (d !== state.day) { state.day = d; drawDaily(); }
      if (d) showTip(d, {x: ev.clientX, y: ev.clientY}); else $("avTip").hidden = true;
    });
    host.addEventListener("pointerleave", () => { state.day = null; $("avTip").hidden = true; drawDaily(); });
    host.addEventListener("keydown", ev => {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight" && ev.key !== "Escape") return;
      ev.preventDefault();
      const n = monthStats(state.month).m.days;
      if (ev.key === "Escape") { state.day = null; $("avTip").hidden = true; drawDaily(); return; }
      state.day = Math.min(n, Math.max(1, (state.day || (ev.key === "ArrowLeft" ? n + 1 : 0)) + (ev.key === "ArrowLeft" ? -1 : 1)));
      drawDaily();
      const r = host.getBoundingClientRect(), g = dailyGeom;
      showTip(state.day, {x: r.left + (g.L + g.slot * (state.day - .5)) * r.width / g.W, y: r.top + 24});
    });
    host.addEventListener("blur", () => { state.day = null; $("avTip").hidden = true; drawDaily(); });
  }
  function drawDailyTable() {
    const s = monthStats(state.month), body = $("avDailyTable").tBodies[0];
    body.replaceChildren();
    s.days.forEach(d => {
      const tr = el("tr", d.t ? "" : "is-empty");
      const th = el("th", "", dayLabel(d.iso)); th.scope = "row"; tr.append(th);
      if (!d.t) { const td = el("td", "", "не загружен"); td.colSpan = 8; tr.append(td); }
      else {
        const t = d.t;
        [fmt(t.listings), fmt(t.shows), fmt(t.views), fmt(t.contacts), fmt(t.chat) + " / " + fmt(t.phone + t.phoneAndChat), fmt(t.favorites), fmt(Math.round(cost(t))), t.bonus ? fmt(Math.round(t.bonus)) : "—"]
          .forEach(v => tr.append(el("td", "", v)));
      }
      body.append(tr);
    });
    const t = s.total, tr = el("tr", "is-total"), th = el("th", "", "Итого"); th.scope = "row"; tr.append(th);
    ["", fmt(t.shows), fmt(t.views), fmt(t.contacts), fmt(t.chat) + " / " + fmt(t.phone + t.phoneAndChat), fmt(t.favorites), fmt(Math.round(cost(t))), t.bonus ? fmt(Math.round(t.bonus)) : "—"]
      .forEach(v => tr.append(el("td", "", v)));
    body.append(tr);
  }

  /* ---------- months ---------- */
  function drawMonths() {
    const body = $("avMonths").tBodies[0];
    body.replaceChildren();
    const stats = months.map((m, i) => monthStats(i));
    const mx = k => Math.max(...stats.map(s => k(s) || 0), 1);
    const cols = [
      [s => perDay(s, s.total.views), v => fmt1(v)],
      [s => perDay(s, s.total.contacts), v => fmt1(v)],
      [s => perDay(s, cost(s.total)), v => rub(v)]
    ];
    stats.forEach((s, i) => {
      const tr = el("tr", i === state.month ? "is-current" : "");
      tr.dataset.month = s.m.id;
      const th = el("th", ""); th.scope = "row";
      th.append(el("b", "", s.m.name + " " + s.m.id.slice(0, 4)));
      if (!s.m.complete) th.append(el("span", "av-tag", "месяц идёт"));
      tr.append(th, el("td", "", s.n + " из " + s.m.days));
      cols.forEach(([get, f]) => {
        const v = get(s), td = el("td", "av-cellbar");
        const bar = el("i"); bar.style.width = (v / mx(get) * 100).toFixed(1) + "%";
        td.append(el("span", "", f(v)), bar);
        tr.append(td);
      });
      tr.append(el("td", "", pct(s.total.views ? s.total.contacts / s.total.views : null)),
        el("td", "", rub(s.total.contacts ? cost(s.total) / s.total.contacts : null)));
      body.append(tr);
    });
  }

  /* ---------- listings ---------- */
  function visibleList() {
    const s = monthStats(state.month);
    const key = {contacts: x => -x.contacts * 1e6 - x.views, views: x => -x.views, cost: x => -x.cost,
      cpc: x => x.cpc === null ? Infinity : x.cpc, cr: x => x.views < MIN_VIEWS ? Infinity : -(x.cr || 0)}[state.sort];
    return s.list.filter(x => state.group === "all" || x.group === state.group)
      .sort((a, b) => key(a) - key(b) || a.rank - b.rank);
  }
  function drawGroups() {
    const s = monthStats(state.month), wrap = $("avGroups");
    wrap.replaceChildren();
    const mk = (id, name, count, color) => {
      const b = el("button", "av-chip" + (state.group === id ? " active" : ""));
      b.type = "button"; b.dataset.group = id;
      b.setAttribute("aria-pressed", String(state.group === id));
      if (color) { const dot = el("i", "av-chip-dot"); dot.style.background = color; b.append(dot); }
      b.append(el("span", "", name), el("b", "", count));
      b.addEventListener("click", () => { state.group = state.group === id && id !== "all" ? "all" : id; state.allCards = false; drawListings(); });
      wrap.append(b);
    };
    mk("all", "Все", s.list.length);
    GROUPS.forEach(g => mk(g.id, g.name, s.list.filter(x => x.group === g.id).length, g.color));
  }
  function drawRules() {
    const s = monthStats(state.month), box = $("avRules");
    box.replaceChildren();
    const h = el("h3", "", "Как делим на группы");
    const th = el("p", "av-rules-th");
    th.append("Граница по просмотрам — медиана ", el("strong", "", fmt1(s.medVpd) + " в день"),
      ", по конверсии — средняя за месяц ", el("strong", "", pct(s.avgCr)), ".");
    const ul = el("ul", "av-rule-list");
    GROUPS.forEach(g => {
      const li = el("li", ""); li.dataset.group = g.id;
      const dot = el("i", "av-chip-dot"); dot.style.background = g.color;
      const txt = el("div", "");
      txt.append(el("b", "", g.name), el("span", "", g.rule + ". "), el("em", "", g.action));
      li.append(dot, txt);
      ul.append(li);
    });
    box.append(h, th, ul);
    if (!s.m.complete) box.append(el("p", "av-rules-note", "Месяц ещё идёт: за " + s.n + " " + plural(s.n, "день", "дня", "дней") + " у большинства объявлений мало просмотров, группы предварительные."));
  }
  let scatterW = 0;
  function drawScatter() {
    const s = monthStats(state.month), host = $("avScatter");
    const pts = s.list.filter(x => x.views >= MIN_VIEWS);
    const W = Math.max(280, Math.round(host.clientWidth || 560)), H = W < 480 ? 260 : 300, L = 46, R = 14, T = 16, B = 36;
    scatterW = W;
    host.replaceChildren();
    const fewN = s.list.length - pts.length;
    $("avScatterCaption").textContent = pts.length
      ? "Точка — объявление, номер — как в таблице. По горизонтали — просмотры в день (логарифмическая шкала), по вертикали — конверсия в контакт." + (fewN ? " Объявления с менее чем " + MIN_VIEWS + " просмотрами за месяц на графике не показаны (" + fewN + " шт.)." : "")
      : "Пока ни у одного объявления нет " + MIN_VIEWS + " просмотров за месяц — график появится, когда наберутся данные.";
    if (!pts.length) return;
    const xs = pts.map(p => p.vpd), lo = Math.max(.3, Math.min(...xs) * .8), hi = Math.max(...xs) * 1.25;
    const lx = v => Math.log10(v);
    const X = v => L + (lx(v) - lx(lo)) / (lx(hi) - lx(lo)) * (W - L - R);
    const ymax = Math.max(s.avgCr * 2, ...pts.map(p => p.cr)) * 1.12 || .05;
    const Y = v => T + (1 - v / ymax) * (H - T - B);
    const root = svg("svg", {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "av-scatter-svg", role: "img",
      "aria-label": "Объявления месяца: просмотры в день и конверсия в контакт. Значения — в таблице ниже."});
    const ticks = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].filter(v => v >= lo && v <= hi);
    ticks.forEach(v => {
      root.append(svg("line", {x1: X(v), x2: X(v), y1: T, y2: H - B, class: "av-grid-line"}));
      root.append(svg("text", {x: X(v), y: H - B + 16, class: "av-axis", "text-anchor": "middle"}, fmt(v)));
    });
    const ystep = ymax > .2 ? .1 : ymax > .08 ? .02 : .01;
    for (let v = 0; v <= ymax + 1e-9; v += ystep) {
      root.append(svg("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "av-grid-line" + (v === 0 ? " base" : "")}));
      root.append(svg("text", {x: L - 7, y: Y(v) + 4, class: "av-axis", "text-anchor": "end"}, Math.round(v * 100) + "%"));
    }
    root.append(svg("text", {x: W - R, y: H - 4, class: "av-axis", "text-anchor": "end"}, "просмотров в день →"));
    // пороги групп
    if (s.medVpd >= lo && s.medVpd <= hi) root.append(svg("line", {x1: X(s.medVpd), x2: X(s.medVpd), y1: T, y2: H - B, class: "av-threshold"}));
    root.append(svg("line", {x1: L, x2: W - R, y1: Y(s.avgCr), y2: Y(s.avgCr), class: "av-threshold"}));
    root.append(svg("text", {x: W - R - 2, y: Y(s.avgCr) - 6, class: "av-axis av-th-label", "text-anchor": "end"}, "средняя " + pct(s.avgCr)));
    const sel = state.group;
    pts.sort((a, b) => b.vpd - a.vpd).forEach(p => {
      const g = GROUP[p.group], cx = X(p.vpd), cy = Y(p.cr);
      const dim = sel !== "all" && p.group !== sel;
      const node = svg("g", {class: "av-pt" + (dim ? " is-dim" : ""), tabindex: dim ? -1 : 0, role: "img",
        "aria-label": "№" + p.rank + " " + listingTitle(p.l) + ": " + fmt1(p.vpd) + " просмотров в день, конверсия " + pct(p.cr) + ", группа «" + g.name + "»"});
      node.append(svg("circle", {cx, cy, r: 12, class: "av-pt-hit"}), svg("circle", {cx, cy, r: 6, fill: g.color, class: "av-pt-dot"}),
        svg("text", {x: cx + 9, y: cy - 7, class: "av-pt-label"}, p.rank));
      const show = ev => {
        const tip = $("avTip");
        tip.replaceChildren(el("b", "", "№" + p.rank + " · " + listingTitle(p.l)));
        [["Группа", g.name], ["Просмотров в день", fmt1(p.vpd)], ["Конверсия", pct(p.cr)], ["Контакты", fmt(p.contacts)], ["Затраты", rub(p.cost)]]
          .forEach(([k, v]) => { const row = el("span", ""); row.append(k + ": ", el("strong", "", v)); tip.append(row); });
        tip.hidden = false;
        const r = ev && ev.clientX !== undefined ? {x: ev.clientX, y: ev.clientY} : (() => { const b = node.getBoundingClientRect(); return {x: b.right, y: b.top}; })();
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = r.x + 14, top = r.y - th - 10;
        if (left + tw > window.innerWidth - 8) left = r.x - tw - 14;
        if (top < 8) top = r.y + 16;
        tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
      };
      const hide = () => { $("avTip").hidden = true; };
      node.addEventListener("pointerenter", show); node.addEventListener("pointermove", show);
      node.addEventListener("pointerleave", hide); node.addEventListener("focus", () => show()); node.addEventListener("blur", hide);
      root.append(node);
    });
    host.append(root);
  }
  function spark(daily) {
    const w = 84, h = 24, n = daily.length, max = Math.max(1, ...daily.filter(v => v !== null)), bw = w / n;
    const root = svg("svg", {viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: "av-spark", "aria-hidden": "true", preserveAspectRatio: "none"});
    daily.forEach((v, i) => {
      if (v === null) return;
      const bh = v ? Math.max(1.5, v / max * (h - 2)) : .8;
      root.append(svg("rect", {x: i * bw + .3, y: h - bh, width: Math.max(.8, bw - .8), height: bh, class: v ? "av-spark-bar" : "av-spark-zero"}));
    });
    return root;
  }
  function groupChip(id) {
    const g = GROUP[id], c = el("span", "av-group", g.name);
    c.dataset.group = id;
    const dot = el("i", "av-chip-dot"); dot.style.background = g.color; c.prepend(dot);
    return c;
  }
  function titleCell(x) {
    const wrap = el("div", "av-title");
    const t = el("b", "", listingTitle(x.l));
    if (!x.l.title && !x.l.pair) t.classList.add("is-pending");
    wrap.append(t);
    const meta = el("small", "", listingMeta(x.l));
    if (x.isNew) meta.append(" ", el("span", "av-tag", "новое"));
    wrap.append(meta);
    return wrap;
  }
  function drawTable() {
    const list = visibleList(), body = $("avTable").tBodies[0], cards = $("avCards");
    body.replaceChildren(); cards.replaceChildren();
    list.forEach(x => {
      const tr = el("tr", "");
      tr.dataset.listing = x.l.id; tr.dataset.group = x.group;
      const th = el("th", "av-rank", x.rank); th.scope = "row";
      const tdT = el("td", ""); tdT.append(titleCell(x));
      const tdS = el("td", ""); tdS.append(spark(x.daily));
      const tdG = el("td", ""); tdG.append(groupChip(x.group));
      tr.append(th, tdT, tdS, el("td", "", x.active), el("td", "", fmt(x.shows)), el("td", "", fmt(x.views)), el("td", "", fmt1(x.vpd)),
        el("td", "av-strong", fmt(x.contacts)), el("td", "", x.views >= MIN_VIEWS ? pct(x.cr) : "—"), el("td", "", rub(x.cost)),
        el("td", "", rub(x.cpc)), tdG);
      body.append(tr);

      const li = el("li", "av-card");
      li.dataset.listing = x.l.id; li.dataset.group = x.group;
      const head = el("div", "av-card-head");
      head.append(el("span", "av-card-rank", "№" + x.rank), groupChip(x.group));
      const grid = el("dl", "av-card-grid");
      [["Просмотры", fmt(x.views)], ["Контакты", fmt(x.contacts)], ["Конверсия", x.views >= MIN_VIEWS ? pct(x.cr) : "—"],
        ["В день", fmt1(x.vpd)], ["Затраты", rub(x.cost)], ["Цена контакта", rub(x.cpc)]].forEach(([k, v]) => {
        const d = el("div", ""); d.append(el("dt", "", k), el("dd", "", v)); grid.append(d);
      });
      const sp = el("div", "av-card-spark"); sp.append(el("small", "", "Просмотры по дням · активно " + x.active + " " + plural(x.active, "день", "дня", "дней")), spark(x.daily));
      li.append(head, titleCell(x), grid, sp);
      if (!state.allCards && cards.children.length >= CARDS_LIMIT) li.hidden = true;
      cards.append(li);
    });
    const more = $("avCardsMore"), hiddenN = list.length - CARDS_LIMIT;
    more.hidden = state.allCards || hiddenN <= 0;
    more.textContent = "Показать ещё " + hiddenN + " " + plural(hiddenN, "объявление", "объявления", "объявлений");
    const total = monthStats(state.month).list.length;
    $("avListCount").textContent = state.group === "all" ? "Объявлений в месяце: " + total
      : "Показано " + list.length + " из " + total + " · группа «" + GROUP[state.group].name + "»";
  }
  function drawListings() {
    drawGroups(); drawScatter(); drawTable();
    $("avListSubtitle").textContent = "Каждое объявление отнесено к группе по просмотрам в день и конверсии из просмотра в контакт. Нажмите на группу, чтобы оставить только её.";
  }

  function watch(id, draw, getW) {
    const host = $(id);
    let frame = 0;
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = Math.round(host.clientWidth);
        if (w && Math.abs(w - getW()) > 2) draw();
      });
    };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(host);
    else window.addEventListener("resize", redraw);
  }

  function render() {
    drawSwitch(); drawKpis(); drawDaily(); drawMonths(); drawRules(); drawListings();
  }
  $("avSort").addEventListener("change", e => { state.sort = e.target.value; drawTable(); });
  $("avCardsMore").addEventListener("click", () => {
    state.allCards = true; drawTable();
    const next = $("avCards").children[CARDS_LIMIT];
    if (next) { next.tabIndex = -1; next.focus(); }
  });
  bindDaily();
  render();
  watch("avDaily", drawDaily, () => dailyGeom ? dailyGeom.W : 0);
  watch("avScatter", drawScatter, () => scatterW);
  document.documentElement.classList.add("bv-avito-ready");
})();
