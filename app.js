const H0 = 8;
const H1 = 20;
const PX = 40;
const DAY_HEIGHT = (H1 - H0) * PX;

const config = window.APP_CONFIG || {};
const ALLOWED_EMAILS = (config.allowedEmails || []).map((email) => String(email).trim().toLowerCase());

const S = {
  me: [],
  her: [],
  date: new Date(),
  currentUser: null
};

let supabase = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function monday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function setAuthMessage(message, isError = false) {
  const node = document.getElementById("authMessage");
  node.textContent = message;
  node.style.color = isError ? "#ff6b7d" : "#2ca66f";
}

function showApp() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
}

function showAuth() {
  document.getElementById("appScreen").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
}

function makeEvent(day, start, end, title) {
  const m = monday(S.date);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const a = new Date(m);
  const b = new Date(m);

  a.setDate(m.getDate() + Number(day));
  b.setDate(m.getDate() + Number(day));

  a.setHours(sh, sm, 0, 0);
  b.setHours(eh, em, 0, 0);

  return { start: a, end: b, title };
}

async function loadFromSupabase() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from("planner_events")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadFromSupabase", error);
    return;
  }

  S.me = (data || [])
    .filter((event) => event.user_role === "me")
    .map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    }));

  S.her = (data || [])
    .filter((event) => event.user_role === "her")
    .map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    }));
}

