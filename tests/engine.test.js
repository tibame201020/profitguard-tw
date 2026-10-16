import test from "node:test";
import assert from "node:assert/strict";
import {parseCsv,normalize,simulate,minPrice,reportCsv,analyze} from "../engine.js";
import {readFileSync} from "node:fs";
const sample=()=>parseCsv(readFileSync(new URL("../examples/sample.csv",import.meta.url),"utf8"));
test("three sample SKUs parse and analyze",()=>{
 const r=sample().map(analyze);
 assert.equal(r.length,3);
 assert.ok(r.every(x=>x.sku && Number.isFinite(x.profit) && x.min_price!==null));
});
test("commission cap is per item, not order total",()=>{
 let o=normalize({...sample()[0],price:"40000",commission_rate:"0.1",payment_rate:"0",seller_discount:"0",unit_cost:"0"});
 assert.equal(simulate(o).commission,3500);
});
test("platform-funded subsidy enters settlement/payment base; seller coupon reduces price",()=>{
 let o=normalize({...sample()[0],price:"100",seller_discount:"10",shipping_income:"20",platform_subsidy:"5",unit_cost:"0",shipping_cost:"0",packing_cost:"0",ads_cost:"0",commission_rate:"0",payment_rate:"0.1"});
 let v=simulate(o);assert.equal(v.proceeds,115);assert.equal(v.payment,12);assert.equal(v.profit,103);
});
test("threshold fee discontinuity searches both sides instead of invalid global binary search",()=>{
 let o=normalize({...sample()[1],price:"101",unit_cost:"0",shipping_cost:"0",packing_cost:"0",ads_cost:"0",commission_rate:"0",payment_rate:"0",activity_mode:"threshold_fixed",activity_rate:"0.06",activity_fixed:"60",activity_threshold:"100",target_profit:"92"});
 assert.equal(simulate(o,99).profit,93);
 assert.equal(simulate(o,100).profit,40);
 assert.equal(minPrice(o),98);
});
test("CSV escaped quote and newline round-trip parser",()=>{
 const t=sample();
 const csv='sku,'+Object.keys(t[0]).filter(x=>x!=="sku").join(",")+"\n\"A,\"\"B\"\"\nC\","+Object.keys(t[0]).filter(x=>x!=="sku").map(x=>t[0][x]).join(",");
 assert.equal(parseCsv(csv)[0].sku,'A,"B"\nC');
});
test("malicious sku cannot become spreadsheet formula on export",()=>{
 const r=analyze({...sample()[0],sku:"=HYPERLINK(\"bad\")"});
 assert.ok(reportCsv([r]).includes('"\'=HYPERLINK(""bad"")"'));
});
test("reject malformed/negative/rate overload, avoid silent corrupted rows",()=>{
 assert.throws(()=>normalize({...sample()[0],qty:"-1"}),/不可為負數/);
 assert.throws(()=>normalize({...sample()[0],payment_rate:"banana"}),/有效數字/);
 assert.throws(()=>normalize({...sample()[0],activity_mode:"unlisted"}),/無效/);
 assert.throws(()=>parseCsv("a,b\nx,y"),/欄位/);
});
test("price floor is actual minimum and satisfies target across sample",()=>{
 for(const raw of sample()){
  const o=normalize(raw), floor=minPrice(o);
  assert.ok(simulate(o,floor).profit>=o.target_profit);
  for(let p=Math.max(1,floor-5);p<floor;p++) {
   const s=simulate(o,p);assert.ok(!s || s.profit<o.target_profit);
  }
 }
});
