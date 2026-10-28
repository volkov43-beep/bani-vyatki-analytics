"use strict";
/*
 * Bani Vyatki Analytics — Раздел 01. Статическая демоверсия.
 * Источники: отчет сентября 2026, изображение сценарных планов,
 * уточнения пользователя от октября 2026.
 * Здесь нет Битрикс24, авторизации и внешних запросов.
 */
const REPORT = Object.freeze({
  actual: {
    revenue: 5643000, margin: 1240000, contracts: 13, qualified: 122,
    inquiries: 222, averageCheck: 434076, marketingSpend: 165833,
    vkSales: 3, callsSales: 2,
    avitoBudget: 87093, avitoLeads: 167, avitoCpl: 522,
    avitoSales: 8, avitoCostSale: 10886.63
  },
  plans: {
    realistic: {
      revenue: 6240000, margin: 1440000, contracts: 12,
      qualified: 65, vkSales: 4, avitoBudget: 80000,
      avitoLeads: 133, avitoCpl: 600, avitoSales: 8,
      avitoCostSale: 10000
    },
    optimistic: {
      revenue: 9360000, margin: 2160000, contracts: 18,
      qualified: 87, vkSales: 5, avitoBudget: 80000,
      avitoLeads: 178, avitoCpl: 450, avitoSales: 13,
      avitoCostSale: 6153.8
    }
  }
});

const scenario = document.getElementById("scenario");
const rubles = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0});
const decimal1 = new Intl.NumberFormat("ru-RU", {minimumFractionDigits: 1, maximumFractionDigits: 1});
const decimal2 = new Intl.NumberFormat("ru-RU", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const rub = n => rubles.format(n) + " ₽";
const pct = n => decimal1.format(n) + "%";

const MAIN_METRICS = [
  {id:"revenue", title:"Выручка по договорам", unit:"rub"},
  {id:"margin", title:"Маржа, ₽", unit:"rub"},
  {id:"contracts", title:"Продажи всего", unit:"int"},
  {id:"qualified", title:"Целевые заявки", unit:"int"}
];

const GLOBAL_METRICS = MAIN_METRICS.concat([
  {id:"vkSales", title:"Продажи из ВКонтакте", unit:"int"},
  {id:"callsSales", title:"Продажи из звонков", unit:"int", noPlan:true}
]);

const AVITO_METRICS = [
  {id:"avitoBudget", title:"Бюджет рекламы Авито", unit:"rub", smallerIsBetter:true, budget:true},
  {id:"avitoLeads", title:"Заявки с Авито", unit:"int"},
  {id:"avitoCpl", title:"Стоимость заявки Авито", unit:"rub", smallerIsBetter:true},
  {id:"avitoSales", title:"Продажи с Авито", unit:"int"},
  {id:"avitoCostSale", title:"Стоимость продажи Авито", unit:"rub2", smallerIsBetter:true}
];

function format(n, unit) {
  if (n === null || n === undefined) return "—";
  if (unit === "rub") return rub(n);
  if (unit === "rub2") return decimal2.format(n) + " ₽";
  return rubles.format(n);
}

function diffText(actual, goal, unit) {
  if (goal == null) return "План не задан";
  const diff = actual - goal;
  if (Math.abs(diff) < .005) return "Точно по плану";
  return (diff > 0 ? "Выше плана на " : "До плана ") + format(Math.abs(diff), unit);
}

function updateKpis(name) {
  const p = REPORT.plans[name];
  MAIN_METRICS.forEach(metric => {
    const actual = REPORT.actual[metric.id];
    const target = p[metric.id];
    const completion = target ? actual / target * 100 : 0;
    const planNode = document.querySelector('[data-plan="' + metric.id + '"]');
    const pctNode = document.querySelector('[data-pct="' + metric.id + '"]');
    const progress = document.querySelector('[data-progress="' + metric.id + '"]');
    const delta = document.querySelector('[data-delta="' + metric.id + '"]');
    planNode.textContent = format(target, metric.unit);
    pctNode.textContent = pct(completion);
    progress.style.width = Math.min(100, Math.max(0, completion)) + "%";
    progress.classList.toggle("below", completion < 100);
    delta.textContent = diffText(actual, target, metric.unit);
    progress.parentElement.setAttribute("role", "progressbar");
    progress.parentElement.setAttribute("aria-label", "Выполнение плана: " + metric.title);
    progress.parentElement.setAttribute("aria-valuemin", "0");
    progress.parentElement.setAttribute("aria-valuemax", "100");
    progress.parentElement.setAttribute("aria-valuenow", String(Math.min(100, Math.round(completion))));
    progress.parentElement.setAttribute("aria-valuetext", pct(completion));
  });
}

function createCell(tag, value, classes) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (classes) node.className = classes;
  if (tag === "th") node.scope = "row";
  return node;
}

function performance(metric, name) {
  if (metric.noPlan) return {label:"Без плана", status:"neutral"};
  const goal = REPORT.plans[name][metric.id];
  const actual = REPORT.actual[metric.id];
  if (goal == null || goal === 0) return {label:"Без плана", status:"neutral"};
  const ratio = actual / goal * 100;
  const isGood = metric.smallerIsBetter ? actual <= goal : actual >= goal;
  if (metric.smallerIsBetter) {
    const change = Math.abs(actual / goal * 100 - 100);
    if (Math.abs(actual - goal) < .001) return {label:"По плану",status:"good"};
    if (metric.budget) return {label:actual > goal ? "Перерасход " + pct(change) : "Экономия " + pct(change),status:actual > goal ? "bad":"good"};
    return {label:(actual <= goal ? "Дешевле на " : "Дороже на ") + pct(change),status:isGood?"good":"bad"};
  }
  return {label:pct(ratio),status:isGood?"good":"bad"};
}

function buildTable(rows, elementId, name) {
  const body = document.getElementById(elementId);
  body.replaceChildren();
  rows.forEach(metric => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell("th",metric.title));
    for (const option of ["realistic","optimistic"]) {
      tr.appendChild(createCell("td",format(REPORT.plans[option][metric.id],metric.unit),option===name?"cell-highlight":""));
    }
    tr.appendChild(createCell("td",format(REPORT.actual[metric.id],metric.unit),"cell-actual"));
    const status = performance(metric,name);
    const td = document.createElement("td");
    const badge = createCell("span",status.label,"result "+status.status);
    td.appendChild(badge);
    tr.appendChild(td);
    body.appendChild(tr);
  });
}

function render() {
  const name = scenario.value === "optimistic" ? "optimistic":"realistic";
  updateKpis(name);
  buildTable(GLOBAL_METRICS,"company-table",name);
  buildTable(AVITO_METRICS,"avito-table",name);
  document.querySelectorAll("[data-scenario-label]").forEach(node => {
    node.textContent = name === "realistic" ? "Реалистичный прогноз" : "Оптимистичный прогноз";
  });
}

scenario.addEventListener("change",render);
render();
