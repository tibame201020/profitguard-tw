// Standalone, dependency-free order simulator. All inputs are one SKU per hypothetical order.
// Rate fields are fractions (0.025 means 2.5%). Fees are rounded to whole TWD.
export const COLUMNS = [
  "sku","price","qty","unit_cost","seller_discount","shipping_income",
  "platform_subsidy","shipping_cost","packing_cost","ads_cost","other_cost",
  "commission_rate","payment_rate","activity_mode","activity_rate",
  "activity_fixed","activity_threshold","target_profit"
];
const numeric = COLUMNS.filter(x => !["sku","activity_mode"].includes(x));
const allowedModes = new Set(["none","rate","threshold_fixed"]);
const roundTwd = n => Math.round((n + Number.EPSILON) * 1000 / 1000);
const finite = (v, key) => {
  if (v === "" || v == null || !Number.isFinite(Number(v))) throw Error(key + " 必須是有效數字");
  const n = Number(v);
  if (n < 0) throw Error(key + " 不可為負數");
  return n;
};
export function normalize(raw) {
  const o = {sku:String(raw.sku ?? "").trim(),activity_mode:String(raw.activity_mode ?? "").trim()};
  if (!o.sku || o.sku.length > 100) throw Error("sku 不可空白且長度不可超過 100");
  if (!allowedModes.has(o.activity_mode)) throw Error(o.sku + ": activity_mode 無效");
  for (const k of numeric) o[k] = finite(raw[k],o.sku + ": " + k);
  if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > 10000) throw Error(o.sku + ": qty 必須為 1 至 10000 的整數");
  if (!Number.isInteger(o.price) || o.price < 1 || o.price > 1000000) throw Error(o.sku + ": price 必須為 1 至 1000000 的整數");
  for (const k of ["commission_rate","payment_rate","activity_rate"]) if (o[k] > 0.9) throw Error(o.sku + ": " + k + " 超出 0%～90%");
  if (o.commission_rate + o.payment_rate + (o.activity_mode === "rate" ? o.activity_rate : 0) >= 0.95) throw Error(o.sku + ": 費率合計過高");
  if (o.seller_discount >= o.price * o.qty) throw Error(o.sku + ": 賣家折扣不可大於或等於商品總額");
  return o;
}
export function simulate(o, price=o.price) {
  if (!Number.isInteger(price) || price < 1 || price > 1000000) throw Error("價格超出允許範圍");
  const gross = price * o.qty;
  const goods = gross - o.seller_discount;
  if (goods <= 0) return null;
  // Product price after seller-funded discount is allocated equally across quantity for fee cap.
  const perUnit = goods / o.qty;
  const commission = roundTwd(Math.min(perUnit,35000) * o.qty * o.commission_rate);
  // Payment base explicitly includes buyer-paid shipping and platform-funded discounts.
  const paymentBase = goods + o.shipping_income + o.platform_subsidy;
  const payment = roundTwd(paymentBase * o.payment_rate);
  let activity = 0;
  if (o.activity_mode === "rate") activity = roundTwd(goods * o.activity_rate);
  if (o.activity_mode === "threshold_fixed") activity = goods < o.activity_threshold
    ? roundTwd(goods * o.activity_rate) : roundTwd(o.activity_fixed);
  const proceeds = paymentBase;
  const costs = o.unit_cost*o.qty + o.shipping_cost + o.packing_cost + o.ads_cost + o.other_cost;
  const profit = +(proceeds - costs - commission - payment - activity).toFixed(2);
  return {
    sku:o.sku,price,qty:o.qty,goods,proceeds,commission,payment,activity,costs,
    profit,margin:proceeds>0?+(profit/proceeds*100).toFixed(2):0
  };
}
function boundarySearch(o, low, high) {
  if (low>high) return null;
  let first=null;
  while (low<=high) {
    const mid=Math.floor((low+high)/2), s=simulate(o,mid);
    if (s && s.profit>=o.target_profit) { first=mid;high=mid-1; }
    else low=mid+1;
  }
  return first;
}
export function minPrice(o) {
  const minimum=Math.max(1,Math.floor(o.seller_discount/o.qty)+1);
  // threshold_fixed has a fee discontinuity; search both monotonic regions independently.
  const pieces = o.activity_mode==="threshold_fixed"
    ? [
      [minimum,Math.ceil((o.activity_threshold + o.seller_discount)/o.qty)-1],
      [Math.max(minimum,Math.ceil((o.activity_threshold + o.seller_discount)/o.qty)),1000000]
    ] : [[minimum,1000000]];
  const found=pieces.map(([a,b])=>boundarySearch(o,a,Math.min(b,1000000))).filter(x=>x!==null);
  return found.length?Math.min(...found):null;
}
export function analyze(raw) {
  const o=normalize(raw), now=simulate(o), floor=minPrice(o);
  return {...now, target_profit:o.target_profit, min_price:floor,
    gap:floor===null?null:floor-o.price,
    status:now.profit<0?"虧損":now.profit<o.target_profit?"低於目標":"達標"};
}
export function parseCsv(input) {
  const rows=[]; let row=[],cell="",quoted=false;
  const s=String(input).replace(/^\uFEFF/,"");
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(quoted){
      if(c==='"' && s[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quoted=false;
      else cell+=c;
    } else if(c==='"') {
      if(cell!=="") throw Error("CSV 引號位置錯誤");
      quoted=true;
    } else if(c===","){row.push(cell);cell="";}
    else if(c==="\n" || c==="\r"){
      if(c==="\r" && s[i+1]==="\n")i++;
      row.push(cell);cell="";
      if(row.some(v=>v!==""))rows.push(row);
      row=[];
    } else cell+=c;
  }
  if(quoted) throw Error("CSV 引號未關閉");
  row.push(cell);if(row.some(v=>v!==""))rows.push(row);
  if(!rows.length) throw Error("CSV 沒有資料");
  const headers=rows.shift().map(x=>x.trim());
  if(headers.length!==COLUMNS.length || new Set(headers).size!==headers.length || COLUMNS.some(x=>!headers.includes(x))) throw Error("CSV 欄位不符合範本");
  return rows.map((r,i)=>{
    if(r.length!==headers.length)throw Error("第 "+(i+2)+" 列欄數錯誤");
    return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));
  });
}
function quoteCsv(x){
  let s=String(x??"");
  // Prevent CSV formula injection in common spreadsheet programs.
  if(/^[\s]*[=+@-]/.test(s) && !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function reportCsv(items){
  const cols=["sku","price","qty","proceeds","commission","payment","activity","costs","profit","margin","target_profit","min_price","gap","status"];
  return "\uFEFF"+[cols.join(","),...items.map(x=>cols.map(k=>quoteCsv(x[k])).join(","))].join("\r\n");
}
