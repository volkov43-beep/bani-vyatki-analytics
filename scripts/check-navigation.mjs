#!/usr/bin/env node
/* Iteration 02: dependency-free navigation semantics and interactions. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = name => readFileSync(resolve(root, name), "utf8");
const pages = ["index.html","sources.html","sales.html","managers.html","cycle.html"];
const navCss = read("navigation.css");
const navJs = read("navigation.js");
let checks=0;
function check(ok, message){assert.ok(ok, message);checks++;}

check(navCss.includes(".bv-nav-ready .sidebar:not(.bv-nav-open) nav#bv-primary-nav"),"JS-only mobile collapse rule missing");
check(navCss.includes(".sidebar nav") && navCss.includes("display: grid;"),"No-JS mobile navigation must remain visible");
check(navCss.includes("@media (max-width: 720px)"),"Mobile shell breakpoint missing");
check(navCss.includes("@media (min-width: 721px) and (max-width: 1140px)"),"Tablet rail breakpoint missing");
check(navCss.includes(":focus-visible"),"Keyboard focus styling missing");

for(const page of pages){
  const h=read(page);
  check(h.includes('href="./navigation.css"'),"Navigation stylesheet missing in "+page);
  check(h.includes('<script src="./navigation.js" defer></script>'),"Defer navigation script missing in "+page);
  check(h.indexOf('href="./navigation.css"')>h.indexOf('href="./styles.css"'),
    "Navigation CSS must load after shared base: "+page);
  const cssIndex=h.lastIndexOf('href="./'+(page==="index.html"?"styles.css":page.replace(".html",".css"))+'"');
  check(h.indexOf('href="./navigation.css"')>=cssIndex,"Navigation CSS must override page styles: "+page);
  check((h.match(/id="bv-primary-nav"/g)||[]).length===1,"Nav ID not unique: "+page);
  check((h.match(/aria-controls="bv-primary-nav"/g)||[]).length===1,"Menu aria-controls missing: "+page);
  check((h.match(/class="bv-menu-toggle"/g)||[]).length===1,"Missing toggle: "+page);
  check((h.match(/aria-current="page"/g)||[]).length===1,"Exactly one current page link required: "+page);
  check((h.match(/class="bv-nav-label"/g)||[]).length===6,"Five page links + pending label expected: "+page);
  check((h.match(/aria-hidden="true"/g)||[]).length>=7,"Decorative icons must be hidden: "+page);
  for(const dest of pages){
    if(dest===page)continue;
    check(h.includes('href="./'+dest+'"'),"Navigation link missing "+page+" -> "+dest);
  }
  check(!h.includes('aria-controls="side-menu"'),"Legacy nav found: "+page);
}

function fakeUI(initialMobile=true, legacyListener=false) {
  const events={};
  const flags=new Set();
  const attrs={};
  const classes=new Set();
  const label={textContent:"Меню"};
  let focused=false;
  const toggle={
    setAttribute:(k,v)=>{attrs[k]=String(v)},
    addEventListener:(k,fn)=>{events["toggle:"+k]=fn},
    querySelector:(sel)=>sel===".bv-menu-toggle-text"?label:null,
    focus:()=>{focused=true},
  };
  const nav={
    addEventListener:(k,fn)=>{events["nav:"+k]=fn},
  };
  const sidebar={
    querySelector:(sel)=>sel===".bv-menu-toggle"?toggle:null,
    contains:target=>target?.insideSidebar===true,
    classList:{
      toggle:(name,enabled)=>{if(enabled)classes.add(name);else classes.delete(name)}
    }
  };
  const media={matches:initialMobile};
  if(legacyListener)media.addListener=fn=>{events["media:change"]=fn};
  else media.addEventListener=(k,fn)=>{events["media:"+k]=fn};
  const document={
    querySelector:sel=>sel===".sidebar"?sidebar:null,
    getElementById:id=>id==="bv-primary-nav"?nav:null,
    addEventListener:(k,fn)=>{events["doc:"+k]=fn},
    documentElement:{classList:{add:name=>flags.add(name)}}
  };
  const window={matchMedia:expr=>{
    check(expr==="(max-width: 720px)","Unexpected breakpoint in JS");
    return media;
  }};
  runInNewContext(navJs,{document,window},{filename:"navigation.js",timeout:1000});
  return {events,flags,classes,attrs,label,media,wasFocused:()=>focused};
}

const s=fakeUI(true);
check(s.flags.has("bv-nav-ready"),"JS-enhanced flag absent");
check(s.attrs["aria-expanded"]==="false","Mobile menu should start collapsed");
check(!s.classes.has("bv-nav-open"),"Menu unexpectedly open at start");
check(s.attrs["aria-label"]==="Открыть меню разделов","Initial accessible name incorrect");
s.events["toggle:click"]();
check(s.classes.has("bv-nav-open"),"Click must open menu");
check(s.attrs["aria-expanded"]==="true","Click must update aria-expanded");
check(s.label.textContent==="Закрыть","Open button label incorrect");
s.events["doc:keydown"]({key:"Escape"});
check(!s.classes.has("bv-nav-open"),"Escape must close menu");
check(s.wasFocused(),"Escape must return focus to toggle");
s.events["toggle:click"]();
s.events["doc:pointerdown"]({target:{insideSidebar:true}});
check(s.classes.has("bv-nav-open"),"Click inside sidebar must keep menu open");
s.events["doc:pointerdown"]({target:{insideSidebar:false}});
check(!s.classes.has("bv-nav-open"),"Outside pointerdown must close menu");
s.events["toggle:click"]();
s.events["nav:click"]({target:{closest:selector=>selector==="a[href]"?{}:null}});
check(!s.classes.has("bv-nav-open"),"Navigation link must close menu");
s.events["toggle:click"]();
s.media.matches=false;
s.events["media:change"]();
check(!s.classes.has("bv-nav-open"),"Breakpoint must clear mobile open state");
check(s.attrs["aria-expanded"]==="false","Breakpoint aria-expanded must reset");
s.media.matches=true;
s.events["media:change"]();
check(!s.classes.has("bv-nav-open"),"Returning to mobile must stay collapsed");

const legacy=fakeUI(true,true);
legacy.events["toggle:click"]();
legacy.media.matches=false;
legacy.events["media:change"]();
check(!legacy.classes.has("bv-nav-open"),"Legacy media listener fallback must reset");

const desktop=fakeUI(false);
desktop.events["toggle:click"]();
check(!desktop.classes.has("bv-nav-open"),"Desktop should not expand mobile nav");
check(desktop.attrs["aria-expanded"]==="false","Desktop aria-expanded should remain false");

process.stdout.write("PASS: "+checks+" navigation structure and interaction assertions.\n");
