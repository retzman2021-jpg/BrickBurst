// === SAFE SCREEN & MODAL FUNCTIONS ===
function showAuth(){
  const m = document.getElementById("authModal");
  if(m){ m.classList.remove("hidden"); m.style.display = "flex"; }
  show("menuScreen");
}
function hideAuth(){
  const m = document.getElementById("authModal");
  if(m){ m.classList.add("hidden"); m.style.display = "none"; }
}
function show(id){
  const el = document.getElementById(id);
  if(el) el.classList.remove("hidden");
}
function hide(id){
  const el = document.getElementById(id);
  if(el) el.classList.add("hidden");
}

// === SAFE LOGIN ===
async function doLogin() {
  const username = document.getElementById("loginUser")?.value.trim();
  const password = document.getElementById("loginPass")?.value.trim();
  const status = document.getElementById("authStatus");

  if (!username || !password) {
    if (status) status.textContent = "⚠️ Enter username and password";
    return;
  }
  if (status) status.textContent = "🔐 Logging in...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (status) status.textContent = "✅ Login successful!";
      setTimeout(hideAuth, 600);
    } else {
      if (status) status.textContent = `❌ ${data.error || "Login failed"}`;
    }
  } catch (err) {
    console.error("Login error:", err);
    if (status) status.textContent = "⚠️ Server error – try again later";
  }
}

// === SAFE REGISTER ===
async function doRegister() {
  const username = document.getElementById("regUser")?.value.trim();
  const password = document.getElementById("regPass")?.value.trim();
  const confirmPass = document.getElementById("regConfirm")?.value.trim();
  const status = document.getElementById("authStatus");

  if (!username || !password || !confirmPass) {
    if (status) status.textContent = "⚠️ Fill all fields";
    return;
  }
  if (password !== confirmPass) {
    if (status) status.textContent = "⚠️ Passwords do not match";
    return;
  }
  if (password.length < 6) {
    if (status) status.textContent = "⚠️ Password at least 6 characters";
    return;
  }
  if (status) status.textContent = "📝 Creating account...";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (status) status.textContent = "✅ Account created!";
      setTimeout(hideAuth, 800);
    } else {
      if (status) status.textContent = `❌ ${data.error || "Registration failed"}`;
    }
  } catch (err) {
    console.error("Register error:", err);
    if (status) status.textContent = "⚠️ Server error – try again later";
  }
}