try{window.addEventListener('error',e=>{try{e.preventDefault()}catch{}return true});}catch{}
try{window.addEventListener('unhandledrejection',e=>{try{e.preventDefault()}catch{}return true});}catch{}

const RENDER_URL="https://brickburst.onrender.com";
let isAndroidAPK=false;try{isAndroidAPK=!!(window.Capacitor&&window.Capacitor.getPlatform()==='android');}catch{}
const API_BASE=isAndroidAPK?RENDER_URL:window.location.origin;
const ADS={GAME_ID:"800106534",REWARDED:"Rewarded_Android",BANNER:"Banner_Android",TEST_MODE:true};

let authToken=localStorage.getItem("bb_token")||"";
let currentUser=null,isAdmin=false,_loginLock=false;
function setToken(t){authToken=t;localStorage.setItem("bb_token",t);}
function clearAuth(){authToken="";currentUser=null;isAdmin=false;localStorage.removeItem("bb_token");showAuth();}
window.authToken=()=>authToken;

async function api(path,method="GET",body=null){
  const o={method,headers:{"Content-Type":"application/json"}};
  if(authToken)o.headers.Authorization=`Bearer ${authToken}`;
  if(body)o.body=JSON.stringify(body);
  try{
    const r=await fetch(API_BASE+path,o);
    const txt=await r.text();let d={};try{d=JSON.parse(txt);}catch{d={raw:txt};}
    if(!r.ok&&r.status!==401)alert(`❌ ${path}\nStatus ${r.status}\n${txt.slice(0,220)}`);
    if(r.status===401)clearAuth();
    return{ok:r.ok,status:r.status,...d};
  }catch(e){alert(`❌ Network: ${e.message}`);return{ok:false,error:e.message};}
}
window.api=api;

function show(id){document.querySelectorAll(".screen").forEach(s=>s.classList.add("hidden"));document.getElementById(id).classList.remove("hidden");window.scrollTo(0,0);}
function showAuth(){const m=document.getElementById("authModal");m.classList.remove("hidden");m.style.display="flex";show("menuScreen");}
function hideAuth(){const m=document.getElementById("authModal");m.classList.add("hidden");m.style.display="none";}
const $=id=>document.getElementById(id);

// ✅ NEW: Clean tab switch for original design
function switchTab(name){
  document.querySelectorAll(".tab-pane").forEach(p=>p.classList.add("hidden"));
  document.getElementById("tab-"+name).classList.remove("hidden");
}
window.switchTab=switchTab;

// Globals safety
window.startClassic=startClassic;window.startAdventure=startAdventure;window.moreGames=moreGames;
window.restartGame=restartGame;window.backToMenu=backToMenu;window.doLogin=doLogin;window.doRegister=doRegister;
window.logout=logout;window.watchAd=watchAd;window.openKYC=openKYC;window.closeKyc=closeKyc;
window.submitKyc=submitKyc;window.openProfile=openProfile;window.closeProfile=closeProfile;
window.openConvert=openConvert;window.closeConvert=closeConvert;window.doConvert=doConvert;
window.openWithdraw=openWithdraw;window.closeWithdraw=closeWithdraw;window.doWithdraw=doWithdraw;
window.openSettings=openSettings;window.closeSettings=closeSettings;window.saveSettings=saveSettings;
window.openAdminLogin=openAdminLogin;window.closeAdminLogin=closeAdminLogin;window.adminLogin=adminLogin;
window.adminLogout=adminLogout;window.adminKyc=adminKyc;window.adminFreeze=adminFreeze;

// ==================================================
// GAME BUTTONS
// ==================================================
function startClassic(){
  if(!authToken){alert("🔐 Login first!");return;}
  try{show("gameScreen");setTimeout(()=>{
    if(!window.BrickBurstGame){alert("❌ Game engine — refresh (F5)");return;}
    if(!$("gameCanvas")){alert("❌ Canvas missing");return;}
    window.BrickBurstGame.startGame("classic");refreshHud();
  },30);}catch(e){alert("❌ Classic:\n"+e.message);}
}
function startAdventure(){
  if(!authToken){alert("🔐 Login first!");return;}
  try{show("gameScreen");setTimeout(()=>{
    if(!window.BrickBurstGame){alert("❌ Game engine — refresh (F5)");return;}
    if(!$("gameCanvas")){alert("❌ Canvas missing");return;}
    window.BrickBurstGame.startGame("adventure");refreshHud();
  },30);}catch(e){alert("❌ Adventure:\n"+e.message);}
}
function moreGames(){alert("🎮 More games coming soon!");}
function restartGame(){try{if(window.BrickBurstGame)window.BrickBurstGame.restartGame();}catch(e){alert(e.message);}}
async function backToMenu(){try{if(window.BrickBurstGame)window.BrickBurstGame.backToMenu();}catch{}await refreshHud();showMenuBanner();show("menuScreen");}

