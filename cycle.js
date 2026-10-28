"use strict";
/* Весь расчёт работает с обезличенными договорами.
 * Цикл = дата договора - дата первого обращения (календарные дни).
 * Если начало неизвестно, цикл = null и не входит в средние/медианы.
 */
(() => {
  const SALES=window.BV_MANAGERS;
  const INPUT=window.BV_CYCLE_INPUT;
  if(!SALES||!INPUT) return;
  const $=id=>document.getElementById(id);
  const RUB=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0});
  const DEC=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1});
  const rub=n=>RUB.format(n)+" ₽";
  const num=n=>DEC.format(n);
  const percent=n=>num(n)+"%";
  const avg=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:null;
  const median=list=>{
    if(!list.length)return null;
    const s=[...list].sort((a,b)=>a-b);
    const mid=Math.floor(s.length/2);
    return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
  };
  const sum=list=>list.reduce((s,n)=>s+n,0);
  const titleCount=(count,singular="договор",plural2="договора",plural5="договоров")=>{
    const v=count%100,n=count%10;
    return RUB.format(count)+" "+(v>=11&&v<=14?plural5:n===1?singular:n>=2&&n<=4?plural2:plural5);
  };
  const el=(name,cls,text)=>{
    const node=document.createElement(name);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const key=item=>[item.date,item.manager,item.source,item.revenue].join("|");
  const UTC=stamp=>{
    const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(stamp||"");
    if(!m)throw new Error("Некорректная дата договора/обращения: "+stamp);
    const d=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
    const value=Date.UTC(year,month-1,d);
    const check=new Date(value);
    if(check.getUTCDate()!==d||check.getUTCMonth()!==month-1||check.getUTCFullYear()!==year)
      throw new Error("Несуществующая дата: "+stamp);
    return value;
  };
  const names=Object.fromEntries(SALES.managers.map(m=>[m.id,m.name]));
  const sources=Object.fromEntries(SALES.sources.map(s=>[s.id,s.title]));
  const state={manager:"all",source:"all",sort:"longest"};
  const dateMap=new Map();
  for(const row of INPUT.knownStarts){
    const k=key(row);
    if(dateMap.has(k))throw new Error("Повторный ключ исходных данных: "+k);
    dateMap.set(k,{firstInquiry:row.firstInquiry,basis:row.basis||"report"});
  }
  const deals=SALES.deals.map((d,index)=>{
    const found=dateMap.get(key(d))??null;
    const end=d.date+".2026";
    const first=found?.firstInquiry??null;
    const basis=found?.basis??null;
    const days=first===null?null:Math.round((UTC(end)-UTC(first))/86400000);
    if(days!==null&&(days<0||days>3650))throw new Error("Ошибка диапазона цикла договора");
    return {...d,firstInquiry:first,dateBasis:basis,contractDate:end,days,anonymousIndex:index+1};
  });

  const filtered=()=>deals.filter(d=>(state.manager==="all"||d.manager===state.manager)&&(state.source==="all"||d.source===state.source));
  const known=rows=>rows.filter(d=>d.days!==null);
  const unknown=rows=>rows.filter(d=>d.days===null);
  const bucket=days=>days<=INPUT.boundaries.quickMax?"fast":days<=INPUT.boundaries.middleMax?"mid":"long";

  function validate(){
    if(deals.length!==13||sum(deals.map(d=>d.revenue))!==5643000)throw new Error("Не сошлись договоры сентября");
    const k=known(deals);
    if(k.length!==INPUT.knownStarts.length||k.length!==13)throw new Error("Неверное число сделок с известным циклом");
    for(const row of INPUT.knownStarts)if(!deals.some(d=>key(d)===key(row)&&d.firstInquiry===row.firstInquiry))
      throw new Error("Дата обращения не сопоставлена с договором");
    const days=k.map(d=>d.days);
    if(Math.abs(avg(days)-(150/13))>1e-10||median(days)!==9||Math.max(...days)!==44)
      throw new Error("Контроль цикла из сентябрьского отчёта не пройден");
    const group={fast:0,mid:0,long:0};
    k.forEach(d=>group[bucket(d.days)]++);
    if(group.fast!==6||group.mid!==6||group.long!==1)throw new Error("Неверное распределение циклов");
    const cross=k.filter(d=>d.firstInquiry.slice(3)!=="09.2026");
    if(cross.length!==4||sum(cross.map(d=>d.revenue))!==1934000)
      throw new Error("Сумма сделок из августовских обращений отличается от отчёта");
  }

  function renderKpis(allRows,rows){
    const durations=rows.map(d=>d.days),mean=avg(durations),med=median(durations);
    const quick=rows.filter(d=>d.days<=7).length;
    const durationText=mean===null?"—":num(mean);
    const medianText=med===null?"—":num(med);
    $("cycleAverage").replaceChildren(durationText+" ",el("small","",mean===null?"":"дн."));
    $("cycleMedian").replaceChildren(medianText+" ",el("small","",med===null?"":"дн."));
    $("cycleQuickShare").replaceChildren(rows.length?num(quick/rows.length*100):"—",el("small","",rows.length?" %":""));
    $("cycleAverageHint").textContent=rows.length?"Учтено: "+titleCount(rows.length)+" с известными датами":"Нет договоров с известным циклом";
    $("cycleQuickNote").textContent=rows.length?quick+" из "+rows.length+" известных продаж:"+" до 7 дней":"Нет циклов с двумя датами";
    $("cycleCoverage").replaceChildren(String(rows.length)+" ",el("small","","из "+allRows.length));
    const share=allRows.length?rows.length/allRows.length*100:0;
    $("cycleCoverageFill").style.width=share+"%";
    $("cycleCoverageHint").textContent=allRows.length?percent(share)+" договоров выбранного набора":"Нет договоров по фильтру";
    $("cycleAvgCompare").textContent=state.manager==="all"&&state.source==="all"?"+4,5 дня к июлю–августу":"По выбранному фильтру";
    $("cycleKnownCount").textContent=titleCount(rows.length);
  }

  function distribution(rows){
    const group={fast:0,mid:0,long:0};
    rows.forEach(row=>group[bucket(row.days)]++);
    const wrap=$("cycleDistribution"),track=$("cycleDistributionTrack");
    wrap.replaceChildren();track.replaceChildren();
    const items=[
      {id:"fast",name:"Быстрые",range:"0–7 дней"},
      {id:"mid",name:"Средние",range:"8–30 дней"},
      {id:"long",name:"Долгие",range:"31+ день"}
    ];
    items.forEach(item=>{
      const box=el("div","cycle-group cycle-"+item.id);
      box.append(el("span","",item.name),el("small","",item.range),
        el("b","",String(group[item.id])),el("em","",rows.length?percent(group[item.id]/rows.length*100):"—"));
      wrap.appendChild(box);
      const segment=el("span",item.id);
      segment.style.width=rows.length?group[item.id]/rows.length*100+"%":"0%";
      segment.setAttribute("title",item.name+": "+group[item.id]);
      track.appendChild(segment);
    });
    track.setAttribute("aria-label",rows.length?"Быстрые "+group.fast+", средние "+group.mid+", долгие "+group.long:"Нет циклов для диаграммы");
  }

  function timeline(rows){
    const wrap=$("cycleTimeline");
    wrap.replaceChildren();
    const sorted=[...rows];
    if(state.sort==="longest")sorted.sort((a,b)=>b.days-a.days||a.contractDate.localeCompare(b.contractDate));
    if(state.sort==="shortest")sorted.sort((a,b)=>a.days-b.days||a.contractDate.localeCompare(b.contractDate));
    if(state.sort==="date")sorted.sort((a,b)=>UTC(a.contractDate)-UTC(b.contractDate)||a.days-b.days);
    if(!sorted.length){
      wrap.appendChild(el("div","cycle-no-data","По выбранным фильтрам нет договоров с известной датой первого обращения."));
    }
    for(const item of sorted){
      const row=el("div","cycle-timeline-row");
      row.title=names[item.manager]+" · "+sources[item.source]+" · "+item.firstInquiry+" → "+item.contractDate+" · "+item.days+" дней"+(item.dateBasis==="crm_created"?" (начало — дата создания сделки CRM)":"");
      const person=el("div","cycle-deal");
      person.append(el("span","",item.contractDate+" · "+names[item.manager]),
        el("small","",sources[item.source]+(item.dateBasis==="crm_created"?" · создано в CRM ":" · обращение ")+item.firstInquiry));
      const rail=el("div","cycle-duration-track");
      const fill=el("i",bucket(item.days));
      // Общая ось 44 дня, не меняется при фильтрации.
      fill.style.width=Math.max(3,item.days/44*100)+"%";
      rail.appendChild(fill);
      row.append(person,rail,el("span","cycle-days",item.days),el("span","cycle-money",rub(item.revenue)));
      wrap.appendChild(row);
    }
    $("cycleTimelineSummary").textContent="Показано "+titleCount(sorted.length)+" с известными датами";
    const max=sorted.length?Math.max(...sorted.map(d=>d.days)):null;
    $("cycleMax").textContent=max===null?"—":max+" "+(max===1?"день":max>=2&&max<=4?"дня":"дней");
  }

  function breakdown(rows,dimension,containerId){
    const node=$(containerId);node.replaceChildren();
    const directory=dimension==="manager"?SALES.managers.map(m=>({id:m.id,name:m.name})):SALES.sources.map(s=>({id:s.id,name:s.title}));
    const groups=directory.map(item=>{
      const all=rows.filter(d=>d[dimension]===item.id);
      const subset=known(all);
      return {...item,full:all.length,known:subset.length,average:avg(subset.map(d=>d.days)),median:median(subset.map(d=>d.days))};
    }).filter(item=>item.full>0||item.known>0).sort((a,b)=>(b.average??-1)-(a.average??-1));
    if(!groups.length){node.appendChild(el("div","cycle-no-data","Нет договоров для выбранных фильтров."));return;}
    const ceiling=Math.max(...groups.map(g=>g.average??0),1);
    for(const group of groups){
      const row=el("div","cycle-breakdown-row");
      const head=el("div","cycle-breakdown-head");
      head.append(el("span","",group.name),el("b","",group.average===null?"—":num(group.average)+" дн."));
      const track=el("div","cycle-breakdown-track");
      const fill=el("i");
      fill.style.width=group.average===null?"0%":Math.max(2,group.average/ceiling*100)+"%";
      track.appendChild(fill);
      const foot=el("div","cycle-breakdown-foot");
      foot.append(el("span","",group.known+" из "+group.full+" договоров с известным циклом"),
        el("strong","",group.median===null?"Медиана —":"Медиана "+num(group.median)+" дн."));
      row.append(head,track,foot);
      node.appendChild(row);
    }
  }

  function dateDetails(rows){
    const items=[...rows].sort((a,b)=>UTC(a.contractDate)-UTC(b.contractDate)||a.revenue-b.revenue);
    const wrap=$("cycleMissingRows");wrap.replaceChildren();
    $("cycleMissingCount").textContent=titleCount(items.length);
    if(!items.length){
      const tr=el("tr");
      const td=el("td","empty","Нет договоров по выбранным фильтрам");
      td.colSpan=7;tr.appendChild(td);wrap.appendChild(tr);
    }
    for(const d of items){
      const tr=el("tr");
      tr.append(el("td","",d.firstInquiry??"—"),
        el("td","",d.contractDate),
        el("td","",names[d.manager]),
        el("td","",sources[d.source]),
        el("td","cycle-table-days",d.days===null?"—":d.days+" дн."),
        el("td","",rub(d.revenue)));
      const basis=el("td");
      const basisText=d.dateBasis==="crm_created"?"Дата создания CRM":"Маркетинговый отчёт";
      basis.appendChild(el("span",d.dateBasis==="crm_created"?"cycle-basis-crm":"cycle-basis-report",basisText));
      tr.appendChild(basis);
      wrap.appendChild(tr);
    }
    const foot=el("tr");
    const label=el("th","","Итого");label.colSpan=5;label.scope="row";
    foot.append(label,el("td","",rub(sum(items.map(d=>d.revenue)))),el("td","",titleCount(items.length)));
    $("cycleMissingTotal").replaceChildren(foot);
  }

  function insight(rows){
    const cross=known(rows).filter(d=>d.firstInquiry.slice(3)!=="09.2026");
    $("cycleInsightLabel").textContent=titleCount(cross.length)+" по обращениям до сентября";
    $("cycleInsightText").textContent=cross.length
      ? "В сентябре "+(cross.length===1?"заключён ":"заключено ")+titleCount(cross.length)+" на "+rub(sum(cross.map(d=>d.revenue)))+" по обращениям, датированным до сентября. Месяц привлечения и месяц продажи важно учитывать отдельно."
      : "В выбранном наборе нет известных продаж по обращениям, поступившим раньше сентября. Для неизвестных дат вывод сделать нельзя.";
  }

  function render(){
    const full=filtered(),rows=known(full);
    renderKpis(full,rows);
    distribution(rows);
    timeline(rows);
    breakdown(full,"manager","cycleManagerBars");
    breakdown(full,"source","cycleSourceBars");
    dateDetails(full);
    insight(full);
  }
  function clear(){
    state.manager="all";state.source="all";state.sort="longest";
    $("cycleManager").value="all";$("cycleSource").value="all";$("cycleSort").value="longest";
    render();
  }
  $("cycleManager").addEventListener("change",e=>{state.manager=e.target.value;render();});
  $("cycleSource").addEventListener("change",e=>{state.source=e.target.value;render();});
  $("cycleSort").addEventListener("change",e=>{state.sort=e.target.value;render();});
  $("cycleReset").addEventListener("click",clear);
  validate();
  render();
})();