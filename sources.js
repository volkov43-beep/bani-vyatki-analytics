"use strict";
/* Раздел 02: интерактивная аналитика сентябрьского снимка CRM. Без сетевых запросов. */
(() => {
  const dataset = window.BV_SOURCES;
  const names = dataset.sourceNames;
  const ids = dataset.sourceIds;
  const colors = ["#276b4d", "#ac7d55", "#d4af66", "#a4b0a8"];
  const state = { source: "all", view: "all", day: 14 };
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat("ru-RU").format(n);
  const percent = (n, d) => d ? (100 * n / d).toLocaleString("ru-RU", {minimumFractionDigits:1,maximumFractionDigits:1}) + "%" : "—";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const reasonKeys = ["spam", "noDialogue", "noReply"];
  const reasonLabels = ["Спам и предложения", "Не вышли на диалог", "Нет ответа после рассылки"];

  const monthly = ids.map((id, index) => ({
    id, index, name: names[index],
    total:sum(dataset.daily.map(d => d[1][index])),
    qualified:sum(dataset.daily.map(d => d[2][index])),
    contracts:dataset.contracts[id],
    reasons:dataset.reasons[id]
  }));
  const totalMonthly = sum(monthly.map(s => s.total));
  const qualifiedMonthly = sum(monthly.map(s => s.qualified));
  if (totalMonthly !== 222 || qualifiedMonthly !== 122) {
    throw new Error("Контроль агрегатов CRM: ожидается 222 обращения и 122 целевых");
  }

  function selectedRows() {
    return state.source === "all" ? monthly : monthly.filter(x => x.id === state.source);
  }
  function filteredNumber(arr) {
    if (state.source === "all") return sum(arr);
    return arr[ids.indexOf(state.source)];
  }
  function dayData(day) {
    const record = dataset.daily[day - 1];
    return {total:filteredNumber(record[1]), qualified:filteredNumber(record[2]), raw:record};
  }
  function setSource(source) {
    state.source = ids.includes(source) ? source : "all";
    $("sourceFilter").value = state.source;
    draw();
  }
  function setView(view) {
    state.view = view === "qualified" ? "qualified" : "all";
    $("viewAll").classList.toggle("is-active", state.view === "all");
    $("viewQualified").classList.toggle("is-active", state.view === "qualified");
    $("viewAll").setAttribute("aria-pressed", String(state.view === "all"));
    $("viewQualified").setAttribute("aria-pressed", String(state.view === "qualified"));
    drawDaily();
  }
  function drawKpis() {
    const rows = selectedRows();
    const total = sum(rows.map(x => x.total));
    const q = sum(rows.map(x => x.qualified));
    $("totalKpi").textContent = fmt(total);
    $("qualifiedKpi").textContent = fmt(q);
    $("shareKpi").textContent = percent(q, total);
    $("excludedKpi").textContent = fmt(total - q);
  }
  function svgElement(name, attrs={}, text) {
    const el=document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key,val])=>el.setAttribute(key,String(val)));
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function tooltipContent(day) {
    const d=dayData(day);
    const detail = state.source === "all"
      ? ids.map((id,i) => `<span class="tooltip-small">${names[i]}: ${d.raw[state.view === "all" ? 1 : 2][i]}</span>`).join("<br>")
      : `<span class="tooltip-small">Целевые: ${d.qualified} из ${d.total}</span>`;
    return `<b>${day} сентября</b><br>${state.view === "all" ? "Обращений" : "Целевых"}: ${state.view === "all" ? d.total : d.qualified}<br>${detail}`;
  }
  function drawDaily() {
    const svg=$("dailyChart"), tooltip=$("chartTooltip"), wrap=svg.parentElement;
    svg.replaceChildren();
    const L=39,R=12,T=14,B=40,W=920,H=305,PW=W-L-R,PH=H-T-B;
    const counts=dataset.daily.map(d=>filteredNumber(d[state.view === "all"?1:2]));
    const maxVal=Math.max(...counts, 1);
    const step = maxVal <= 4 ? 1 : maxVal <= 10 ? 2 : maxVal <= 20 ? 5 : 10;
    const yMax=Math.ceil(maxVal/step)*step;
    for(let v=0;v<=yMax;v+=step){
      const y=T+PH-v/yMax*PH;
      svg.appendChild(svgElement("line", {x1:L,y1:y,x2:W-R,y2:y,stroke:v===0?"#d9dfd6":"#e9ece5","stroke-width":1,"stroke-dasharray":v===0?"":"4 5"}));
      svg.appendChild(svgElement("text",{x:L-11,y:y+4,"text-anchor":"end",fill:"#93a396","font-size":11},v));
    }
    const gap=PW/30;
    const bWidth=Math.min(18,gap*.66);
    for(let index=0;index<30;index++){
      const d=dataset.daily[index],day=d[0], x=L+index*gap+(gap-bWidth)/2;
      if(day===state.day) svg.appendChild(svgElement("rect",{x:x-5,y:T-5,width:bWidth+10,height:PH+13,fill:"#eef5ea",rx:6}));
      let accum=0;
      ids.forEach((id,j)=>{
        if(state.source !== "all" && state.source!==id)return;
        const value=d[state.view === "all"?1:2][j];
        if(!value)return;
        const h=value/yMax*PH;
        const y=T+PH-(accum+value)/yMax*PH;
        svg.appendChild(svgElement("rect",{x,y,width:bWidth,height:h,rx:1.5,fill:colors[j]}));
        accum+=value;
      });
      const labelDays=[1,5,10,14,18,23,28,30];
      if(labelDays.includes(day)){
        svg.appendChild(svgElement("text",{x:x+bWidth/2,y:H-13,"text-anchor":"middle",fill:day===state.day?"#205941":"#9aa69b","font-size":11,"font-weight":day===state.day?750:500},day));
      }
      const hit=svgElement("rect",{x:x-4,y:T-4,width:bWidth+8,height:PH+7,fill:"transparent",style:"cursor:pointer",tabindex:0,role:"button","aria-label":`${day} сентября: ${dayData(day).total} обращений, ${dayData(day).qualified} целевых`});
      const showTooltip = e => {
        tooltip.innerHTML=tooltipContent(day);
        tooltip.hidden=false;
        const box=wrap.getBoundingClientRect();
        const px=e.clientX ? e.clientX-box.left : x*box.width/W;
        const py=e.clientY ? e.clientY-box.top : (T+20)*box.height/H;
        tooltip.style.left=Math.max(4,Math.min(box.width-194,px-75))+"px";
        tooltip.style.top=Math.max(0,Math.min(box.height-100,py-104))+"px";
      };
      hit.addEventListener("mouseenter",showTooltip);
      hit.addEventListener("mousemove",showTooltip);
      hit.addEventListener("mouseleave",()=>tooltip.hidden=true);
      hit.addEventListener("focus",showTooltip);
      hit.addEventListener("blur",()=>tooltip.hidden=true);
      hit.addEventListener("click",()=>{state.day=day;drawDaily()});
      hit.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();state.day=day;drawDaily()}});
      svg.appendChild(hit);
    }
    const d=dayData(state.day);
    $("selectedDayLabel").textContent=state.day+" сентября";
    $("selectedDayDetails").textContent=fmt(d.total)+" обращений · "+fmt(d.qualified)+" целевых";
    tooltip.hidden=true;
    const legend=$("sourceLegend");legend.replaceChildren();
    monthly.forEach((row,j)=>{
      const b=document.createElement("button");b.type="button";b.className=state.source===row.id?"selected":"";
      const dot=document.createElement("i");dot.style.background=colors[j];b.appendChild(dot);
      b.appendChild(document.createTextNode(row.name));
      b.setAttribute("aria-pressed",String(state.source===row.id));
      b.addEventListener("click",()=>setSource(state.source===row.id?"all":row.id));
      legend.appendChild(b);
    });
  }
  function drawShares() {
    const total=totalMonthly;
    const vals=monthly.map(x=>x.total);
    const boundaries=[];let run=0;
    monthly.forEach((row,i)=>{const a=run/total*360;run+=row.total;boundaries.push(`${colors[i]} ${a.toFixed(3)}deg ${(run/total*360).toFixed(3)}deg`)});
    $("shareDonut").style.background=`conic-gradient(${boundaries.join(",")})`;
    const dn=$("shareDonut").firstElementChild;
    dn.querySelector("strong").textContent=fmt(sum(selectedRows().map(x=>x.total)));
    dn.querySelector("small").textContent=state.source==="all"?"обращения": "выбранный канал";
    const container=$("sharesList");container.replaceChildren();
    monthly.forEach((row,i)=>{
      const b=document.createElement("button");b.type="button";
      b.className=state.source===row.id?"selected":"";
      b.setAttribute("aria-pressed",String(state.source===row.id));
      const dot=document.createElement("i");dot.style.background=colors[i];b.appendChild(dot);
      const name=document.createElement("span");name.textContent=row.name;b.appendChild(name);
      const count=document.createElement("strong");count.textContent=fmt(row.total);b.appendChild(count);
      const share=document.createElement("em");share.textContent=percent(row.total,total);b.appendChild(share);
      b.addEventListener("click",()=>setSource(state.source===row.id?"all":row.id));
      container.appendChild(b);
    });
  }
  function drawQuality() {
    const container=$("qualityRows");container.replaceChildren();
    monthly.forEach(row=>{
      const div=document.createElement("div");
      div.className="quality-row"+(state.source===row.id?" active":"");
      const title=document.createElement("div");title.className="name";title.textContent=row.name;div.appendChild(title);
      const bar=document.createElement("div");bar.className="track";
      const yes=document.createElement("span"),no=document.createElement("span");
      yes.style.width=(row.qualified/row.total*100)+"%";
      no.style.width=((row.total-row.qualified)/row.total*100)+"%";
      yes.title=`Целевые: ${row.qualified}`;no.title=`Исключены: ${row.total-row.qualified}`;
      bar.append(yes,no);div.appendChild(bar);
      const ratio=document.createElement("div");ratio.className="rate";ratio.textContent=percent(row.qualified,row.total);div.appendChild(ratio);
      container.appendChild(div);
    });
    const rows=selectedRows();const q=sum(rows.map(x=>x.qualified)),total=sum(rows.map(x=>x.total));
    document.querySelector(".quality-badge").textContent=fmt(q)+" из "+fmt(total);
  }
  function drawReasons() {
    const rows=selectedRows();
    const totals=reasonKeys.map(key=>sum(rows.map(row=>row.reasons[key])));
    const container=$("lossReasons");container.replaceChildren();
    totals.forEach((v,i)=>{
      const el=document.createElement("div");el.className="loss-item";
      const symbol=document.createElement("span");symbol.className="loss-symbol";symbol.textContent=["×","↘","…"][i];
      const title=document.createElement("span");title.className="loss-title";title.textContent=reasonLabels[i];
      const value=document.createElement("strong");value.textContent=fmt(v);
      el.append(symbol,title,value);container.appendChild(el);
    });
    const st=state.source==="all"?"Все источники":selectedRows()[0].name;
    $("lossSubtitle").textContent=st+", по снимку CRM";
  }
  function drawTable() {
    const rows=selectedRows();const table=$("sourcesTable");table.replaceChildren();
    rows.forEach(row=>{
      const tr=document.createElement("tr");
      if(state.source===row.id)tr.className="selected-row";
      const cells=[row.name,fmt(row.total),fmt(row.qualified),fmt(row.total-row.qualified),percent(row.qualified,row.total),fmt(row.contracts)];
      cells.forEach((val,i)=>{
        const el=document.createElement(i===0?"th":"td");
        el.textContent=val;
        if(i===0)el.scope="row";
        if(i===2||i===4)el.className="high";
        tr.appendChild(el);
      });table.appendChild(tr);
    });
    const footer=document.createElement("tr");footer.className="s-total-row";
    const total=sum(rows.map(x=>x.total)),q=sum(rows.map(x=>x.qualified)),contract=sum(rows.map(x=>x.contracts));
    ["Итого",fmt(total),fmt(q),fmt(total-q),percent(q,total),fmt(contract)].forEach((val,i)=>{
      const el=document.createElement(i===0?"th":"td");el.textContent=val;if(i===0)el.scope="row";footer.appendChild(el);
    });table.appendChild(footer);
  }
  function draw() {drawKpis();drawDaily();drawShares();drawQuality();drawReasons();drawTable()}
  $("sourceFilter").addEventListener("change",e=>setSource(e.target.value));
  $("viewAll").addEventListener("click",()=>setView("all"));
  $("viewQualified").addEventListener("click",()=>setView("qualified"));
  $("resetDay").addEventListener("click",()=>{state.day=14;drawDaily()});
  draw();
})();
