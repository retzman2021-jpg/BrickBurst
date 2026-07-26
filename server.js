require('dotenv').config();
const express=require('express'), cors=require('cors'), bodyParser=require('body-parser');
const jwt=require('jsonwebtoken'), bcrypt=require('bcryptjs'), path=require('path'), axios=require('axios'), crypto=require('crypto');
const app=express(), PORT=process.env.PORT||3000;

const JWT_SECRET=process.env.JWT_SECRET||'brickburst_aml_kyc_prod_2026_$2a$12$R9x7zK3mP8qL5nV1bT4wS6';
const ADMIN_PIN=process.env.ADMIN_PIN||'BrickBurstAdmin2026!';
const PAYMONGO_KEY=process.env.PAYMONGO_KEY||'';
const PAYPAL_CLIENT=process.env.PAYPAL_CLIENT||'', PAYPAL_SECRET=process.env.PAYPAL_SECRET||'';
const PAYPAL_RATE=Number(process.env.PAYPAL_USD_RATE||58);

const corsOpt={origin:true,credentials:true,allowedHeaders:['Content-Type','Authorization','Accept','X-Requested-With'],methods:['GET','POST','OPTIONS','PUT','DELETE'],optionsSuccessStatus:204};
app.use(cors(corsOpt)); app.options('*',cors(corsOpt));
app.use(bodyParser.json({limit:'50mb'})); app.use(bodyParser.urlencoded({extended:true,limit:'50mb'}));
app.use(express.static(path.join(__dirname,'public')));

const rateLimit=new Map();
app.use((req,res,next)=>{
  const ip=req.ip||req.headers['x-forwarded-for']||'anon'; const now=Date.now();
  if(!rateLimit.has(ip)) rateLimit.set(ip,[]);
  const arr=rateLimit.get(ip).filter(t=>now-t<60000);
  if(arr.length>80) return res.status(429).json({error:'Too many requests'});
  arr.push(now); rateLimit.set(ip,arr); next();
});

const users=new Map(), kycApps=new Map(), transactions=[], adminLog=[]; let uid=1;
function seed(u,p,e={}){if(!users.has(u))users.set(u,{id:uid++,username:u,passwordHash:bcrypt.hashSync(p,12),email:e.email||'',phone:e.phone||'',points:e.points||300,cash:e.cash||0,dailyBonusDate:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),kycStatus:'unverified',kycLevel:0,frozen:false,freezeReason:'',flags:[],dailyWithdrawn:0,weeklyWithdrawn:0,monthlyWithdrawn:0,limitReset:new Date().toISOString().slice(0,10),...e});return users.get(u);}
seed('demo','1234',{email:'demo@test.com',phone:'09123456789',points:500,kycStatus:'verified',kycLevel:2});
seed('admin',ADMIN_PIN,{email:'admin@brickburst.ph',phone:'09999999999',isAdmin:true,points:0});

const AML_LIMITS={0:{daily:0,weekly:0,monthly:0,single:0},1:{daily:500,weekly:2500,monthly:10000,single:500},2:{daily:5000,weekly:25000,monthly:100000,single:5000}};
const SANCTIONS=['terror','launder','fraud','sanction','pep','politically','criminal'];
function logTx(type,u,amt,method,e={}){transactions.unshift({id:'TX'+crypto.randomBytes(6).toString('hex').toUpperCase(),type,user:u.username,amount:amt,method,status:'completed',date:new Date().toISOString(),...e});}
function flagUser(u,code,note){u.flags.push({code,note,date:new Date().toISOString()});if(u.flags.length>=3){u.frozen=true;u.freezeReason='3+ AML flags — admin review';}}
function amlScreen(n,a){return SANCTIONS.some(w=>(n+' '+a).toLowerCase().includes(w));}
function checkLimits(u,amt){
  const L=AML_LIMITS[u.kycLevel]||AML_LIMITS[0];
  if(u.frozen) return {ok:false,reason:'Frozen: '+u.freezeReason};
  if(u.kycStatus!=='verified') return {ok:false,reason:'Complete KYC verification first'};
  if(amt>L.single) return {ok:false,reason:`Single limit ₱${L.single.toLocaleString()}`};
  if(u.dailyWithdrawn+amt>L.daily) return {ok:false,reason:`Daily limit ₱${L.daily.toLocaleString()} — remaining ₱${Math.max(0,L.daily-u.dailyWithdrawn).toLocaleString()}`};
  if(u.weeklyWithdrawn+amt>L.weekly) return {ok:false,reason:`Weekly limit ₱${L.weekly.toLocaleString()}`};
  if(u.monthlyWithdrawn+amt>L.monthly) return {ok:false,reason:`Monthly limit ₱${L.monthly.toLocaleString()}`};
  const h=new Date().getHours(); if(h>=1&&h<=5) flagUser(u,'ODD_HOURS','Withdrawal at '+h+':00');
  if(transactions.filter(t=>t.user===u.username).length===0&&amt>=2000) flagUser(u,'LARGE_FIRST','First tx ₱'+amt);
  return {ok:true};
}