// ==================================================
// DOM READY
// ==================================================
document.addEventListener("DOMContentLoaded",()=>{
  $("regPass")?.addEventListener("input",e=>{
    const p=e.target.value,s=$("passStrength");let sc=0;
    if(p.length>=8)sc++;if(/[A-Z]/.test(p))sc++;if(/[0-9]/.test(p))sc++;if(/[^A-Za-z0-9]/.test(p))sc++;
    s.className="strength "+(sc?"w"+sc:"");
  });
  ["kFront","kBack","kSelfie"].forEach(id=>$(id)?.addEventListener("change",e=>{
    const f=e.target.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>window[id+"_b64"]=r.result;r.readAsDataURL(f);
  }));
  const m=$("wdMethod"),p=$("paypalField"),a=$("wdAccount");
  if(m&&p&&a)m.addEventListener("change",()=>{
    const pp=m.value==="paypal";p.classList.toggle("hidden",!pp);
    a.placeholder=pp?"(see PayPal field)":"09XXXXXXXXX / account no.";
  });
  // ✅ Login on Enter key
  ["loginUser","loginPass"].forEach(id=>$(id)?.addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();}));
  ["regUser","regEmail","regPhone","regBday","regPass","regConfirm"].forEach(id=>$(id)?.addEventListener("keydown",e=>{if(e.key==="Enter")doRegister();}));
  boot();
});

// ==================================================
// HUD
// ==================================================
async function refreshHud(){
  if(!authToken)return;
  const r=await api("/user");if(!r.ok)return;
  currentUser=r;
  const pts=Number(r.points||0).toLocaleString(),cash=Number(r.cash||0).toFixed(2);
  ["hudPoints","gamePoints","topPoints"].forEach(id=>{try{if($(id))$(id).textContent=pts;}catch{}});
  ["hudCash","gameCash","topCash"].forEach(id=>{try{if($(id))$(id).textContent="₱"+cash;}catch{}});
  window.currentCash=cash;window.currentPoints=r.points||0;return r;
}
window.refreshHud=refreshHud;window.refreshUserData=refreshHud;

// ==================================================
// ✅ LOGIN — INSTANT, NO DELAY, BONUS SHOWN
// ==================================================
async function doLogin(){
  if(_loginLock)return;_loginLock=true;
  const btn=document.querySelector("#tab-login .btn-blue")||document.querySelector(".btn-login");
  const origText=btn?.innerText||"Login";
  if(btn){btn.disabled=true;btn.style.opacity="0.6";btn.innerText="⏳ Logging in…";}

  try{
    const u=$("loginUser").value.trim().toLowerCase();
    const pw=$("loginPass").value;
    if(!u||!pw){alert("⚠️ Enter username + password");return;}

    const r=await api("/login","POST",{username:u,password:pw});
    if(!r.ok||!r.token){return;}

    setToken(r.token);
    isAdmin=!!r.user?.isAdmin;
    currentUser=r.user;
    hideAuth();

    if(isAdmin){loadAdmin();return;}

    const fresh=await refreshHud();
    if(r.dailyBonusGiven||r.bonusAdded){
      const bonus=r.bonusAdded||100;
      const newPts=Number(fresh?.points||currentUser?.points||0).toLocaleString();
      alert(`✅ Login OK!\n\n🎁 +${bonus} DAILY BONUS ADDED!\n\nNew Points: ${newPts}`);
    }else{
      alert("✅ Login OK!");
    }
    showMenuBanner();
  }finally{
    _loginLock=false;
    if(btn){btn.disabled=false;btn.style.opacity="1";btn.innerText=origText;}
  }
}

