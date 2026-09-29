// Local-only server with synthetic NHL data and in-process shared storage.
// Production always uses Vercel functions, NHL data, and the existing Redis connection.
process.env.POOL_LOCAL_TEST='1';
require('./fixture-nhl').install();
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const port=Number(process.env.PORT || 8787);
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,`http://localhost:${port}`);req.query=Object.fromEntries(u.searchParams);
  if(u.pathname.startsWith('/api/')){
   const name=u.pathname.slice(5);if(!/^[a-z-]+$/.test(name)){res.writeHead(404).end();return;}
   const file=path.join(root,'api',name+'.js');if(!fs.existsSync(file)){res.writeHead(404).end();return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>210000){res.writeHead(413).end();return;}}
   req.body=raw?JSON.parse(raw):{};res.status=n=>{res.statusCode=n;return res;};res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));return res;};
   return await require(file)(req,res);
  }
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:e.message}));}
}).listen(port,'0.0.0.0',()=>console.log(`Local fixture preview: http://127.0.0.1:${port}/?room=test-local#draft`));
