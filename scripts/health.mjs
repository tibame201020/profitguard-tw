const base="https://tibame201020.github.io/profitguard-tw/";
const checks=[
 ["index","",/ProfitGuard TW/],
 ["application","app.js",/reportCsv/],
 ["engine","engine.js",/export function analyze/],
 ["sample","examples/sample.csv",/activity_mode/]
];
let failed=false;
for(const [label,path,signature] of checks){
 try{
  const response=await fetch(base+path+"?health="+Date.now(),{signal:AbortSignal.timeout(15000)});
  const content=await response.text();
  if(response.status!==200||!signature.test(content))throw Error("HTTP "+response.status+" signature="+signature.test(content));
  console.log("PASS",label,"HTTP",response.status,"bytes",Buffer.byteLength(content));
 }catch(e){failed=true;console.error("FAIL",label,e.message);}
}
if(failed)process.exitCode=1;