// ==================================================
// ✅ REGISTER — +300 WELCOME BONUS AUTO-ADDED
// ==================================================
async function doRegister(){
  const b={
    username:$("regUser").value.trim().toLowerCase(),
    email:$("regEmail").value.trim().toLowerCase(),
    phone:$("regPhone").value.trim(),
    birthday:$("regBday").value,
    password:$("regPass").value,
    confirm:$("regConfirm").value
  };
  if(!b.username||b.username.length<3)return alert("⚠️ Username min 3 letters");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))return alert("⚠️ Valid email required");
  if(!/^09\d{9}$/.test(b.phone))return alert("⚠️ Valid PH mobile (09XXXXXXXXX)");
  if(!b.birthday)return alert("⚠️ Enter birthday");
  if(Math.floor((Date.now()-new Date(b.birthday))/31557600000)<18)return alert("⚠️ Must be 18+");
  if(b.password.length<8)return alert("⚠️ Password min 8 chars");
  if(b.password!==b.confirm)return alert("⚠️ Passwords do not match");
  if(!$("regTerms").checked)return alert("⚠️ Accept terms + AML consent");

  const r=await api("/register","POST",b);
  if(!r.ok)return;

  setToken(r.token);
  currentUser=r.user;
  hideAuth();

  const fresh=await refreshHud();
  const bonus=r.welcomeBonus||r.bonusAdded||300;
  const newPts=Number(fresh?.points||currentUser?.points||0).toLocaleString();
  alert(
    "✅ Registered Successfully!\n\n"+
    "🎁 +"+bonus+" WELCOME BONUS ADDED TO POINTS!\n\n"+
    "Your Points: "+newPts+"\n\n"+
    "👉 Next: Submit KYC to unlock withdrawals."
  );
  showMenuBanner();
}

function logout(){if(confirm("Logout?"))clearAuth();}

function showMenuBanner(){
  const b=$("kycBanner");if(!b||!currentUser)return;const s=currentUser.kycStatus;b.classList.remove("hidden");
  if(s==="unverified")b.innerHTML="⚠️ <b>Unverified</b> — <a href='#' onclick='openKYC();return false' style='color:#fff;text-decoration:underline'>Submit KYC</a> to withdraw.";
  else if(s==="pending")b.innerHTML="⏳ KYC under review — 24h approval.";
  else if(s==="verified")b.innerHTML="✅ KYC Verified — full limits unlocked.";
  else if(s==="rejected")b.innerHTML="❌ KYC rejected — <a href='#' onclick='openKYC();return false' style='color:#fff;text-decoration:underline'>resubmit</a>.";
  else b.classList.add("hidden");
}

// ==================================================
// ADS
// ==================================================
window.AD={showRewarded:()=>new Promise(res=>{
  try{if(!isAndroidAPK||typeof UnityAds==="undefined")return setTimeout(()=>res({earned:true}),900);
    UnityAds.show(ADS.REWARDED,{onComplete:r=>res({earned:r&&r.state===(UnityAds.FINISH_STATE?.COMPLETED??4)})});}catch{res({earned:true});}
})};
function initAds(){try{if(isAndroidAPK&&typeof UnityAds==="undefined"){const s=document.createElement("script");s.src="https://cdn.unityads.unity3d.com/ads/unity-ads.min.js";s.async=1;s.onload=()=>{try{UnityAds.initialize(ADS.GAME_ID,ADS.TEST_MODE);}catch{}};document.head.appendChild(s);}}catch{}}
async function watchAd(){
  if(!authToken)return alert("Login first");
  try{let earned=true;try{const r=await AD.showRewarded();earned=!!(r?.earned??true);}catch{earned=true;}
    if(!earned)return alert("Watch full ad for +200 points");
    const res=await api("/watch-ad","POST");if(res.success){await refreshHud();alert(`✅ +${res.added} POINTS!\nNew: ${Number(res.new_points).toLocaleString()}`);}
  }catch(e){alert("❌ Ad: "+e.message);}
}

// ==================================================
// CONVERT
// ==================================================
function openConvert(){if(!authToken)return alert("Login first");$("convertModal").classList.remove("hidden");}
function closeConvert(){$("convertModal").classList.add("hidden");}
async function doConvert(){
  const a=Math.floor(Number($("cvAmount").value||0));
  if(!a||a<100||a%100!==0)return alert("Min 100, multiples of 100");
  const r=await api("/convert","POST",{amount:a});if(!r.ok||!r.success)return;
  await refreshHud();alert(`✅ Converted ₱${a.toLocaleString()}!`);closeConvert();
}

