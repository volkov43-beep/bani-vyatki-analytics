"use strict";
(() => {
  const D=window.BV_MANAGERS;
  if(!D||!Array.isArray(D.managers))return;
  const $ = id=>document.getElementById(id);
  const rubles = new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0});
  const oneDecimal = new Intl.NumberFormat("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1});
  const money = n=>rubles.format(n)+" ₽";
  const pct = n=>oneDecimal.format(n)+"%";
  const sourceIds=D.sources.map(s=>s.id);
  const state={manager:"all",source:"all"};
  const sum=o=>Object.values(o).reduce((x,y)=>x+y,0);
  const value=(m,key)=>state.source==="all"?sum(m[key]):m[key][state.source]||0;
  const selectedManagers=()=>state.manager==="all"?D.managers:D.managers.filter(m=>m.id===state.manager);
  const make=(tag,cls,txt)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  };
  const nameNode=(m)=>{
    const root=make("span","mgr-employee-cell");
    const icon=make("span","mgr-avatar",m.initials);
    const names=make("span","mgr-employee-text");
    names.append(make("strong","",m.name),make("small","",m.role));
    root.append(icon,names);
    return root;
  };

  function assertData(){
    const col=key=>D.managers.reduce((a,m)=>a+sum(m[key]),0);
    if(col("incoming")!==D.company.incoming||col("qualified")!==D.company.qualified)throw new Error("Manager workload totals do not reconcile to CRM export");
    if(col("contractsKnown")!==D.company.attributedContracts||col("revenueKnown")!==D.company.attributedRevenue)throw new Error("Contract attribution differs from original marketing report");
    if(D.company.contracts!==D.company.attributedContracts+D.company.unattributedContracts)throw new Error("Unattributed contracts mismatch");
    if(D.company.revenue!==D.company.attributedRevenue+D.company.unattributedRevenue)throw new Error("Unattributed revenue mismatch");
    for(const m of D.managers){for(const s of sourceIds){if(m.qualified[s]>m.incoming[s])throw new Error("Qualified > total for "+m.id+" "+s);}}
  }

  function bars(){
    const root=$("mgrBars");root.replaceChildren();
    const rows=[...selectedManagers()].sort((a,b)=>value(b,"incoming")-value(a,"incoming"));
    const max=Math.max(1,...rows.map(m=>value(m,"incoming")));
    for(const m of rows){
      const all=value(m,"incoming"),qual=value(m,"qualified");
      const b=make("button","mgr-bar-line"+(state.manager===m.id?" selected":""));
      b.type="button";b.title="Фильтр по сотруднику: "+m.name;
      b.setAttribute("aria-pressed",String(state.manager===m.id));
      const n=make("span","mgr-bar-name",m.name);
      const track=make("span","mgr-bar-graph");
      const totalFill=make("span","all-part");
      totalFill.style.width=(all?all/max*100:0)+"%";
      const qFill=make("span","qualified-part");
      qFill.style.width=(qual?qual/max*100:0)+"%";
      track.append(totalFill,qFill);
      const num=make("b","",rubles.format(all)+" / ");
      num.append(make("small","",rubles.format(qual)));
      b.append(n,track,num);
      b.addEventListener("click",()=>{
        state.manager=state.manager===m.id?"all":m.id;
        $("mgrPerson").value=state.manager;
        render();
      });
      root.appendChild(b);
    }
  }

  function resultRows(){
    const rows=[...selectedManagers()].sort((a,b)=>value(b,"incoming")-value(a,"incoming"));
    $("mgrTableCount").textContent=rows.length+" "+(rows.length===1?"сотрудник":rows.length<5?"сотрудника":"сотрудников");
    const node=$("mgrTable");node.replaceChildren();
    for(const m of rows){
      const all=value(m,"incoming"),qualified=value(m,"qualified");
      const contracts=value(m,"contractsKnown"),rev=value(m,"revenueKnown");
      const tr=make("tr",state.manager===m.id?"active-row":"");
      const name=make("th");name.scope="row";name.append(nameNode(m));
      tr.append(name);
      tr.append(make("td","",rubles.format(all)));
      tr.append(make("td","qualified-num",rubles.format(qualified)));
      const share=make("td");
      share.append(make("span","mgr-quality-pill"+(all&&qualified/all<.4?" low":""),all?pct(qualified/all*100):"—"));
      tr.append(share);
      tr.append(make("td",contracts>0?"known-sales":"muted-cell",contracts>0?rubles.format(contracts):"—"));
      tr.append(make("td",rev>0?"known-sales":"muted-cell",rev>0?money(rev):"—"));
      tr.append(make("td",contracts>0?"":"muted-cell",contracts>0?money(Math.round(rev/contracts)):"—"));
      node.appendChild(tr);
    }
  }

  function sourceMatrix(){
    const out=$("mgrMatrix");out.replaceChildren();
    const max=Math.max(1,...D.managers.flatMap(m=>sourceIds.map(id=>m.incoming[id])));
    for(const m of selectedManagers()){
      const row=make("tr");
      const label=make("th","",m.name);label.scope="row";row.appendChild(label);
      for(const id of sourceIds){
        const count=m.incoming[id];
        const td=make("td");
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

  function render(){
    bars();resultRows();sourceMatrix();
  }
  $("mgrSource").addEventListener("change",e=>{state.source=e.target.value;render();});
  $("mgrPerson").addEventListener("change",e=>{state.manager=e.target.value;render();});
  assertData();
  plans();
  render();
})();
