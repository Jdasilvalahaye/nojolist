// ── APP ──
const App = (() => {
  // ── STATE ──
  let state = {
    list: [], // articles en cours
    history: [], // sessions archivées
    user: null, // { initial: 'J', name: 'Jonathan' }
    dbReady: false,
    currentScreen: "list",
  };

  const CATEGORY_ICONS = {
    Frais: "🧊",
    Épicerie: "🛒",
    Bébé: "👶",
    Hygiène: "🧴",
    Surgelés: "❄️",
    Boissons: "🥤",
    Autre: "📦",
  };

  const CAT_ORDER = ["Frais", "Surgelés", "Boulangerie", "Épicerie", "Boissons", "Hygiène", "Bébé", "Autre"];

  // ── INIT ──
  function init() {
    loadUser();
    listenFirebase();
    bindEvents();

    // Timeout de sécurité si Firebase tarde
    setTimeout(() => {
      if (!state.dbReady) {
        document.getElementById("loading-overlay").classList.add("hidden");
        showToast("Connexion lente — mode hors ligne", "error");
        setSyncState("error");
      }
    }, 6000);
  }

  // ── USER ──
  function loadUser() {
    const saved = localStorage.getItem("listo_user");
    if (saved) {
      state.user = JSON.parse(saved);
      document.getElementById("onboarding-overlay").style.display = "none";
      updateUserBadge();
    }
  }

  function setUser(initial, name) {
    state.user = { initial, name };
    localStorage.setItem("listo_user", JSON.stringify(state.user));
    document.getElementById("onboarding-overlay").style.display = "none";
    updateUserBadge();
    showToast(`Bienvenue ${name} !`, "success");
  }

  function updateUserBadge() {
    if (!state.user) return;
    const badge = document.getElementById("user-badge");
    badge.textContent = state.user.name;
    badge.className = `user-badge who-${state.user.initial}`;
  }

  // ── FIREBASE ──
  function listenFirebase() {
    DB.onList(
      (data) => {
        state.list = data ? Object.values(data) : [];
        if (!state.dbReady) {
          state.dbReady = true;
          document.getElementById("loading-overlay").classList.add("hidden");
          setSyncState("connected");
        }
        renderList();
        updateHeader();
      },
      (err) => {
        console.error(err);
        setSyncState("error");
        document.getElementById("loading-overlay").classList.add("hidden");
        showToast("Erreur Firebase", "error");
      },
    );

    DB.onHistory((data) => {
      state.history = data ? Object.values(data).sort((a, b) => b.date - a.date) : [];
      renderHistory();
    });
  }

  async function saveList() {
    setSyncState("syncing");
    try {
      const obj = {};
      state.list.forEach((i) => {
        obj[i.id] = i;
      });
      await DB.setList(obj);
      setSyncState("connected");
    } catch (e) {
      setSyncState("error");
      showToast("Erreur de sauvegarde", "error");
    }
  }

  async function saveHistory() {
    const obj = {};
    state.history.forEach((s) => {
      obj[s.id] = s;
    });
    await DB.setHistory(obj);
  }

  // ── SYNC DOT ──
  function setSyncState(s) {
    document.getElementById("sync-dot").className = "sync-dot " + s;
  }

  // ── NAVIGATION ──
  function switchScreen(name) {
    state.currentScreen = name;
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    document.querySelector(`[data-screen="${name}"]`).classList.add("active");
    if (name === "history") renderHistory();
    updateHeader();
  }

  function updateHeader() {
    const todo = state.list.filter((i) => !i.done).length;
    const done = state.list.filter((i) => i.done).length;
    const sub = document.getElementById("header-subtitle");
    if (state.currentScreen === "list") {
      if (state.list.length === 0) sub.textContent = "Liste vide";
      else sub.textContent = `${todo} à acheter · ${done} dans le caddie`;
    } else if (state.currentScreen === "add") {
      sub.textContent = "Ajouter un article";
    } else {
      sub.textContent = "Courses précédentes";
    }
  }

  // ── RENDER LIST ──
  function renderList() {
    const container = document.getElementById("list-content");
    const todo = state.list.filter((i) => !i.done);
    const done = state.list.filter((i) => i.done);
    const finishBar = document.getElementById("finish-bar");

    // Afficher/cacher le bouton terminer
    finishBar.style.display = done.length > 0 ? "block" : "none";

    if (state.list.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>La liste est vide.<br>Ajoute des articles via l'onglet Ajouter !</p></div>`;
      return;
    }

    let html = "";

    // Articles à acheter, groupés par rayon
    if (todo.length > 0) {
      const cats = [...new Set(todo.map((i) => i.category))];
      cats.sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));

      html += `<div class="section-label">À acheter · ${todo.length}</div>`;
      for (const cat of cats) {
        const items = todo.filter((i) => i.category === cat);
        html += `<div class="section-label" style="padding:8px 16px 4px;font-size:9px;opacity:0.7;">${CATEGORY_ICONS[cat] || "📦"} ${cat}</div>`;
        html += `<div class="item-list">`;
        for (const item of items) {
          html += renderItem(item);
        }
        html += `</div>`;
      }
    }

    // Articles dans le caddie
    if (done.length > 0) {
      html += `<div class="section-label" style="margin-top:8px;">Dans le caddie · ${done.length}</div>`;
      html += `<div class="item-list">`;
      for (const item of done) {
        html += renderItem(item);
      }
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  function renderItem(item) {
    return `<div class="item-card ${item.done ? "done" : ""}" id="item-${item.id}">
      <button class="check-btn ${item.done ? "checked" : ""}" onclick="App.toggleItem('${item.id}')"></button>
      <div class="item-info">
        <div class="item-name">${item.emoji} ${item.name}</div>
        <div class="item-meta">${item.category}${item.qty > 1 ? ` · x${item.qty}` : ""}${item.brand ? ` · ${item.brand}` : ""}</div>
      </div>
      <div class="item-right">
        <div class="who-badge who-${item.addedBy}">${item.addedBy}</div>
        <button class="delete-btn" onclick="App.deleteItem('${item.id}')">×</button>
      </div>
    </div>`;
  }

  // ── TOGGLE / DELETE ──
  function toggleItem(id) {
    const item = state.list.find((i) => i.id === id);
    if (!item) return;
    item.done = !item.done;
    saveList();
    renderList();
    updateHeader();
  }

  function deleteItem(id) {
    state.list = state.list.filter((i) => i.id !== id);
    saveList();
    renderList();
    updateHeader();
  }

  // ── FINISH SHOPPING ──
  function finishShopping() {
    const done = state.list.filter((i) => i.done);
    const remaining = state.list.filter((i) => !i.done);

    if (done.length === 0) return;

    // Archive les articles cochés
    const session = {
      id: Date.now().toString(36),
      date: Date.now(),
      items: done,
    };

    state.history.unshift(session);
    state.list = remaining.map((i) => ({ ...i, done: false })); // remet les non-cochés à "à acheter"

    saveList();
    saveHistory();
    renderList();
    renderHistory();
    updateHeader();
    showToast(`${done.length} article${done.length > 1 ? "s" : ""} archivé${done.length > 1 ? "s" : ""} ✓`, "success");
  }

  // ── OPEN FOOD FACTS SEARCH ──
  async function searchOFF() {
    const query = document.getElementById("off-input").value.trim();
    if (!query) {
      showToast("Saisis un nom de produit", "error");
      return;
    }

    const resultsDiv = document.getElementById("off-results");
    resultsDiv.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Recherche en cours…</div>';

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=product_name_fr,product_name,brands&page_size=8&lc=fr&countries_tags=en:france&sort_by=unique_scans_n`,
      );
      const data = await res.json();
      const products = (data.products || []).filter((p) => p.product_name_fr || p.product_name);

      if (products.length === 0) {
        resultsDiv.innerHTML =
          '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Aucun résultat — essaie un autre terme ou ajoute manuellement.</div>';
        return;
      }

      let html = '<div class="off-result-list">';
      for (const p of products) {
        const name = p.product_name_fr || p.product_name;
        const brand = p.brands || "";
        const emoji = getEmoji(name);
        const encoded = encodeURIComponent(JSON.stringify({ name, brand }));
        html += `<div class="off-result-item" onclick="App.selectOFF('${encoded}')">
          <div class="off-result-emoji">${emoji}</div>
          <div class="off-result-info">
            <div class="off-result-name">${name}</div>
            ${brand ? `<div class="off-result-brand">${brand}</div>` : ""}
          </div>
          <div class="off-result-add">+</div>
        </div>`;
      }
      html += "</div>";
      resultsDiv.innerHTML = html;
    } catch (e) {
      resultsDiv.innerHTML =
        '<div style="color:#C0392B;font-size:12px;padding:8px 0;">Open Food Facts indisponible — utilise la saisie manuelle ci-dessous.</div>';
    }
  }

  function selectOFF(encoded) {
    const p = JSON.parse(decodeURIComponent(encoded));
    addItem({
      name: p.name,
      brand: p.brand,
      emoji: getEmoji(p.name),
      category: guessCategory(p.name),
      qty: 1,
    });
    document.getElementById("off-results").innerHTML = "";
    document.getElementById("off-input").value = "";
  }

  function guessCategory(name) {
    const lower = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (/lait|yaourt|fromage|beurre|creme|oeuf/.test(lower)) return "Frais";
    if (/surgele|glace|sorbet|pizza surgelee/.test(lower)) return "Surgelés";
    if (/bebe|couche|lait maternise|biberon/.test(lower)) return "Bébé";
    if (/shampooing|douche|savon|dentifrice|deodorant|lessive|vaisselle/.test(lower)) return "Hygiène";
    if (/eau|jus|soda|vin|biere|sirop|limonade/.test(lower)) return "Boissons";
    return "Épicerie";
  }

  function addManual() {
    const name = document.getElementById("manual-name").value.trim();
    if (!name) {
      showToast("Saisis un nom d'article", "error");
      return;
    }
    const category = document.getElementById("manual-category").value;
    const qty = parseInt(document.getElementById("manual-qty").value) || 1;
    addItem({ name, brand: "", emoji: getEmoji(name), category, qty });
    document.getElementById("manual-name").value = "";
    document.getElementById("manual-qty").value = "1";
  }

  function addItem({ name, brand, emoji, category, qty }) {
    if (!state.user) {
      showToast("Choisis ton profil d'abord", "error");
      return;
    }

    // Vérif doublon
    const existing = state.list.find((i) => i.name.toLowerCase() === name.toLowerCase() && !i.done);
    if (existing) {
      existing.qty += qty;
      saveList();
      showToast(`+${qty} ajouté à ${existing.name}`, "success");
      return;
    }

    state.list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name,
      brand,
      emoji,
      category,
      qty,
      done: false,
      addedBy: state.user.initial,
      addedAt: Date.now(),
    });

    saveList();
    showToast(`${name} ajouté ✓`, "success");
    switchScreen("list");
  }

  // ── RENDER HISTORY ──
  function renderHistory() {
    const container = document.getElementById("history-content");
    if (state.history.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Aucune course archivée pour l'instant.</p></div>`;
      return;
    }

    let html = "";
    for (const session of state.history) {
      const date = new Date(session.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const count = session.items.length;
      html += `<div class="history-session">
        <div class="history-session-header">
          <div class="history-session-date">${date}</div>
          <div class="history-session-count">${count} article${count > 1 ? "s" : ""}</div>
        </div>
        <div class="item-list">`;
      for (const item of session.items) {
        html += `<div class="item-card done">
          <div class="check-btn checked"></div>
          <div class="item-info">
            <div class="item-name">${item.emoji} ${item.name}</div>
            <div class="item-meta">${item.category}${item.qty > 1 ? ` · x${item.qty}` : ""}</div>
          </div>
          <div class="item-right">
            <div class="who-badge who-${item.addedBy}">${item.addedBy}</div>
          </div>
        </div>`;
      }
      html += `</div></div>`;
    }
    container.innerHTML = html;
  }

  // ── TOAST ──
  let toastTimer;
  function showToast(msg, type = "") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.className = "";
    }, 2500);
  }

  // ── EVENTS ──
  function bindEvents() {
    document.getElementById("off-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchOFF();
    });
    document.getElementById("manual-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addManual();
    });
  }

  // ── PUBLIC ──
  return {
    init,
    setUser,
    switchScreen,
    toggleItem,
    deleteItem,
    finishShopping,
    searchOFF,
    selectOFF,
    addManual,
    showToast,
  };
})();

// Démarrage
document.addEventListener("DOMContentLoaded", App.init);
