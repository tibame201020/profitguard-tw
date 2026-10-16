const path=require("node:path"),fs=require("node:fs"),assert=require("node:assert/strict");
const {chromium}=require(path.resolve(__dirname,"../../queqiao-harness-browser/node_modules/playwright-core"));
(async()=>{
 const exe="C:/Program Files/Google/Chrome/Application/chrome.exe";
 const b=await chromium.launch({executablePath:exe,headless:true});
 const p=await b.newPage({viewport:{width:1280,height:800},acceptDownloads:true});let errors=[];
 p.on("pageerror",e=>errors.push(String(e)));
 try{
  const response=await p.goto("https://tibame201020.github.io/profitguard-tw/",{waitUntil:"networkidle",timeout:20000});
  assert.equal(response.status(),200);
  await p.locator("#sample").click();
  await p.waitForFunction(()=>document.querySelector("#count").textContent==="3");
  assert.equal(await p.locator("#results tr").count(),3);
  const [download]=await Promise.all([p.waitForEvent("download"),p.locator("#export").click()]);
  assert.equal(download.suggestedFilename(),"profitguard-report.csv");
  const body=fs.readFileSync(await download.path(),"utf8");
  assert.ok(body.includes("A-一般")&&body.includes("min_price"));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:"PASS",url:p.url(),rows:3,downloadBytes:Buffer.byteLength(body),pageErrors:errors}));
 }finally{await b.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
