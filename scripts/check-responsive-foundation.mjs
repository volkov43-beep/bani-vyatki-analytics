#!/usr/bin/env node
/*
 * Bani Vyatki Analytics · NeuroLab Web responsive foundation checks.
 * Dependency-free structural and analytics tests; no files are changed.
 * Browser reflow, contrast and zoom tests are planned separately.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const read=name=>readFileSync(resolve(root,name),"utf8");
const pages=["index.html","sources.html","sales.html","managers.html","cycle.html"];
const cssFiles=["design-system.css","styles.css","sources.css","sales.css","managers.css","cycle.css"];
const cssForPage={
  "index.html":null,
  "sources.html":"sources.css",
  "sales.html":"sales.css",
  "managers.html":"managers.css",
  "cycle.html":"cycle.css"
};
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
const design=read("design-system.css");
const base=read("styles.css");
const defined=new Set([...design.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m=>m[1]));
function token(name){
 const escaped=name.replace(/[-/\\^$*+?.()|[\]{}]/g,"\\$&");
 const match=design.match(new RegExp("--"+escaped+"\\s*:\\s*([^;]+);"));
 return match?.[1]?.trim()??null;
}
function contrast(hexA,hexB){
 const luminance=hex=>{
  const rgb=hex.slice(1).match(/.{2}/g).map(x=>parseInt(x,16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 };
 const a=luminance(hexA),b=luminance(hexB);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
const baseline={
 "bv-layout-max-width":"1650px",
 "bv-sidebar-width":"240px",
 "bv-sidebar-width-compact":"215px",
 "bv-sidebar-width-rail":"70px",
 "bv-gutter-desktop":"36px",
 "bv-gutter-compact":"26px",
 "bv-gutter-mobile":"12px",
 "bv-color-forest":"#0f352a",
 "bv-color-page":"#f4f3ef",
 "bv-color-surface":"#fffefb",
 "bv-color-surface-bright":"#fffefa",
 "bv-color-gold-decorative":"#d0ac72"
};
for(const [key,expected] of Object.entries(baseline)){
 check(token(key)===expected,"Baseline design token changed: --"+key);
}
check(contrast(token("bv-color-secondary-ink"),token("bv-color-surface"))>=4.5,
  "Proposed readable muted text token fails 4.5:1 on light surface");
const aliases={
 forest:"bv-color-forest",forest2:"bv-color-forest-light",
 gold:"bv-color-gold-decorative",gold2:"bv-color-gold-light",
 cream:"bv-color-warm-cream",panel:"bv-color-surface",
 ink:"bv-color-ink",muted:"bv-color-legacy-muted",
 border:"bv-color-border",green:"bv-color-success",shadow:"bv-shadow-panel"
};
for(const [alias,target] of Object.entries(aliases)){
 check(token(alias)==="var(--"+target+")","Missing legacy CSS alias --"+alias);
}
for(const file of cssFiles){
 const s=read(file);
 for(const [,name] of s.matchAll(/var\(\s*--(bv-[a-z0-9-]+)/g)){
  check(defined.has(name),"Undeclared semantic token --"+name+" used in "+file);
 }
 // Structural brace check, not a full CSS parser.
 const cleaned=s.replace(/\/\*[\s\S]*?\*\//g,"").replace(/"[^"]*"|'[^']*'/g,"");
 let depth=0;
 for(const ch of cleaned){
  if(ch==="{")depth++;
  if(ch==="}")depth--;
  check(depth>=0,"Unexpected closing CSS brace: "+file);
 }
 check(depth===0,"Unbalanced CSS braces: "+file);
}
for(const page of pages){
 const html=read(page);
 const tokenAt=html.indexOf('href="./design-system.css"');
 const baseAt=html.indexOf('href="./styles.css"');
 check(tokenAt>=0,"No design-system.css on "+page);
 check(baseAt>tokenAt,"Stylesheet order wrong on "+page);
 check((html.match(/href="\.\/design-system\.css"/g)||[]).length===1,"Duplicate tokens import on "+page);
 if(cssForPage[page]){
  const mod=cssForPage[page];
  check(html.indexOf('href="./'+mod+'"')>baseAt,"Page CSS order wrong: "+page);
  check(read(mod).includes("var(--bv-layout-max-width)"),"Missing shared max-width: "+mod);
  check(read(mod).includes("var(--bv-gutter-desktop)"),"Missing desktop gutter: "+mod);
 }
 check(/<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/.test(html),
  "Missing viewport meta: "+page);
 check((html.match(/<main\b/g)||[]).length===1,"Expected single main element: "+page);
 check((html.match(/<\/main>/g)||[]).length===1,"Unclosed main element: "+page);
 check(html.includes('class="app-shell"'),"Missing shared app shell: "+page);
 for(const destination of pages){
  if(destination===page)continue;
  check(html.includes('href="./'+destination+'"'),"Broken page navigation "+page+" -> "+destination);
 }
}
check(!/^\s*:root\s*\{\s*--forest\s*:/m.test(base),"Legacy values still duplicated in base styles");
check(base.includes("var(--bv-layout-max-width)"),"Shared max-width is not tokenized");
check(base.includes("var(--bv-sidebar-width)"),"Shared sidebar is not tokenized");
for(const width of ["1460px","1140px","720px","390px"]){
 check(base.includes("@media(max-width:"+width+")"),"Shell breakpoint is missing: "+width);
}
// Only aggregate records: protect the approved September numbers from refactors.
function fixtures(name){
 const sandbox={window:{}};
 runInNewContext(read(name),sandbox,{timeout:1000,filename:name});
 return sandbox.window;
}
const managers=fixtures("managers-data.js").BV_MANAGERS;
const sources=fixtures("sources-data.js").BV_SOURCES;
const sales=fixtures("sales-data.js").BV_SALES;
const cycle=fixtures("cycle-data.js").BV_CYCLE_INPUT;
check(managers.deals.length===13,"September contracts changed");
check(managers.deals.reduce((t,d)=>t+d.revenue,0)===5643000,"September revenue changed");
check(managers.company.marginRub===1240000,"September margin changed");
check(sources.daily.reduce((t,d)=>t+d[1].reduce((a,b)=>a+b,0),0)===222,"September inquiries changed");
check(sources.daily.reduce((t,d)=>t+d[2].reduce((a,b)=>a+b,0),0)===122,"September target inquiries changed");
check(sales.summary.contracts===13 && sales.summary.revenue===5643000,"Sales summary changed");
check(cycle.knownStarts.length===13,"Deal cycle sample changed");

process.stdout.write("PASS: "+checks+" structural and data integrity checks. Browser QA remains pending.\n");