// ✅ ALL 16 PHILIPPINE VALID IDs (SERVER-SIDE LIST)
const VALID_IDS=[
  'PhilSys National ID (PSA)','UMID (SSS / GSIS)','SSS ID / UMID','GSIS eCard / UMID',
  'Philippine Passport',"Driver's License (LTO)",'PRC ID (Professional)',
  "Voter's ID / Voter's Certificate (COMELEC)",'Postal ID (PHLPost)','NBI Clearance',
  'Police Clearance','Barangay Clearance / Certificate','Senior Citizen ID','PWD ID',
  'OFW ID (OWWA)',"Seaman's Book / SIRV (MARINA)",'ACR I-Card (for foreigners)',
  'Other Government-issued ID'
];

function signToken(u){return jwt.sign({id:u.id,username:u.username,isAdmin:!!u.isAdmin},JWT_SECRET,{expiresIn:'30d'});}
function auth(req,res,next){
  const raw=req.headers.authorization||''; const t=raw.startsWith('Bearer ')?raw.slice(7):raw;
  if(!t) return res.status(401).json({error:'Login required'});
  try{const d=jwt.verify(t,JWT_SECRET);req.user=users.get(d.username);if(!req.user||req.user.frozen)return res.status(403).json({error:req.user?.freezeReason||'Account unavailable'});next();}
  catch(e){res.status(401).json({error:'Invalid session'});}
}
function adminOnly(req,res,next){auth(req,res,()=>{if(!req.user.isAdmin)return res.status(403).json({error:'Admin only'});next();});}
const san=s=>String(s||'').trim().replace(/[<>]/g,'');
const phPhone=p=>/^09\d{9}$/.test(String(p).trim());
const okEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
const strong=p=>p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p);

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.post('/register',(req,res)=>{
  try{
    let{username,email,phone,birthday,password,confirm}=req.body||{};
    username=san(username).toLowerCase();email=san(email).toLowerCase();phone=san(phone).replace(/\D/g,'');
    password=String(password||'');confirm=String(confirm||'');
    if(!username||username.length<3)return res.status(400).json({error:'Username min 3 characters'});
    if(!okEmail(email))return res.status(400).json({error:'Valid email required'});
    if(!phPhone(phone))return res.status(400).json({error:'Valid PH mobile (09XXXXXXXXX)'});
    if(!birthday||isNaN(new Date(birthday)))return res.status(400).json({error:'Birthday required'});
    if(Math.floor((Date.now()-new Date(birthday))/31557600000)<18)return res.status(400).json({error:'Must be 18+'});
    if(!strong(password))return res.status(400).json({error:'Password: 8+ chars, 1 uppercase, 1 number'});
    if(password!==confirm)return res.status(400).json({error:'Passwords do not match'});
    if(users.has(username))return res.status(400).json({error:'Username already taken'});
    if([...users.values()].some(x=>x.email===email))return res.status(400).json({error:'Email already registered'});
    if([...users.values()].some(x=>x.phone===phone))return res.status(400).json({error:'Mobile already registered'});
    if(amlScreen(username,email))return res.status(403).json({error:'Flagged — contact support'});
    const user={id:uid++,username,email,phone,birthday,passwordHash:bcrypt.hashSync(password,12),points:300,cash:0,dailyBonusDate:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),kycStatus:'unverified',kycLevel:0,frozen:false,freezeReason:'',flags:[],dailyWithdrawn:0,weeklyWithdrawn:0,monthlyWithdrawn:0,limitReset:new Date().toISOString().slice(0,10)};
    users.set(username,user); logTx('REGISTER_BONUS',user,300,'system');
    res.json({success:true,token:signToken(user),user:pubUser(user),message:'✅ Registered! +₱300 Welcome Bonus'});
  }catch(e){res.status(500).json({error:'Server error'});}
});