async function saveToSupabase() {
  if (!supabase || !S.currentUser) return;

  const all = [...S.me, ...S.her];
  const { error } = await supabase.from("planner_events").upsert(
    all.map((event) => ({
      id: event.id || crypto.randomUUID(),
      title: event.title,
      user_role: event.user_role || (S.currentUser.role === "me" ? "me" : "her"),
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      created_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );

  if (error) {
    console.error("saveToSupabase", error);
  }
}

function renderList() {
  const box = document.getElementById("eventList");
  box.innerHTML = "";

  const all = [
    ...S.me.map((event, i) => ({ ...event, who: "me", i })),
    ...S.her.map((event, i) => ({ ...event, who: "her", i }))
  ];

  all.sort((a, b) => a.start - b.start);

  if (all.length === 0) {
    box.innerHTML = '<span class="sub">Aucun cours ajouté pour l’instant.</span>';
    return;
  }

  const names = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  all.forEach((event) => {
    const row = document.createElement("div");
    row.className = "eventRow";

    const day = (event.start.getDay() + 6) % 7;
    row.innerHTML = `
      <span class="mini ${event.who}">${event.who === "me" ? "Moi" : "Elle"}</span>
      <b>${names[day]} ${pad(event.start.getHours())}:${pad(event.start.getMinutes())} – ${pad(event.end.getHours())}:${pad(event.end.getMinutes())}</b>
      <span>${event.title}</span>
      <button type="button">×</button>
    `;

    row.querySelector("button").onclick = async () => {
      const target = event.who === "me" ? S.me : S.her;
      target.splice(event.i, 1);
      await saveToSupabase();
      render();
    };

    box.appendChild(row);
  });
}

function renderCalendar() {
  const m = monday(S.date);
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  grid.style.gridTemplateRows = `auto ${DAY_HEIGHT}px`;
  document.documentElement.style.setProperty("--day-height", `${DAY_HEIGHT}px`);

  const blank = document.createElement("div");
  blank.className = "head";
  grid.append(blank);

  for (let i = 0; i < 7; i++) {
    const head = document.createElement("div");
    head.className = "head";
    const date = new Date(m);
    date.setDate(m.getDate() + i);
    head.textContent = days[i] + " " + date.getDate() + "/" + (date.getMonth() + 1);
    grid.append(head);
  }

  const timeScale = document.createElement("div");
  timeScale.className = "time-scale";
  timeScale.style.height = `${DAY_HEIGHT}px`;

  for (let hour = H0; hour < H1; hour++) {
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = pad(hour) + ":00";
    timeScale.appendChild(time);
  }

  grid.append(timeScale);

  for (let i = 0; i < 7; i++) {
    const cell = document.createElement("div");
    cell.className = "day";
    cell.style.height = `${DAY_HEIGHT}px`;
    grid.append(cell);
  }

  function placeEvents(events, type) {
    events.forEach((event) => {
      const dayIndex = Math.floor((event.start - m) / 86400000);
      if (dayIndex < 0 || dayIndex > 6) return;

      const startMinutes = Math.max(minutesOfDay(event.start), H0 * 60);
      const endMinutes = Math.min(minutesOfDay(event.end), H1 * 60);

      if (endMinutes <= startMinutes) return;

      const cell = grid.querySelectorAll(".day")[dayIndex];
      const el = document.createElement("div");
      el.className = `event ${type}`;
      el.style.top = (((startMinutes - H0 * 60) / 60) * PX) + "px";
      el.style.height = Math.max(22, ((endMinutes - startMinutes) / 60) * PX - 4) + "px";
      el.innerHTML = `<b>${event.title}</b><br>${pad(event.start.getHours())}:${pad(event.start.getMinutes())} – ${pad(event.end.getHours())}:${pad(event.end.getMinutes())}`;
      cell.append(el);
    });
  }

  placeEvents(S.me, "me");
  placeEvents(S.her, "her");

  let totalFree = 0;

  for (let d = 0; d < 7; d++) {
    const day = new Date(m);
    day.setDate(m.getDate() + d);

    const beginning = new Date(day);
    beginning.setHours(H0, 0, 0, 0);

    const ending = new Date(day);
    ending.setHours(H1, 0, 0, 0);

    const busy = [...S.me, ...S.her]
      .filter((event) => event.start < ending && event.end > beginning)
      .map((event) => [Math.max(event.start, beginning), Math.min(event.end, ending)])
      .sort((a, b) => a[0] - b[0]);

    let cursor = beginning;

    for (const [start, end] of busy) {
      if (start > cursor) totalFree += (start - cursor) / 3600000;
      if (end > cursor) cursor = end;
    }

    if (cursor < ending) totalFree += (ending - cursor) / 3600000;
  }

  document.getElementById("meCount").textContent = S.me.length;
  document.getElementById("herCount").textContent = S.her.length;
  document.getElementById("freeCount").textContent = totalFree.toFixed(1) + " h";

  const formatDate = (date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const endWeek = new Date(m);
  endWeek.setDate(m.getDate() + 6);
  document.getElementById("weekLabel").textContent = formatDate(m) + " – " + formatDate(endWeek);
}

function render() {
  renderCalendar();
  renderList();
}

async function initializeSupabase() {
  const url = config.supabaseUrl;
  const key = config.supabaseAnonKey;

  const hasRealSupabaseConfig =
    url &&
    key &&
    !url.includes("YOUR_PROJECT_ID") &&
    !key.includes("YOUR_") &&
    !url.includes("ManonJorick.com");

  if (!hasRealSupabaseConfig) {
    setAuthMessage("Mode démo activé : configure les vraies clés Supabase pour enregistrer les données.", false);
    return false;
  }

  supabase = window.supabase.createClient(url, key);
  return true;
}

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (!ALLOWED_EMAILS.includes(email)) {
    setAuthMessage("Accès refusé : seul vous deux pouvez ouvrir ce site.", true);
    return;
  }

  if (!supabase) {
    setAuthMessage("Supabase non configuré.", true);
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    setAuthMessage("Email ou mot de passe incorrect.", true);
    return;
  }

  S.currentUser = {
    id: data.user.id,
    email: data.user.email,
    role: email === "jorick.lerissel@outlook.com" ? "me" : "her"
  };

  document.getElementById("userBadge").textContent = `${data.user.email} • ${S.currentUser.role === "me" ? "Moi" : "Elle"}`;
  setAuthMessage("Connexion réussie.");
  await loadFromSupabase();
  showApp();
  render();
}

async function handleLogout() {
  if (supabase) {
    await supabase.auth.signOut();
  }

  S.currentUser = null;
  document.getElementById("loginForm").reset();
  setAuthMessage("Vous avez été déconnecté.");
  showAuth();
}

async function handleSubmitEvent(event) {
  event.preventDefault();

  const who = document.getElementById("who").value;
  const day = document.getElementById("day").value;
  const start = document.getElementById("startInput").value;
  const end = document.getElementById("endInput").value;
  const title = document.getElementById("titleInput").value.trim();

  if (!title || !start || !end) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  if (end <= start) {
    alert("L'heure de fin doit être après l'heure de début.");
    return;
  }

  const newEvent = makeEvent(day, start, end, title);
  if (who === "me") {
    S.me.push({ ...newEvent, user_role: "me", id: crypto.randomUUID() });
  } else {
    S.her.push({ ...newEvent, user_role: "her", id: crypto.randomUUID() });
  }

  document.getElementById("titleInput").value = "";
  await saveToSupabase();
  render();
}

async function loadSession() {
  if (!supabase) {
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    const email = session.user.email?.toLowerCase();
    if (ALLOWED_EMAILS.includes(email || "")) {
      S.currentUser = {
        id: session.user.id,
        email,
        role: email === "jorick.lerissel@outlook.com" ? "me" : "her"
      };
      await loadFromSupabase();
      showApp();
      render();
      document.getElementById("userBadge").textContent = `${email} • ${S.currentUser.role === "me" ? "Moi" : "Elle"}`;
      return;
    }
  }

  showAuth();
}

async function init() {
  const ready = await initializeSupabase();

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("eventForm").addEventListener("submit", handleSubmitEvent);
  document.getElementById("prev").onclick = () => { S.date.setDate(S.date.getDate() - 7); render(); };
  document.getElementById("next").onclick = () => { S.date.setDate(S.date.getDate() + 7); render(); };
  document.getElementById("today").onclick = () => { S.date = new Date(); render(); };
  document.getElementById("demo").onclick = () => {
    S.me = [
      makeEvent(0, "09:00", "12:00", "Analyse"),
      makeEvent(0, "14:00", "17:00", "Projet"),
      makeEvent(1, "10:00", "12:00", "Électronique")
    ];
    S.her = [
      makeEvent(0, "10:00", "12:00", "Droit civil"),
      makeEvent(0, "14:00", "16:00", "TD"),
      makeEvent(1, "08:00", "11:00", "Droit administratif")
    ];
    render();
  };

  if (!ready) {
    render();
    return;
  }

  await loadSession();
}

init();
