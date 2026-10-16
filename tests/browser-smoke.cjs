// Live browser E2E test in the existing authorized Queqiao Windows environment.
// Uses browser driver's existing local dependency, not distributed with the product.
const http = require("node:http"), fs=require("node:fs"), path=require("node:path"), assert=require("node:assert/strict");
const { chromium } = require(path.resolve(__dirname,"../../queqiao-harness-browser/node_modules/playwright-core"));
const root=path.resolve(__dirname,"..");
const mime={".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",".csv":"text/csv;charset=utf-8"};
const server=http.createServer((req,res)=>{
  const requestPath=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const loc=path.resolve(root,"."+requestPath);
  if(!(loc===root||loc.startsWith(root+path.sep))){res.writeHead(403);res.end();return;}
  const file=fs.existsSync(loc)&&fs.statSync(loc).isFile()?loc:path.join(root,"index.html");
  res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const port=server.address().port;
 const candidates=["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"];
 const exe=candidates.find(fs.existsSync);
 assert.ok(exe,"no installed Chrome or Edge");
 const browser=await chromium.launch({executablePath:exe,headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1280,height:860},deviceScaleFactor:1});
 const errs=[];page.on("pageerror",e=>errs.push(e.message));
 try{
  await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"networkidle"});
  assert.match(await page.title(),/ProfitGuard TW/);
  await page.getByRole("button",{name:"載入示範資料"}).click();
  await page.waitForFunction(()=>document.querySelector("#count").textContent==="3");
  assert.equal(await page.locator("#results tr").count(),3);
  assert.equal(await page.locator("#export").isDisabled(),false);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#export").click()]);
  assert.equal(download.suggestedFilename(),"profitguard-report.csv");
  const p=await download.path();
  assert.ok(fs.readFileSync(p,"utf8").includes("min_price"));
  fs.mkdirSync(path.join(root,"evidence"),{recursive:true});
  await page.screenshot({path:path.join(root,"evidence","desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,"evidence","mobile.png"),fullPage:true});
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:"PASS",browser:path.basename(exe),url:"http://127.0.0.1:"+port,rows:3,download:download.suggestedFilename(),jsErrors:errs,desktop:"evidence/desktop.png",mobile:"evidence/mobile.png"}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(()=>server.close());
