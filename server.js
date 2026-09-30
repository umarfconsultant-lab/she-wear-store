// She Wear store server. No dependencies; needs Node 18+.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,PASS=process.env.ADMIN_PASSWORD||'',DIR=path.resolve(process.env.DATA_DIR||path.join(__dirname,'data')),DB=path.join(DIR,'db.json'),UP=path.join(DIR,'uploads'),PUB=path.join(__dirname,'public');
fs.mkdirSync(UP,{recursive:true});
if(!fs.existsSync(DB))fs.copyFileSync(path.join(__dirname,'seed.json'),DB);
const db=JSON.parse(fs.readFileSync(DB,'utf8'));
const save=()=>{fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB)};
const sessions=new Set(),fails={};
const CATS=['Heels','Flats','Sandals','Sneakers','Boots','Formal Shoes'],SIZES=[36,37,38,39,40,41],STATUS=['new','confirmed','shipped','delivered','cancelled'];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
const readBody=req=>new Promise((ok,no)=>{let b='',n=0;req.on('data',c=>{n+=c.length;if(n>8e6){req.destroy();return no(new Error('Too large'))}b+=c});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(new Error('Bad JSON'))}})});
const authed=req=>{const m=/sw_admin=([a-f0-9]+)/.exec(req.headers.cookie||'');return !!(m&&sessions.has(m[1]))};
const str=(v,n=200)=>String(v==null?'':v).trim().slice(0,n),num=v=>Number.isFinite(+v)?+v:NaN;
const sha=s=>crypto.createHash('sha256').update(s).digest();
function order(b){
  const c=b.customer||{},name=str(c.name,80),phone=str(c.phone,20),city=str(c.city,60),addr=str(c.addr,300);
  if(!name||!city||!addr)return[400,'Please fill in name, city and address.'];
  if(!/^(0|\+92)3\d{9}$/.test(phone))return[400,'Enter a valid mobile number like 03001234567.'];
  const items=Array.isArray(b.items)?b.items.slice(0,30):[];if(!items.length)return[400,'Your cart is empty.'];
  const need={},lines=[];
  for(const it of items){const p=db.products.find(x=>x.id==it.id),qty=Math.floor(num(it.qty)),size=+it.size;
    if(!p||!(qty>=1&&qty<=9)||!SIZES.includes(size))return[400,'Invalid item in cart.'];
    need[p.id]=(need[p.id]||0)+qty;lines.push({id:p.id,name:p.name,size,qty,price:p.price})}
  for(const id in need){const p=db.products.find(x=>x.id==id);if(p.stock<need[id])return[409,p.name+' has only '+p.stock+' left in stock.']}
  for(const id in need)db.products.find(x=>x.id==id).stock-=need[id];
  const sub=lines.reduce((a,l)=>a+l.price*l.qty,0),ship=sub>=15000?0:250,no='SW-'+(1000+db.nextOrder++);
  db.orders.unshift({no,at:new Date().toISOString(),items:lines,sub,ship,total:sub+ship,customer:{name,phone,city,addr,note:str(c.note,300)},status:'new'});save();return[200,{no,total:sub+ship}];
}
function saveProduct(b){
  const name=str(b.name,80),price=num(b.price),old=num(b.old||0),stock=Math.floor(num(b.stock));
  if(!name||!(price>0)||!(old>=0)||!(stock>=0)||!CATS.includes(b.cat))return[400,'Check name, category, price and stock.'];
  const rec={name,cat:b.cat,price:Math.round(price),old:Math.round(old),stock,colors:[str(b.color||'Noir',20)],img:str(b.img,300),isNew:b.isNew?1:0};
  const ex=db.products.find(p=>p.id==b.id);
  if(ex)Object.assign(ex,rec);else db.products.push({id:db.nextId++,rating:4.7,rev:0,sell:5,...rec});
  save();return[200,{ok:1}];
}
http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://x'),p=u.pathname;
    if(p.startsWith('/api/')){
      if(req.method==='GET'&&p==='/api/products')return send(res,200,db.products);
      if(req.method==='POST'&&p==='/api/orders'){const[c,r]=order(await readBody(req));return send(res,c,typeof r==='string'?{error:r}:r)}
      if(req.method==='POST'&&p==='/api/admin/login'){
        const ip=req.socket.remoteAddress,f=fails[ip]||(fails[ip]={n:0,t:Date.now()});if(Date.now()-f.t>9e5){f.n=0;f.t=Date.now()}
        if(!PASS)return send(res,503,{error:'Set ADMIN_PASSWORD on the server first.'});if(f.n>=8)return send(res,429,{error:'Too many attempts. Try later.'});
        const b=await readBody(req);if(!crypto.timingSafeEqual(sha(str(b.password,200)),sha(PASS))){f.n++;return send(res,401,{error:'Wrong password'})}
        const t=crypto.randomBytes(24).toString('hex');sessions.add(t);res.setHeader('Set-Cookie','sw_admin='+t+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+(req.headers['x-forwarded-proto']==='https'?'; Secure':''));return send(res,200,{ok:1})}
      if(!authed(req))return send(res,401,{error:'Login required'});
      if(req.method==='GET'&&p==='/api/admin/orders')return send(res,200,db.orders);
      if(req.method==='POST'&&p==='/api/admin/products'){const[c,r]=saveProduct(await readBody(req));return send(res,c,typeof r==='string'?{error:r}:r)}
      let m;
      if(req.method==='DELETE'&&(m=/^\/api\/admin\/products\/(\d+)$/.exec(p))){db.products=db.products.filter(x=>x.id!=m[1]);save();return send(res,200,{ok:1})}
      if(req.method==='PATCH'&&(m=/^\/api\/admin\/orders\/(SW-\d+)$/.exec(p))){const b=await readBody(req),o=db.orders.find(x=>x.no===m[1]);
        if(!o||!STATUS.includes(b.status))return send(res,400,{error:'Invalid'});
        if(b.status==='cancelled'&&o.status!=='cancelled')o.items.forEach(l=>{const q=db.products.find(x=>x.id==l.id);if(q)q.stock+=l.qty});
        if(o.status==='cancelled'&&b.status!=='cancelled')o.items.forEach(l=>{const q=db.products.find(x=>x.id==l.id);if(q)q.stock=Math.max(0,q.stock-l.qty)});
        o.status=b.status;save();return send(res,200,{ok:1})}
      if(req.method==='POST'&&p==='/api/admin/upload'){const b=await readBody(req),m2=/^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(str(b.data,8e6));
        if(!m2)return send(res,400,{error:'Use a PNG, JPG or WebP image.'});const f=crypto.randomBytes(8).toString('hex')+'.'+(m2[1]==='jpeg'?'jpg':m2[1]);
        fs.writeFileSync(path.join(UP,f),Buffer.from(m2[2],'base64'));return send(res,200,{url:'/uploads/'+f})}
      return send(res,404,{error:'Not found'});
    }
    let file=p==='/'?'index.html':p==='/admin'?'admin.html':p.slice(1),base=PUB;
    if(file.startsWith('uploads/')){base=UP;file=file.slice(8)}
    const full=path.join(base,file);
    if(!full.startsWith(base+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':base===UP?'public, max-age=604800':'no-cache'});fs.createReadStream(full).pipe(res);
  }catch(e){send(res,400,{error:e.message||'Bad request'})}
}).listen(PORT,()=>console.log('She Wear running on http://localhost:'+PORT+(PASS?'':'  (set ADMIN_PASSWORD to enable /admin)')));
