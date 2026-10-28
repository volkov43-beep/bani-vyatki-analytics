#!/usr/bin/env node
/**
 * Bani Vyatki Analytics: public Pages defensive scan.
 * Scans deployed HTML/CSS/JS for common CRM webhook credentials, embedded
 * API secrets and Russian customer phone numbers. This is defense-in-depth:
 * it cannot prove that public code has no personal data, so manual review
 * remains mandatory. Do not add real secrets even for testing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const files=readdirSync(root).filter(name=>/\.(?:html|css|js)$/.test(name));
const patterns=[
  ["Bitrix incoming-webhook credentials",/https?:\/\/[^\s"'<>]+\/rest\/\d+\/[A-Za-z0-9_-]{8,}\/?/gi],
  ["Embedded secret or access token",/\b(?:client_secret|access_token|api[_-]?key|webhook_secret)\s*[:=]\s*["'][^\s"']{12,}["']/gi],
  ["Bearer authorization header",/\bBearer\s+[A-Za-z0-9_.-]{20,}\b/gi],
  ["Russian phone-like personal number",/\+7[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g],
];
let findings=[];
for(const name of files){
  const source=readFileSync(resolve(root,name),"utf8");
  for(const [label,re] of patterns){
    re.lastIndex=0;
    for(const match of source.matchAll(re)){
      const line=source.slice(0,match.index).split("\n").length;
      findings.push(name+":"+line+" "+label);
    }
  }
}
if(findings.length){
  process.stderr.write("FAIL: potentially sensitive public asset content:\n"+findings.join("\n")+"\n");
  process.exitCode=1;
}else{
  process.stdout.write("PASS: "+files.length+" public HTML/CSS/JS assets contain no recognized webhook/token/phone patterns. Manual privacy review is still required.\n");
}