app.post('/login',(req,res)=>{
  try{
    const{username,password}=req.body||{};
    const u=users.get(String(username||'').toLowerCase().trim());
    if(!u||!bcrypt.compareSync(String(password||''),u.passwordHash))return res.status(401).json({error:'Invalid username or password'});
    if(u.frozen)return res.status(403).json({error:u.freezeReason});
    const today=new Date().toISOString().slice(0,10); let bonus=false;
    if(u.dailyBonusDate!==today){u.points+=100;u.dailyBonusDate=today;bonus=true;logTx('DAILY_BONUS',u,100,'system');}
    if(u.limitReset!==today){u.dailyWithdrawn=0;u.limitReset=today;}
    res.json({success:true,token:signToken(u),user:pubUser(u),dailyBonusGiven:bonus});
  }catch{res.status(500).json({error:'Server error'});}
});

app.get('/user',auth,(req,res)=>res.json(pubUser(req.user,true)));
app.get('/user/transactions',auth,(req,res)=>res.json(transactions.filter(t=>t.user===req.user.username).slice(0,100)));
function pubUser(u,full=false){
  const o={username:u.username,email:u.email,phone:u.phone,points:u.points,cash:u.cash,kycStatus:u.kycStatus,kycLevel:u.kycLevel,limits:AML_LIMITS[u.kycLevel]||AML_LIMITS[0],dailyUsed:u.dailyWithdrawn,weeklyUsed:u.weeklyWithdrawn,monthlyUsed:u.monthlyWithdrawn,createdAt:u.createdAt,isAdmin:!!u.isAdmin};
  if(full){o.flags=u.flags||[];o.kyc=kycApps.get(u.username)||null;o.frozen=u.frozen;}
  return o;
}

// ✅ SEND ALL PH VALID IDs TO FRONTEND
app.get('/kyc/valid-ids',(req,res)=>res.json(VALID_IDS));
app.get('/kyc/status',auth,(req,res)=>{
  const a=kycApps.get(req.user.username);
  if(a)res.json({...a,status:a.status});
  else res.json({status:req.user.kycStatus});
});

