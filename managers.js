"use strict";
/* Менеджеры · сентябрь 2026 · статический прототип.
   Договоры и суммы берутся из обезличенных строк BV_MANAGERS.deals.
   Маржа = null до её заполнения в сделках Битрикс24. */
(() => {
  const D=window.BV_MANAGERS;
  if(!D||!Array.isArray(D.managers)||!Array.isArray(D.deals))return;

  const $=id=>document.getElementById(id);
  const rubles=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0});
  const oneDecimal=new Intl.NumberFormat("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1});
  const money=n=>rubles.format(n)+" ₽";
  const pct=n=>oneDecimal.format(n)+"%";
  const dealLabel=n=>{
    const tens=n%100,units=n%10;
    return n+" "+(tens>=11&&tens<=14?"договоров":units===1?"договор":units>=2&&units<=4?"договора":"договоров");
  };
  const sourceIds=D.sources.map(s=>s.id);
  const state={manager:"all",source:"all"};
  const sumObject=o=>Object.values(o).reduce((x,y)=>x+y,0);
  const sumNumbers=nums=>nums.reduce((x,y)=>x+y,0);
  const value=(m,key)=>state.source==="all"?sumObject(m[key]):m[key][state.source]||0;
  const selectedManagers=()=>state.manager==="all"?D.managers:D.managers.filter(m=>m.id===state.manager);
  const dealsForManager=m=>D.deals.filter(d=>d.manager===m.id&&(state.source==="all"||d.source===state.source));
  const selectedDeals=()=>D.deals.filter(d=>(state.manager==="all"||d.manager===state.manager)&&(state.source==="all"||d.source===state.source));
  const revenue=deals=>sumNumbers(deals.map(d=>d.revenue));
  const margin=deals=>{
    if(!deals.length||deals.some(d=>d.marginRub===null||d.marginRub===undefined||!Number.isFinite(d.marginRub)))return null;
    return sumNumbers(deals.map(d=>d.marginRub));
  };
  const make=(tag,cls,txt)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  };
  const nameNode=m=>{
    const root=make("span","mgr-employee-cell");
    const icon=make("span","mgr-avatar",m.initials);
    const names=make("span","mgr-employee-text");
    names.append(make("strong","",m.name),make("small","",m.role));
    root.append(icon,names);
    return root;
  };

  function assertData(){
    const total=key=>sumNumbers(D.managers.map(m=>sumObject(m[key])));
    if(total("incoming")!==D.company.incoming||total("qualified")!==D.company.qualified)
      throw new Error("Данные обращений по менеджерам не совпадают с CRM");
    if(D.deals.length!==D.company.contracts||revenue(D.deals)!==D.company.revenue)
      throw new Error("Договоры и выручка менеджеров не совпадают с итогом месяца");
    if(D.deals.some(d=>!sourceIds.includes(d.source)||!D.managers.some(m=>m.id===d.manager)||!Number.isFinite(d.revenue)||d.revenue<=0))
      throw new Error("Ошибка в данных договора");
    for(const m of D.managers){
      for(const source of sourceIds){
        if(m.qualified[source]>m.incoming[source])throw new Error("Целевых обращений больше общего количества");
      }
    }
    const expectedSources={avito:8,vk:3,calls:2,other:0};
    for(const source of sourceIds){
      const actual=D.deals.filter(d=>d.source===source).length;
      if(actual!==expectedSources[source])throw new Error("Не совпадают продажи по источнику "+source);
    }
  }

  function bars(){
    const root=$("mgrBars");root.replaceChildren();
    const rows=[...selectedManagers()].sort((a,b)=>value(b,"incoming")-value(a,"incoming"));
    const max=Math.max(1,...rows.map(m=>value(m,"incoming")));
    for(const m of rows){
      const all=value(m,"incoming"),qual=value(m,"qualified");
      const b=make("button","mgr-bar-line"+(state.manager===m.id?" selected":""));
      b.type="button";b.title="Фильтр по сотруднику: "+m.name;
      b.setAttribute("data-manager",m.id);
      b.setAttribute("aria-label",m.name+": всего "+all+", целевых "+qual+". Выбрать сотрудника");
      b.setAttribute("aria-pressed",String(state.manager===m.id));
      const n=make("span","mgr-bar-name",m.name);
      const track=make("span","mgr-bar-graph");
      const totalFill=make("span","all-part");totalFill.style.width=(all?all/max*100:0)+"%";
      const qFill=make("span","qualified-part");qFill.style.width=(qual?qual/max*100:0)+"%";
      track.append(totalFill,qFill);
      const num=make("b","",rubles.format(all)+" / ");
      num.append(make("small","",rubles.format(qual)));
      b.append(n,track,num);
      b.addEventListener("click",()=>{
        state.manager=state.manager===m.id?"all":m.id;
        $("mgrPerson").value=state.manager;
        render();
        // Re-render replaces the row button: return keyboard focus to its successor.
        $("mgrBars").querySelector('[data-manager="'+m.id+'"]')?.focus({preventScroll:true});
      });
      root.appendChild(b);
    }
  }

  function revenueBars(){
    const rows=selectedManagers().map(m=>{
      const deals=dealsForManager(m);
      return {manager:m,deals:deals.length,revenue:revenue(deals)};
    }).sort((a,b)=>b.revenue-a.revenue);
    const total=sumNumbers(rows.map(r=>r.revenue));
    const root=$("mgrRevenueBars");root.replaceChildren();
    for(const row of rows){
      const share=total?row.revenue/total*100:0;
      const wrapper=make("div","mgr-revenue-row");
      const head=make("div","mgr-revenue-head");
      head.append(make("span","",row.manager.name),make("b","",money(row.revenue)));
      const track=make("div","mgr-revenue-track");
      const fill=make("i");fill.style.width=share+"%";
      track.appendChild(fill);
      const foot=make("div","mgr-revenue-foot");
      foot.append(make("span","",dealLabel(row.deals)),make("strong","",pct(share)));
      wrapper.append(head,track,foot);root.appendChild(wrapper);
    }
    $("mgrRevenueTotal").textContent=money(total);
  }

  function resultRows(){
    const rows=[...selectedManagers()].sort((a,b)=>revenue(dealsForManager(b))-revenue(dealsForManager(a)));
    $("mgrTableCount").textContent=rows.length+" "+(rows.length===1?"сотрудник":rows.length<5?"сотрудника":"сотрудников");
    const group=selectedDeals(),totalRevenue=revenue(group);
    const body=$("mgrTable");body.replaceChildren();
    for(const m of rows){
      const all=value(m,"incoming"),qualified=value(m,"qualified");
      const deals=dealsForManager(m),contracts=deals.length,rev=revenue(deals);
      const mgrMargin=margin(deals),share=totalRevenue?rev/totalRevenue*100:0;
      const tr=make("tr",state.manager===m.id?"active-row":"");
      const name=make("th");name.scope="row";name.append(nameNode(m));tr.append(name);
      tr.append(make("td","known-sales",rubles.format(contracts)));
      tr.append(make("td",rev>0?"known-sales":"muted-cell",rev?money(rev):"—"));
      tr.append(make("td",rev>0?"mgr-financial-share":"muted-cell",pct(share)));
      tr.append(make("td",contracts>0?"":"muted-cell",contracts?money(Math.round(rev/contracts)):"—"));
      const marginCell=make("td",mgrMargin===null?"muted-cell":"known-sales");
      marginCell.append(mgrMargin===null?make("span","mgr-margin-missing","—"):make("span","",money(mgrMargin)));
      tr.append(marginCell);
      tr.append(make("td","",rubles.format(all)));
      tr.append(make("td","qualified-num",rubles.format(qualified)));
      const shareCell=make("td");
      shareCell.append(make("span","mgr-quality-pill"+(all&&qualified/all<.4?" low":""),all?pct(qualified/all*100):"—"));
      tr.append(shareCell);
      body.appendChild(tr);
    }

    const totalLine=make("tr");
    const label=make("th","","Итого в фильтре");label.scope="row";
    totalLine.appendChild(label);
    totalLine.append(make("td","",rubles.format(group.length)));
    totalLine.append(make("td","",money(totalRevenue)));
    totalLine.append(make("td","",totalRevenue?"100,0%":"—"));
    totalLine.append(make("td","",group.length?money(Math.round(totalRevenue/group.length)):"—"));
    const totalMargin=margin(group);
    totalLine.append(make("td","",totalMargin===null?"—":money(totalMargin)));
    const sumIncoming=sumNumbers(rows.map(m=>value(m,"incoming")));
    const sumQualified=sumNumbers(rows.map(m=>value(m,"qualified")));
    totalLine.append(make("td","",rubles.format(sumIncoming)));
    totalLine.append(make("td","",rubles.format(sumQualified)));
    totalLine.append(make("td","",sumIncoming?pct(sumQualified/sumIncoming*100):"—"));
    $("mgrTableTotal").replaceChildren(totalLine);
  }

  function dealRows(){
    const group=selectedDeals();
    const root=$("mgrDeals");root.replaceChildren();
    $("mgrDealsCount").textContent=dealLabel(group.length);
    const sourceNames=Object.fromEntries(D.sources.map(s=>[s.id,s.title]));
    const managerNames=Object.fromEntries(D.managers.map(m=>[m.id,m.name]));
    if(!group.length){
      const tr=make("tr");
      const td=make("td","mgr-deal-empty","Договоров по выбранным фильтрам нет");
      td.colSpan=5;tr.append(td);root.append(tr);
    }
    for(const deal of group){
      const tr=make("tr");
      tr.append(make("td","mgr-deal-date",deal.date+".2026"));
      tr.append(make("td","",managerNames[deal.manager]));
      tr.append(make("td","",sourceNames[deal.source]));
      tr.append(make("td","known-sales",money(deal.revenue)));
      const m=make("td");
      m.append(make("span",deal.marginRub===null?"mgr-margin-placeholder":"known-sales",deal.marginRub===null?"Не заполнено":money(deal.marginRub)));
      tr.append(m);root.append(tr);
    }
    const footer=make("tr");
    const label=make("th","","Итого");label.colSpan=3;label.scope="row";
    footer.append(label,make("td","",money(revenue(group))),make("td","",margin(group)===null?"—":money(margin(group))));
    $("mgrDealsTotals").replaceChildren(footer);
  }

  function sourceMatrix(){
    const out=$("mgrMatrix");out.replaceChildren();
    const max=Math.max(1,...D.managers.flatMap(m=>sourceIds.map(id=>m.incoming[id])));
    for(const m of selectedManagers()){
      const row=make("tr");
      const label=make("th","",m.name);label.scope="row";row.appendChild(label);
      for(const id of sourceIds){
        const count=m.incoming[id],td=make("td");
        const heat=make("span","mgr-heat-cell",rubles.format(count));
        const intensity=.06+.33*count/max;
        heat.style.background="rgba(51,126,83,"+intensity.toFixed(3)+")";
        if(state.source===id)heat.style.outline="2px solid #c29d63";
        td.appendChild(heat);row.appendChild(td);
      }
      out.appendChild(row);
    }
  }

  function plans(){
    const wrap=$("mgrPlans");wrap.replaceChildren();
    for(const row of D.marginPlans){
      const item=make("div","mgr-plan-item"+(row.name.includes("не указан")?" unmapped":""));
      item.append(make("b","",row.name),make("strong","",money(row.amount)),make("small","",row.note));
      wrap.appendChild(item);
    }
  }


  /** One data model for desktop tables and mobile financial cards. */
  function mobileValue(label,amount,cls=""){
    const box=make("div","mgr-card-value"+(cls?" "+cls:""));
    box.append(make("span","",label),make("b","",amount));
    return box;
  }
  function mobileTitle(title,subtitle=""){
    const header=make("div","mgr-card-title");
    header.append(make("strong","",title));
    if(subtitle)header.append(make("small","",subtitle));
    return header;
  }

  function mobileSummary(){
    const root=$("mgrSummaryCards");root.replaceChildren();
    const group=selectedDeals(),totalRevenue=revenue(group);
    const rows=[...selectedManagers()].sort((a,b)=>revenue(dealsForManager(b))-revenue(dealsForManager(a)));
    for(const m of rows){
      const deals=dealsForManager(m),rev=revenue(deals),all=value(m,"incoming"),qualified=value(m,"qualified");
      const mgrMargin=margin(deals);
      const card=make("article","mgr-summary-card"+(state.manager===m.id?" is-selected":""));
      card.appendChild(mobileTitle(m.name,m.role));
      const badge=make("span","mgr-card-badge"+(deals.length?"":" is-empty"),dealLabel(deals.length));
      card.appendChild(badge);
      const block=make("div","mgr-card-revenue");
      block.append(make("span","","Выручка по договорам"),make("strong","",money(rev)));
      card.appendChild(block);
      const values=make("div","mgr-card-values");
      [
        mobileValue("Доля выручки",pct(totalRevenue?rev/totalRevenue*100:0)),
        mobileValue("Средний чек",deals.length?money(Math.round(rev/deals.length)):"—"),
        mobileValue("Маржа, ₽",mgrMargin===null?"Нет данных":money(mgrMargin),"is-margin"),
        mobileValue("Обращения",rubles.format(all)),
        mobileValue("Целевые обращения",rubles.format(qualified),"is-qualified"),
        mobileValue("Доля целевых",all?pct(qualified/all*100):"—")
      ].forEach(node=>values.appendChild(node));
      card.appendChild(values);
      root.appendChild(card);
    }
    const total=make("div","mgr-mobile-total");
    total.append(make("strong","","Итого по выбранным фильтрам"),
      make("span","",dealLabel(group.length)+" · "+money(totalRevenue)));
    const summary=make("div","mgr-card-values");
    const totalIn=sumNumbers(rows.map(m=>value(m,"incoming")));
    const totalQ=sumNumbers(rows.map(m=>value(m,"qualified")));
    summary.append(
      mobileValue("Маржа по договорам",margin(group)===null?"Нет данных":money(margin(group)),"is-margin"),
      mobileValue("Обращения",rubles.format(totalIn)),
      mobileValue("Целевые обращения",rubles.format(totalQ),"is-qualified"),
      mobileValue("Доля целевых",totalIn?pct(totalQ/totalIn*100):"—")
    );
    total.appendChild(summary);
    root.appendChild(total);
  }

  function mobileDeals(){
    const root=$("mgrDealCards");root.replaceChildren();
    const deals=selectedDeals();
    const src=Object.fromEntries(D.sources.map(s=>[s.id,s.title]));
    const manager=Object.fromEntries(D.managers.map(m=>[m.id,m.name]));
    if(!deals.length){
      root.appendChild(make("p","mgr-panel-note","По выбранным фильтрам договоров нет."));
    }
    for(const d of deals){
      const card=make("article","mgr-deal-card");
      card.appendChild(mobileTitle(d.date+".2026",manager[d.manager]));
      const block=make("div","mgr-card-revenue");
      block.append(make("span","","Выручка по договору"),make("strong","",money(d.revenue)));
      card.appendChild(block);
      const values=make("div","mgr-card-values");
      values.append(
        mobileValue("Источник",src[d.source]),
        mobileValue("Маржа по сделке, ₽",d.marginRub===null?"Не заполнено":money(d.marginRub),"is-margin")
      );
      card.appendChild(values);
      root.appendChild(card);
    }
    const total=make("div","mgr-mobile-total");
    total.append(make("strong","","Итого по договорам"),
      make("span","",dealLabel(deals.length)+" · "+money(revenue(deals))),
      make("span","",margin(deals)===null?"Маржа: нет данных":"Маржа: "+money(margin(deals))));
    root.appendChild(total);
  }

  function mobileMatrix(){
    const root=$("mgrMatrixCards");root.replaceChildren();
    for(const m of selectedManagers()){
      const card=make("article","mgr-matrix-card"+(state.manager===m.id?" is-selected":""));
      card.appendChild(mobileTitle(m.name,"Обращения сентября по каналам"));
      const grid=make("div","mgr-card-values");
      for(const s of D.sources){
        grid.appendChild(mobileValue(s.title,rubles.format(m.incoming[s.id]),
          state.source===s.id?"is-source-selected":""));
      }
      card.appendChild(grid);
      root.appendChild(card);
    }
  }

  function updateScrollHints(){
    document.querySelectorAll("#managerDashboard .mgr-table-scroll, #managerDashboard .mgr-matrix-scroll")
      .forEach(region=>{
        const hint=region.nextElementSibling;
        if(!hint || !hint.classList.contains("mgr-scroll-hint"))return;
        const visible=window.getComputedStyle(region).display!=="none";
        hint.classList.toggle("is-visible",visible && region.scrollWidth>region.clientWidth+2);
      });
  }
  function updateReset(){
    const button=$("mgrResetFilters");
    button.disabled=state.manager==="all"&&state.source==="all";
  }

  function render(){
    bars();revenueBars();resultRows();dealRows();sourceMatrix();
    mobileSummary();mobileDeals();mobileMatrix();
    updateReset();updateScrollHints();
  }
  $("mgrSource").addEventListener("change",e=>{state.source=e.target.value;render();});
  $("mgrPerson").addEventListener("change",e=>{state.manager=e.target.value;render();});
  $("mgrResetFilters").addEventListener("click",()=>{
    state.manager="all";state.source="all";
    $("mgrPerson").value="all";$("mgrSource").value="all";
    render();
  });
  window.addEventListener("resize",updateScrollHints,{passive:true});
  window.addEventListener("load",updateScrollHints);
  assertData();
  plans();
  render();
  // Keep desktop tables visible if JS fails to build mobile alternatives.
  document.documentElement.classList.add("bv-managers-ready");
  updateScrollHints();
})();