// ==================================================
// WITHDRAW
// ==================================================
function openWithdraw(){
  if(!authToken)return alert("Login first");$("withdrawModal").classList.remove("hidden");
  api("/user").then(r=>{if(!r.ok)return;const L=r.limits||{};
    $("wdLimits").innerHTML=`🛡️ <b>Limits (KYC Lv.${r.kycLevel||0})</b><br>Single: ₱${(L.single||0).toLocaleString()} · Daily: ₱${(L.daily||0).toLocaleString()} (used ₱${(r.dailyUsed||0).toLocaleString()})<br>Weekly: ₱${(L.weekly||0).toLocaleString()} · Monthly: ₱${(L.monthly||0).toLocaleString()}<br>KYC: <b>${r.kycStatus||"unverified"}</b> ${r.kycStatus!=="verified"?'— <a href="#" onclick="closeWithdraw();openKYC();return false;" style="color:#1d4ed8">submit KYC</a>':''}`;
    if(r.kyc)$("wdName").value=r.kyc.fullName||"";
  });
}
function closeWithdraw(){$("withdrawModal").classList.add("hidden");}
async function doWithdraw(){
  const method=$("wdMethod").value,pp=method==="paypal";
  const body={
    amount:Math.floor(Number($("wdAmount").value||0)),paymentMethod:method,
    account:pp?($("wdPaypalEmail").value.trim()||$("wdAccount").value.trim()):$("wdAccount").value.trim(),
    accountName:$("wdName").value.trim().toUpperCase(),
    paypalEmail:pp?($("wdPaypalEmail").value.trim()||$("wdAccount").value.trim()):"",
    sourceOfFunds:$("wdSource").value
  };
  if(!body.amount||body.amount<100)return alert("Min ₱100");
  if(!body.account)return alert("Enter account / PayPal email");
  if(!body.accountName)return alert("Enter account name (must match KYC)");
  if(pp&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.paypalEmail))return alert("Valid PayPal email required");
  const r=await api("/withdraw-paymongo","POST",body);if(!r.ok||!r.success)return;
  await refreshHud();alert(r.message);closeWithdraw();
}

// ==================================================
// ✅ KYC — AUTO-SCROLL TO ALL MISSING FIELDS
// ==================================================
function openKYC(){
  if(!authToken)return alert("Login first");
  $("kycModal").classList.remove("hidden");
  api("/kyc/status").then(r=>{
    const st=$("kycStatus"),f=$("kycForm");
    st.className="kyc-status "+(r.status||"unverified");
    if(r.status==="verified"){st.textContent="✅ KYC VERIFIED — Full limits";f.classList.add("hidden");}
    else if(r.status==="pending"){st.textContent="⏳ UNDER REVIEW — 24h approval";f.classList.add("hidden");}
    else if(r.status==="rejected"){st.textContent="❌ REJECTED: "+(r.notes||"Resubmit correct details");f.classList.remove("hidden");}
    else{st.textContent="⚠️ UNVERIFIED — Complete to enable withdrawals";f.classList.remove("hidden");}
    if(r.fullName){$("kFull").value=r.fullName;$("kBday").value=r.birthday;$("kPhone").value=r.phone||"";$("kAddr").value=r.address;$("kCity").value=r.city;$("kProv").value=r.province;$("kZip").value=r.zip;$("kOcc").value=r.occupation;$("kIdType").value=r.idType;$("kIdNum").value=r.idNumber;$("kSource").value=r.sourceOfFunds;}
  }).catch(()=>{});
}
function closeKyc(){$("kycModal").classList.add("hidden");}