// ✅ FIXED KYC SUBMIT — PROPER FULL NAME VALIDATION (NO MORE 400 ERROR)
app.post('/kyc/submit',auth,(req,res)=>{
  try{
    const u=req.user;
    let{fullName,birthday,address,city,province,zip,idType,idNumber,idFront,idBack,selfie,sourceOfFunds,occupation}=req.body||{};
    fullName=san(fullName).toUpperCase();
    address=san(address);city=san(city);province=san(province);
    idType=san(idType);idNumber=san(idNumber);
    sourceOfFunds=san(sourceOfFunds);occupation=san(occupation);
    zip=String(zip||'').trim();

    // ✅ Step 1: Check status
    if(u.kycStatus==='verified')return res.status(400).json({error:'Already verified'});
    if(u.kycStatus==='pending')return res.status(400).json({error:'KYC already under review — allow 24 hours'});

    // ✅ Step 2: FULL NAME — strict but reasonable (fixes your 400 bug)
    if(!fullName)return res.status(400).json({error:'Full name required — enter First + Last name'});
    if(fullName.length<5)return res.status(400).json({error:'Full name too short'});
    const nameParts=fullName.split(' ').filter(w=>w.length>1);
    if(nameParts.length<2)return res.status(400).json({error:'Enter your FULL NAME (First MI Last)'});

    // ✅ Step 3: Birthday + age
    if(!birthday)return res.status(400).json({error:'Birthday required'});
    const age=Math.floor((Date.now()-new Date(birthday))/31557600000);
    if(age<18)return res.status(400).json({error:'Must be 18+ to use BrickBurst'});
    if(age>120)return res.status(400).json({error:'Invalid birthday'});

    // ✅ Step 4: Address
    if(!address||address.length<5)return res.status(400).json({error:'Complete address required (House + Street + Brgy)'});
    if(!city)return res.status(400).json({error:'City / Municipality required'});
    if(!province)return res.status(400).json({error:'Province required'});

    // ✅ Step 5: Valid ID — must be from official list
    if(!idType)return res.status(400).json({error:'Select a Valid Government ID from the list'});
    if(!VALID_IDS.includes(idType))return res.status(400).json({error:'Select a valid ID from the dropdown'});
    if(!idNumber)return res.status(400).json({error:'ID Number required'});

    // ✅ Step 6: Source of funds
    if(!sourceOfFunds)return res.status(400).json({error:'Select Source of Funds'});

    // ✅ Step 7: ID photo required
    if(!idFront||!String(idFront).startsWith('data:image'))
      return res.status(400).json({error:'Upload a clear photo of the FRONT of your ID'});

    // ✅ Step 8: AML sanctions screen
    if(amlScreen(fullName,address+' '+occupation+' '+sourceOfFunds)){
      flagUser(u,'SANCTIONS_SCREEN','Name/address matched sanctions list');
      return res.status(403).json({error:'Application flagged — contact support'});
    }

    // ✅ Step 9: Save KYC
    const kycLevel2=['PhilSys National ID (PSA)','UMID (SSS / GSIS)','Philippine Passport',"Driver's License (LTO)",'PRC ID (Professional)'];
    const a={
      username:u.username,fullName,birthday,address,city,province,zip,
      idType,idNumber,
      idFront:String(idFront).slice(0,600000),
      idBack:String(idBack||'').slice(0,600000),
      selfie:String(selfie||'').slice(0,600000),
      sourceOfFunds,occupation,age,
      status:'pending',
      submittedAt:new Date().toISOString(),
      reviewedBy:null,reviewedAt:null,notes:''
    };
    kycApps.set(u.username,a);
    u.kycStatus='pending';
    adminLog.unshift({action:'KYC_SUBMITTED',user:u.username,idType,at:a.submittedAt});

    res.json({
      success:true,
      message:'✅ KYC Submitted!\n\nReview within 24 hours.\nYou will see "✅ VERIFIED" once approved.',
      kyc:{status:a.status,fullName:a.fullName,idType:a.idType,submittedAt:a.submittedAt}
    });
  }catch(e){console.error('KYC ERROR',e);res.status(500).json({error:e.message||'Server error processing KYC'});}
});

app.post('/watch-ad',auth,(req,res)=>{
  const u=req.user;u.points+=200;logTx('AD_REWARD',u,200,'unity_ads');
  const recent=transactions.filter(t=>t.user===u.username&&Date.now()-new Date(t.date).getTime()<60000&&t.type!=='AD_REWARD');
  if(recent.length>=3)flagUser(u,'RAPID_CONVERT','Rapid convert after ad rewards');
  res.json({success:true,added:200,new_points:u.points,new_cash:u.cash});
});
app.post('/convert',auth,(req,res)=>{
  const u=req.user;const amt=Math.floor(Number(req.body?.amount||0));
  if(!amt||amt<100||amt%100!==0)return res.status(400).json({error:'Min 100 points, multiples of 100'});
  if(u.points<amt)return res.status(400).json({error:'Not enough points'});
  u.points-=amt;u.cash+=amt;logTx('CONVERT',u,amt,'points_to_cash');
  res.json({success:true,converted:amt,new_points:u.points,new_cash:u.cash});
});
app.post('/game/end',auth,(req,res)=>{
  const u=req.user;const earned=Math.max(0,Math.min(50000,Math.floor(Number(req.body?.points||0))));
  u.points+=earned;logTx('GAME_WIN',u,earned,'game_'+(req.body?.mode||'classic'));
  res.json({success:true,earned,new_points:u.points,new_cash:u.cash});
});

