import {parseCsv,analyze,reportCsv} from "./engine.js";
const $ = id => document.getElementById(id);
let last=[];
const money=n=> n==null?"超出範圍":new Intl.NumberFormat("zh-TW",{maximumFractionDigits:2}).format(n);
const set=(id,v)=>$(id).textContent=v;
function render(raws){
  last=[];const errors=[];
  for(let i=0;i<raws.length;i++){
    try {last.push(analyze(raws[i]));}
    catch(e){errors.push("第 "+(i+2)+" 列："+e.message);}
  }
  set("errors",errors.join("\n"));
  set("count",last.length);
  set("losses",last.filter(x=>x.status==="虧損").length);
  set("under",last.filter(x=>x.status==="低於目標").length);
  set("total","$"+money(last.reduce((n,x)=>n+x.profit,0)));
  const body=$("results");body.replaceChildren();
  for(const r of last){
    const tr=document.createElement("tr");
    const cols=[r.sku,r.price,r.qty,r.proceeds,r.commission,r.payment,r.activity,r.costs,r.profit,r.margin+"%",r.min_price,r.status];
    for(let i=0;i<cols.length;i++){
      const td=document.createElement("td");td.textContent=(i===10 && cols[i]===null)?"超出範圍":String(cols[i]);
      if(i===8 || i===11)td.className=r.status==="虧損"?"loss":r.status==="低於目標"?"warn":"ok";
      tr.append(td);
    }
    body.append(tr);
  }
  if(!last.length)body.innerHTML='<tr><td colspan="12">無有效資料</td></tr>';
  $("export").disabled=!last.length;
}
async function loadText(text){
  try {const rows=parseCsv(text);if(rows.length>2000)throw Error("一次最多處理 2000 筆商品");render(rows);}
  catch(e){render([]);set("errors",e.message);}
}
$("file").addEventListener("change",async ev=>{
  const f=ev.target.files?.[0];if(!f)return;
  if(f.size>2_000_000){set("errors","CSV 上限 2MB");return;}
  await loadText(await f.text());
});
$("sample").addEventListener("click",async()=>{
  try {const r=await fetch("./examples/sample.csv");if(!r.ok)throw Error("無法載入示範");await loadText(await r.text());}
  catch(e){set("errors",e.message);}
});
$("export").addEventListener("click",()=>{
  if(!last.length)return;
  const file=new Blob([reportCsv(last)],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(file),a=document.createElement("a");
  a.href=url;a.download="profitguard-report.csv";document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
});
