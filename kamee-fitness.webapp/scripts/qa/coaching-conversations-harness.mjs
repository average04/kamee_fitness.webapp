// Build actual components with synthetic ports. No env files, Auth, hosted API or product test route.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, realpath, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from 'vite';
import tailwind from '@tailwindcss/postcss';
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), args = process.argv.slice(2);
const appIndex = args.indexOf('--app-root');
assert.ok(appIndex >= 0 && args[appIndex + 1], 'Pass --app-root <app-worktree> and --build or --serve');
assert.ok(args.includes('--build') !== args.includes('--serve'), 'Choose --build or --serve');
const appRoot = await realpath(resolve(args[appIndex + 1])), harness = resolve(webRoot, 'scripts/qa/conversations');
const output = resolve(webRoot, '.superpowers/qa/coach-stage-c1c-browser', 'run-' + randomUUID()); await mkdir(output, { recursive:true });
const alias = {
  '@':webRoot, 'next/link':resolve(harness, 'link.tsx'),
  '@qa-onest':resolve(appRoot, 'node_modules/@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf'),
  '@qa-hanken':resolve(appRoot, 'node_modules/@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf'),
};
await build({ configFile:false, envDir:false, root:harness, publicDir:false, resolve:{alias},
  css:{postcss:{plugins:[tailwind()]}}, build:{outDir:output, emptyOutDir:false, rolldownOptions:{input:resolve(harness,'index.html')}} });
console.log(JSON.stringify({purpose:'C1c synthetic actual-component QA',output,hostedRequests:false}));
if (args.includes('--serve')) {
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.woff2':'font/woff2'};
  const server=createServer(async(req,res)=>{
    try {
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://127.0.0.1'), path=resolve(output,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      assert.ok(relative(output,path).split(sep)[0]!=='..');const actual=await realpath(path);assert.ok(relative(output,actual).split(sep)[0]!=='..');
      const bytes=await readFile(actual);res.writeHead(200,{'Content-Type':mime[extname(actual)]??'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; script-src 'self'"});res.end(req.method==='HEAD'?undefined:bytes);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}/`,output})));
  process.stdin.setEncoding('utf8');process.stdin.on('data',value=>{if(value.includes('stop')||value.includes('\u0003'))server.close(()=>process.exit(0));});
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}
