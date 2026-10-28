"use strict";
(() => {
  const data = window.BV_SALES;
  if (!data || !Array.isArray(data.stageGroups)) return;
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat("ru-RU", {maximumFractionDigits:0}).format(n);
  const fmtPct = n => new Intl.NumberFormat("ru-RU", {minimumFractionDigits:1,maximumFractionDigits:1}).format(n) + "%";
  const sum = values => values.reduce((acc,n) => acc+n,0);
  const ids = data.sources.map(s=>s.id);
  const sourcePos = id => ids.indexOf(id);
  const state = {metric:"contracts",source:"all"};
  const countFor = entry => state.source==="all" ? sum(entry.counts) : entry.counts[sourcePos(state.source)] ?? 0;
  const currentSource = () => data.sources.find(s=>s.id===state.source);
  const totalCohort = () => state.source==="all" ? data.summary.cohort : currentSource().cohort;

  function create(tag, cls, content) {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(content!==undefined)el.textContent=String(content);
    return el;
  }

  function drawTrend() {
    const isRevenue=state.metric==="revenue";
    const rows=data.monthly;
    const ceiling=Math.max(...rows.map(r=>r[state.metric]));
    const wrap=$("salesTrend");
    wrap.replaceChildren();
    rows.forEach((row,i)=>{
      const col=create("div","month-col");
      const value=create("span","month-value",isRevenue?(row.revenue/1e6).toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:2})+" млн ₽":row.contracts);
      const bar=create("div","month-bar");
      const h=Math.max(4,Math.round(148*row[state.metric]/ceiling));
      bar.style.height=h+"px";
      bar.title=row.name+" 2026: "+(isRevenue?fmt(row.revenue)+" ₽":row.contracts+" договоров");
      const label=create("span","month-label",row.label);
      col.append(value,bar,label);
      wrap.appendChild(col);
    });
    const diff=data.monthly[3][state.metric]-data.monthly[2][state.metric];
    $("trendDiff").textContent=(diff>0?"+":"")+(isRevenue?fmt(diff)+" ₽":fmt(diff)+" договоров");
    ["contracts","revenue"].forEach(m=>{
      const btn=$(m==="contracts"?"metricContracts":"metricRevenue");
      btn.classList.toggle("active",state.metric===m);
      btn.setAttribute("aria-pressed",String(state.metric===m));
    });
    wrap.setAttribute("aria-label",isRevenue ? "Выручка по договорам за четыре месяца" : "Количество заключённых договоров за четыре месяца");
  }

  function setSource(value) {
    state.source=value;
    $("pipelineSource").value=value;
    renderSourceBars();
    drawStages();
    drawReasons();
  }

  function renderSourceBars() {
    const node=$("contractSources");node.replaceChildren();
    data.sources.forEach(src=>{
      const b=create("button","contract-source");
      b.type="button";
      b.setAttribute("aria-pressed",String(state.source===src.id));
      b.setAttribute("aria-label",src.name+": "+src.deals+" договоров. Выбрать источник для анализа стадий.");
      b.title="Показать стадии обращений источника «"+src.name+"»";
      const name=create("span","contract-name",src.name);
      const bar=create("span","contract-track");
      const fill=create("i");
      fill.style.width=(src.deals/data.summary.contracts*100)+"%";
      fill.style.background=src.color;
      bar.appendChild(fill);
      const value=create("b","",src.deals);
      b.append(name,bar,value);
      b.addEventListener("click",()=>setSource(state.source===src.id?"all":src.id));
      node.appendChild(b);
    });
  }

  function drawStages() {
    const total=totalCohort();
    const counts=data.stageGroups.map(countFor);
    const excluded=counts.at(-1);
    const qualified=total-excluded;
    if(sum(counts)!==total)throw Error("CRM stages must sum to selected source cohort: "+sum(counts)+" vs "+total);
    $("cohortTotal").textContent=fmt(total)+" "+(total===1?"обращение":total<5?"обращения":"обращений");
    $("cohortSubtitle").textContent=(currentSource()?.name||"Все источники")+" · срез выгрузки";
    $("qualifiedStageCount").textContent=fmt(qualified);
    $("excludedStageCount").textContent=fmt(excluded);
    const q=total?100*qualified/total:0;
    $("stageQualifiedPct").textContent=fmtPct(q);
    $("stageDonut").style.background="conic-gradient(#25794f 0 "+q+"%, #d8ded2 "+q+"% 100%)";
    $("stageDonut").setAttribute("aria-label",fmt(qualified)+" целевых и "+fmt(excluded)+" исключённых из "+fmt(total)+" обращений");
    const max=Math.max(...counts,1);
    const node=$("stageBars");node.replaceChildren();
    data.stageGroups.forEach((entry,i)=>{
      const amount=counts[i];
      const row=create("div","stage-row");
      row.title=entry.detail+": "+fmt(amount)+" из "+fmt(total);
      const name=create("span","stage-name",entry.title);
      const bar=create("div","stage-track");
      const fill=create("span");
      fill.style.width=amount?Math.max(2,100*amount/max)+"%":"0%";
      fill.style.background=entry.color;
      bar.appendChild(fill);
      const v=create("span","stage-count",fmt(amount));
      const share=create("small","",total?Math.round(amount/total*100)+"%":"0%");
      v.appendChild(share);
      row.append(name,bar,v);
      node.appendChild(row);
    });
  }

  function drawReasons() {
    const rows=data.reasons.map(reason=>({title:reason.title,count:countFor(reason),type:reason.type}))
      .filter(row=>row.count>0).sort((a,b)=>b.count-a.count);
    const total=sum(rows.map(r=>r.count));
    $("reasonsTotal").textContent=fmt(total)+" обращений";
    const max=rows.length?rows[0].count:1;
    const container=$("lossRows");container.replaceChildren();
    if(!rows.length){container.appendChild(create("p","sales-caption","В выбранном источнике причин потерь не зафиксировано."));return;}
    rows.forEach(row=>{
      const line=create("div","loss-line");
      const text=create("span","",row.title);
      const track=create("div","loss-track");
      const fill=create("i");
      fill.style.width=Math.max(2,row.count/max*100)+"%";
      fill.style.background=row.type==="lost"?"#a8735b":"#c8ae91";
      track.appendChild(fill);
      const number=create("b","",fmt(row.count));
      line.append(text,track,number);
      container.appendChild(line);
    });
  }

  $("pipelineSource").addEventListener("change",e=>setSource(e.target.value));
  $("metricContracts").addEventListener("click",()=>{state.metric="contracts";drawTrend();});
  $("metricRevenue").addEventListener("click",()=>{state.metric="revenue";drawTrend();});
  drawTrend();renderSourceBars();drawStages();drawReasons();
})();