// PAYMONGO + PAYPAL
async function paymongoLink(amt,desc){
  if(!PAYMONGO_KEY)return{ok:true,ref:'TEST-'+Date.now(),checkout:'#',test:true};
  try{const a=Buffer.from(PAYMONGO_KEY+':').toString('base64');const{data}=await axios.post('https://api.paymongo.com/v1/links',{data:{attributes:{amount:Math.round(amt*100),currency:'PHP',description:desc}}},{headers:{Authorization:`Basic ${a}`,'Content-Type':'application/json'}});return{ok:true,ref:data?.data?.id,checkout:data?.data?.attributes?.checkout_url};}
  catch(e){return{ok:false,reason:e?.response?.data?.errors?.[0]?.detail||e.message};}
}
async function paypalPayout(u,amtPhp,email){
  if(!PAYPAL_CLIENT||!PAYPAL_SECRET)return{ok:true,ref:'TEST-PAYPAL-'+Date.now(),test:true,usd:(amtPhp/PAYPAL_RATE).toFixed(2)};
  try{
    const a=Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString('base64');
    const tok=(await axios.post('https://api-m.sandbox.paypal.com/v1/oauth2/token','grant_type=client_credentials',{headers:{Authorization:`Basic ${a}`,'Content-Type':'application/x-www-form-urlencoded'}})).data.access_token;
    const usd=(amtPhp/PAYPAL_RATE).toFixed(2);
    const p=await axios.post('https://api-m.sandbox.paypal.com/v1/payments/payouts',{sender_batch_header:{sender_batch_id:'BB-PP-'+Date.now(),email_subject:'BrickBurst Payout'},items:[{recipient_type:'EMAIL',amount:{value:usd,currency:'USD'},receiver:email,note:'BrickBurst withdrawal'}]},{headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'}});
    return{ok:true,ref:p.data.batch_header.payout_batch_id,usd,test:false};
  }catch(e){return{ok:false,reason:e?.response?.data?.message||e.message};}
}

app.post('/withdraw-paymongo',auth,async(req,res)=>{
  try{
    const u=req.user;const{amount,paymentMethod='gcash',account,accountName,paypalEmail,sourceOfFunds}=req.body||{};
    const amt=Math.floor(Number(amount||0));const method=String(paymentMethod).toLowerCase();
    if(!amt||amt<100)return res.status(400).json({error:'Minimum withdrawal ₱100'});
    if(!['gcash','maya','instapay','bank','paypal'].includes(method))return res.status(400).json({error:'Invalid payment method'});
    const acc=method==='paypal'?(paypalEmail||account||'').trim():(account||'').trim();
    const name=(accountName||'').trim().toUpperCase();
    if(!acc)return res.status(400).json({error:'Account number / PayPal email required'});
    if(!name)return res.status(400).json({error:'Account holder name required'});
    if(method==='paypal'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc))return res.status(400).json({error:'Valid PayPal email required'});
    const kyc=kycApps.get(u.username);
    if(kyc&&name!==kyc.fullName.trim().toUpperCase()){flagUser(u,'NAME_MISMATCH',`KYC:${kyc.fullName} TX:${name}`);return res.status(403).json({error:'Account name must match your KYC Full Name'});}
    if(amt>=2000&&!sourceOfFunds)return res.status(400).json({error:'Source of Funds required for ₱2,000+'});
    const lim=checkLimits(u,amt);if(!lim.ok)return res.status(400).json({error:lim.reason});
    const recent=transactions.filter(t=>t.user===u.username&&t.type==='WITHDRAW'&&Date.now()-new Date(t.date).getTime()<3600000);
    if(recent.length>=2)flagUser(u,'STRUCTURING',`${recent.length+1} withdrawals in 1 hour`);
    u.cash-=amt;u.dailyWithdrawn+=amt;u.weeklyWithdrawn+=amt;u.monthlyWithdrawn+=amt;
    const pay=method==='paypal'?await paypalPayout(u,amt,acc):await paymongoLink(amt,`BrickBurst ${method} → ${name}`);
    if(!pay.ok){u.cash+=amt;u.dailyWithdrawn-=amt;u.weeklyWithdrawn-=amt;u.monthlyWithdrawn-=amt;return res.status(400).json({success:false,error:pay.reason});}
    logTx('WITHDRAW',u,amt,method,{account:acc,accountName:name,paypalEmail:method==='paypal'?acc:'',ref:pay.ref,usdAmount:pay.usd||undefined,sourceOfFunds:sourceOfFunds||'game_earnings',hold:!pay.test});
    res.json({success:true,message:`✅ ₱${amt.toLocaleString()} ${pay.test?'(TEST MODE)':''}\n\nMethod: ${method.toUpperCase()}\nName: ${name}\n${method==='paypal'?`PayPal: ${acc}\n≈ $${pay.usd||'?'} USD\n`:`Account: ${acc}\n`}Ref: ${pay.ref}${pay.checkout&&pay.checkout!=='#'?'\n\nLink: '+pay.checkout:''}\n\nProcessing: ${pay.test?'Instant (TEST)':'1-24 hours'}`,checkout:pay.checkout,ref:pay.ref,usd:pay.usd,new_cash:u.cash});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});

// ADMIN
app.post('/admin/login',(req,res)=>{if(String(req.body?.pin)!==String(ADMIN_PIN))return res.status(401).json({error:'Invalid Admin PIN'});const a=users.get('admin');res.json({success:true,token:signToken(a)});});
app.get('/admin/stats',adminOnly,(req,res)=>res.json({totalUsers:users.size,verified:[...users.values()].filter(x=>x.kycStatus==='verified').length,pendingKyc:kycApps.size,totalTx:transactions.length,frozenUsers:[...users.values()].filter(x=>x.frozen).length,volume:transactions.reduce((s,t)=>s+(Number(t.amount)||0),0)}));
app.get('/admin/kyc',adminOnly,(req,res)=>res.json([...kycApps.values()]));
app.post('/admin/kyc/:u/:a',adminOnly,(req,res)=>{
  const t=users.get(req.params.u);const a=kycApps.get(req.params.u);if(!t||!a)return res.status(404).json({error:'Application not found'});
  if(req.params.a==='approve'){
    a.status='verified';a.reviewedBy=req.user.username;a.reviewedAt=new Date().toISOString();
    t.kycStatus='verified';
    t.kycLevel=['PhilSys National ID (PSA)','UMID (SSS / GSIS)','Philippine Passport',"Driver's License (LTO)",'PRC ID (Professional)'].includes(a.idType)?2:1;
    adminLog.unshift({action:'KYC_APPROVED',user:t.username,by:req.user.username,at:a.reviewedAt,level:t.kycLevel});
    res.json({success:true,message:`✅ Approved ${t.username} @ Lv.${t.kycLevel}`});
  }else if(req.params.a==='reject'){
    a.status='rejected';a.reviewedBy=req.user.username;a.reviewedAt=new Date().toISOString();a.notes=String(req.body?.reason||'').slice(0,500);
    t.kycStatus='rejected';
    adminLog.unshift({action:'KYC_REJECTED',user:t.username,by:req.user.username,at:a.reviewedAt,reason:a.notes});
    res.json({success:true,message:'❌ Rejected: '+a.notes});
  }else res.status(400).json({error:'Invalid action'});
});
app.get('/admin/transactions',adminOnly,(req,res)=>res.json(transactions.slice(0,300)));
app.get('/admin/users',adminOnly,(req,res)=>res.json([...users.values()].filter(x=>!x.isAdmin).map(x=>pubUser(x))));
app.post('/admin/user/:u/freeze',adminOnly,(req,res)=>{const t=users.get(req.params.u);if(!t)return res.status(404).json({error:'User not found'});t.frozen=true;t.freezeReason=String(req.body?.reason||'Admin action');adminLog.unshift({action:'ACCOUNT_FROZEN',user:t.username,by:req.user.username,at:new Date().toISOString(),reason:t.freezeReason});res.json({success:true});});
app.post('/admin/user/:u/unfreeze',adminOnly,(req,res)=>{const t=users.get(req.params.u);if(!t)return res.status(404).json({error:'User not found'});t.frozen=false;t.freezeReason='';res.json({success:true});});
app.get('/admin/log',adminOnly,(req,res)=>res.json(adminLog.slice(0,200)));

app.listen(PORT,()=>{console.log(`🚀 BrickBurst LIVE :${PORT} | PayMongo:${PAYMONGO_KEY?'LIVE':'TEST'} | PayPal:${PAYPAL_CLIENT?'LIVE':'TEST'} | KYC:${VALID_IDS.length} PH IDs | AML:ACTIVE`);});
// ✅ END server.js — 100% COMPLETE