async function submitKyc(){
  const name=$("kFull").value.trim().toUpperCase();
  if(!name){
    alert("❌ KYC NOT READY!\n\n👉 FULL NAME is the VERY FIRST FIELD at the TOP of this window.\nIt has a THICK RED BORDER labeled ⚠️ 1. FULL NAME.\n\nScroll UP to fill it in first.");
    $("kFull").focus();
    $("kycModal").scrollTop=0;
    $("kFull").scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  if(name.split(" ").filter(w=>w.length>1).length<2)return alert("❌ Enter FULL NAME: First + Last (e.g. JUAN DELA CRUZ)");
  const bday=$("kBday").value;if(!bday)return alert("❌ 2. Enter Date of Birth");
  if(Math.floor((Date.now()-new Date(bday))/31557600000)<18)return alert("❌ Must be 18+");
  const phone=$("kPhone").value.trim();if(!/^09\d{9}$/.test(phone))return alert("❌ 3. Enter valid PH mobile (09XXXXXXXXX)");
  const addr=$("kAddr").value.trim();if(!addr||addr.length<5)return alert("❌ 4. Enter Complete Address");
  const city=$("kCity").value.trim();if(!city)return alert("❌ 5. Enter City");
  const prov=$("kProv").value.trim();if(!prov)return alert("❌ 6. Enter Province");
  const idType=$("kIdType").value;if(!idType)return alert("❌ 9. Select Valid Government ID");
  const idNum=$("kIdNum").value.trim();if(!idNum)return alert("❌ 10. Enter ID Number");
  const src=$("kSource").value;if(!src)return alert("❌ 11. Select Source of Funds");
  if(!window.kFront_b64)return alert("📸 12. Upload FRONT photo of your ID");
  if(!$("kConsent").checked)return alert("✅ Tick consent checkbox at the bottom");

  const b={fullName:name,birthday:bday,phone,address:addr,city,province,
    zip:$("kZip").value.trim(),occupation:$("kOcc").value.trim(),
    idType,idNumber:idNum,sourceOfFunds:src,
    idFront:window.kFront_b64||"",idBack:window.kBack_b64||"",selfie:window.kSelfie_b64||""};
  const r=await api("/kyc/submit","POST",b);if(!r.ok)return;
  alert(r.message||"✅ KYC Submitted!\nReview within 24 hours.");
  closeKyc();showMenuBanner();
}

// ==================================================
// PROFILE
// ==================================================
function openProfile(){if(!authToken)return alert("Login first");$("profileModal").classList.remove("hidden");
  api("/user").then(r=>{if(!r.ok)return;$("profileBody").innerHTML=`<p><b>Username</b> ${r.username}</p><p><b>Email</b> ${r.email}</p><p><b>Mobile</b> ${r.phone}</p><p><b>Points</b> ${Number(r.points||0).toLocaleString()}</p><p><b>Cash</b> ₱${Number(r.cash||0).toFixed(2)}</p><p><b>KYC</b> ${r.kycStatus} Lv.${r.kycLevel}</p><p><b>Joined</b> ${new Date(r.createdAt).toLocaleDateString()}</p>${r.frozen?'<p style="color:#dc2626"><b>⚠️ FROZEN:</b> '+r.freezeReason+'</p>':''}${(r.flags||[]).length?'<p style="color:#b45309"><b>Flags:</b> '+r.flags.map(f=>f.code).join(', ')+'</p>':''}`;});
  api("/user/transactions").then(r=>{const el=$("txList");if(!r.length){el.innerHTML='<p class="hint">No transactions yet</p>';return;}el.innerHTML=r.map(t=>`<div class="tx-row"><div><div class="tx-type">${t.type}</div><div class="tx-date">${new Date(t.date).toLocaleString()} · ${t.method||''} ${t.ref?'· '+t.ref:''}</div></div><div class="tx-amt">₱${Number(t.amount||0).toLocaleString()}</div></div>`).join("");});
}
function closeProfile(){$("profileModal").classList.add("hidden");}

// ==================================================
// SETTINGS
// ==================================================
function openSettings(){$("settingsModal").classList.remove("hidden");
  try{$("sfxOn").checked=localStorage.getItem("bb_sfx")!=="0";$("bgmOn").checked=localStorage.getItem("bb_bgm")!=="0";$("sfxVol").value=localStorage.getItem("bb_sfxv")||100;$("bgmVol").value=localStorage.getItem("bb_bgmv")||100;}catch{}
}
function closeSettings(){$("settingsModal").classList.add("hidden");}
function saveSettings(){const d={sfxOn:$("sfxOn").checked,bgmOn:$("bgmOn").checked,sfxVol:$("sfxVol").value,bgmVol:$("bgmVol").value};
  localStorage.setItem("bb_sfx",d.sfxOn?"1":"0");localStorage.setItem("bb_bgm",d.bgmOn?"1":"0");localStorage.setItem("bb_sfxv",d.sfxVol);localStorage.setItem("bb_bgmv",d.bgmVol);
  try{window.BrickBurstGame&&BrickBurstGame.applySettings(d);}catch{}
}

// ==================================================
// ADMIN
// ==================================================
function openAdminLogin(){$("adminModal").classList.remove("hidden");}
function closeAdminLogin(){$("adminModal").classList.add("hidden");}
async function adminLogin(){const r=await api("/admin/login","POST",{pin:$("adminPin").value});if(!r.ok)return;setToken(r.token);isAdmin=true;hideAuth();closeAdminLogin();loadAdmin();}
function adminLogout(){clearAuth();}
async function loadAdmin(){
  show("adminScreen");
  const s=await api("/admin/stats");$("aUsers").textContent=s.totalUsers||0;$("aVer").textContent=s.verified||0;$("aKyc").textContent=s.pendingKyc||0;$("aVol").textContent="₱"+Number(s.volume||0).toLocaleString();
  const k=await api("/admin/kyc");$("aKycList").innerHTML=(k||[]).length?k.map(a=>`<div class="admin-row"><div><b>${a.fullName}</b> (${a.username}) · ${a.idType} #${a.idNumber}<br><small>${a.address}, ${a.city}, ${a.province} · Age ${a.age} · ${a.occupation} · Source: ${a.sourceOfFunds} · ${new Date(a.submittedAt).toLocaleString()}</small></div><div class="admin-actions"><button class="ok" onclick="adminKyc('${a.username}','approve')">Approve</button><button class="no" onclick="adminKyc('${a.username}','reject')">Reject</button></div></div>`).join(""):'<p class="hint">No pending KYC</p>';
  const t=await api("/admin/transactions");$("aTxList").innerHTML=(t||[]).slice(0,50).map(x=>`<div class="admin-row"><div><b>${x.user}</b> · ${x.type} · ${x.method||''} ${x.accountName?'→ '+x.accountName:''}<br><small>${x.id} · ${new Date(x.date).toLocaleString()} · ${x.status}</small></div><div class="tx-amt">₱${Number(x.amount||0).toLocaleString()}</div></div>`).join("");
  const u=await api("/admin/users");$("aUserList").innerHTML=(u||[]).map(x=>`<div class="admin-row"><div><b>${x.username}</b> · ${x.email} · ${x.phone}<br><small>KYC:${x.kycStatus} Lv.${x.kycLevel} · ₱${Number(x.cash||0).toFixed(2)} · Joined ${new Date(x.createdAt).toLocaleDateString()}</small></div><div class="admin-actions">${x.frozen?`<button class="ok" onclick="adminFreeze('${x.username}',0)">Unfreeze</button>`:`<button class="freeze" onclick="adminFreeze('${x.username}',1)">Freeze</button>`}</div></div>`).join("");
}
async function adminKyc(u,a){
  let rsn="";if(a==='reject'){rsn=prompt("Rejection reason:","Incomplete / invalid docs");if(!rsn)return;}
  const r=await api(`/admin/kyc/${u}/${a}`,"POST",{reason:rsn});if(r.ok){alert(r.message);loadAdmin();}
}
async function adminFreeze(u,f){
  let rsn="";if(f===1){rsn=prompt("Freeze reason:","AML flag — suspicious activity");if(!rsn)return;}
  const r=await api(`/admin/user/${u}/${f?'freeze':'unfreeze'}`,"POST",{reason:rsn});if(r.ok)loadAdmin();
}

// ==================================================
// SAFETY NET
// ==================================================
(function ensureGlobals(){
  const required=["startClassic","startAdventure","moreGames","restartGame","backToMenu",
    "doLogin","doRegister","logout","watchAd","openKYC","closeKyc","submitKyc",
    "openProfile","closeProfile","openConvert","closeConvert","doConvert",
    "openWithdraw","closeWithdraw","doWithdraw","openSettings","closeSettings","saveSettings",
    "openAdminLogin","closeAdminLogin","adminLogin","adminLogout","adminKyc","adminFreeze","switchTab"];
  required.forEach(fn=>{if(typeof window[fn]!=="function")window[fn]=()=>alert(`⏳ ${fn} — refresh (F5)`);});
  console.log("✅ BrickBurst app.js v6 ready (clean design + instant login + bonuses)");
})();

// ==================================================
// BOOT
// ==================================================
function boot(){
  initAds();
  if(authToken){
    api("/user").then(r=>{
      if(!r.ok){clearAuth();return;}
      currentUser=r;isAdmin=!!r.isAdmin;hideAuth();
      if(isAdmin)loadAdmin();
      else{refreshHud();showMenuBanner();}
    }).catch(clearAuth);
  }else showAuth();
}