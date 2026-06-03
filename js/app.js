const App = (() => {
  // ── STATE ──
  let state = {
    lists: {}, // { id: { name, items: {} } }
    currentListId: null,
    history: [],
    favorites: {}, // { normalizedName: { name, emoji, category, count } }
    user: null,
    dbReady: false,
    currentScreen: "list",
  };

  const CAT_ORDER = ["Frais", "Surgelés", "Boulangerie", "Épicerie", "Boissons", "Hygiène", "Bébé", "Autre"];
  const CAT_ICONS = {
    Frais: "🧊",
    Épicerie: "🛒",
    Bébé: "👶",
    Hygiène: "🧴",
    Surgelés: "❄️",
    Boissons: "🥤",
    Boulangerie: "🥖",
    Autre: "📦",
  };

  // ── INIT ──
  function init() {
    loadUser();
    listenFirebase();
    bindEvents();
    setTimeout(() => {
      if (!state.dbReady) {
        hide("loading-overlay");
        showToast("Connexion lente", "error");
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
    initNotifications(state.user.initial);
    initNotifications(initial);
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
    DB.onLists(
      (data) => {
        state.lists = data || {};

        // Première connexion : créer liste par défaut si vide
        if (Object.keys(state.lists).length === 0) {
          createList("Courses", true);
          return;
        }

        // Restaurer la liste courante
        const savedId = localStorage.getItem("listo_current_list");
        if (savedId && state.lists[savedId]) {
          state.currentListId = savedId;
        } else {
          state.currentListId = Object.keys(state.lists)[0];
        }

        if (!state.dbReady) {
          state.dbReady = true;
          hide("loading-overlay");
          setSyncState("connected");
        }

        renderList();
        updateHeader();
        updateListPickerBtn();
      },
      (err) => {
        console.error(err);
        setSyncState("error");
        hide("loading-overlay");
        showToast("Erreur Firebase", "error");
      },
    );

    DB.onHistory((data) => {
      state.history = data ? Object.values(data).sort((a, b) => b.date - a.date) : [];
      if (state.currentScreen === "history") renderHistory();
    });

    DB.onFavorites((data) => {
      state.favorites = data || {};
      renderFavorites();
    });
  }

  function currentList() {
    return state.lists[state.currentListId] || { name: "", items: {} };
  }

  function currentItems() {
    return Object.values(currentList().items || {});
  }

  async function saveCurrentList() {
    setSyncState("syncing");
    try {
      await DB.setList(state.currentListId, state.lists[state.currentListId]);
      setSyncState("connected");
    } catch (e) {
      setSyncState("error");
      showToast("Erreur de sauvegarde", "error");
    }
  }

  // ── LISTS MANAGEMENT ──
  function createList(name, isDefault = false) {
    const id = Date.now().toString(36);
    const newList = { id, name, items: {} };
    state.lists[id] = newList;
    DB.setList(id, newList);
    if (isDefault || !state.currentListId) {
      state.currentListId = id;
      localStorage.setItem("listo_current_list", id);
    }
    updateListPickerBtn();
  }

  function switchList(id) {
    state.currentListId = id;
    localStorage.setItem("listo_current_list", id);
    closeModal();
    renderList();
    updateHeader();
    updateListPickerBtn();
  }

  function deleteList(id) {
    if (Object.keys(state.lists).length <= 1) {
      showToast("Impossible de supprimer la dernière liste", "error");
      return;
    }
    DB.deleteList(id);
    delete state.lists[id];
    if (state.currentListId === id) {
      state.currentListId = Object.keys(state.lists)[0];
      localStorage.setItem("listo_current_list", state.currentListId);
    }
    closeModal();
    renderList();
    updateHeader();
    updateListPickerBtn();
  }

  function updateListPickerBtn() {
    const list = currentList();
    document.getElementById("current-list-name").textContent = list.name || "Listo";
  }

  // ── LIST PICKER MODAL ──
  function openListPicker() {
    const lists = Object.values(state.lists);
    let html = `<div class="modal-title">Mes listes</div>`;

    for (const list of lists) {
      const items = Object.values(list.items || {});
      const count = items.filter((i) => !i.done).length;
      const isActive = list.id === state.currentListId;
      html += `<div class="list-picker-item" onclick="App.switchList('${list.id}')">
        <div class="list-picker-name">${list.name}</div>
        <div class="list-picker-count">${count} article${count !== 1 ? "s" : ""}</div>
        ${isActive ? '<div class="list-picker-active">✓</div>' : ""}
        <button class="list-picker-del" onclick="event.stopPropagation();App.deleteList('${list.id}')">×</button>
      </div>`;
    }

    html += `<div class="new-list-row">
      <input class="form-input" type="text" id="new-list-input" placeholder="Nouvelle liste…" autocomplete="off">
      <button class="btn-teal" onclick="App.submitNewList()">Créer</button>
    </div>`;

    document.getElementById("modal-content").innerHTML = html;
    openModal();

    setTimeout(() => {
      const inp = document.getElementById("new-list-input");
      if (inp)
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submitNewList();
        });
    }, 100);
  }

  function submitNewList() {
    const inp = document.getElementById("new-list-input");
    const name = inp ? inp.value.trim() : "";
    if (!name) return;
    createList(name);
    closeModal();
    showToast(`Liste "${name}" créée ✓`, "success");
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
    const items = currentItems();
    const todo = items.filter((i) => !i.done).length;
    const done = items.filter((i) => i.done).length;
    const sub = document.getElementById("header-subtitle");
    if (state.currentScreen === "list") {
      if (items.length === 0) sub.textContent = "Liste vide";
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
    const items = currentItems();
    const todo = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done);
    const finishBar = document.getElementById("finish-bar");

    finishBar.style.display = done.length > 0 ? "block" : "none";

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>Liste vide !<br>Ajoute des articles via l'onglet Ajouter.</p></div>`;
      return;
    }

    let html = "";

    if (todo.length > 0) {
      const cats = [...new Set(todo.map((i) => i.category))];
      cats.sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
      html += `<div class="section-label">À acheter · ${todo.length}</div>`;
      for (const cat of cats) {
        const catItems = todo.filter((i) => i.category === cat);
        html += `<div class="section-sublabel">${CAT_ICONS[cat] || "📦"} ${cat}</div>`;
        html += `<div class="item-list">`;
        for (const item of catItems) html += renderItem(item);
        html += `</div>`;
      }
    }

    if (done.length > 0) {
      html += `<div class="section-label" style="margin-top:8px;">Dans le caddie · ${done.length}</div>`;
      html += `<div class="item-list">`;
      for (const item of done) html += renderItem(item);
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  function renderItem(item) {
    return `<div class="item-card ${item.done ? "done" : ""}" id="item-${item.id}">
      <button class="check-btn ${item.done ? "checked" : ""}" onclick="App.toggleItem('${item.id}')"></button>
      <div class="item-info">
        <div class="item-name">${item.emoji} ${item.name}</div>
        ${item.note ? `<div class="item-note">💬 ${item.note}</div>` : ""}
        <div class="item-meta">${item.category}${item.qty > 1 ? ` · x${item.qty}` : ""}</div>
      </div>
      <div class="item-right">
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="App.changeQty('${item.id}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="App.changeQty('${item.id}',1)">+</button>
        </div>
        <div class="who-badge who-${item.addedBy}">${item.addedBy}</div>
        <div class="item-actions">
          <button class="action-btn edit" onclick="App.openEditItem('${item.id}')">✏️</button>
          <button class="action-btn del" onclick="App.deleteItem('${item.id}')">×</button>
        </div>
      </div>
    </div>`;
  }

  // ── FAVORITES ──
  function renderFavorites() {
    const bar = document.getElementById("favorites-bar");
    const sorted = Object.values(state.favorites)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    if (sorted.length === 0) {
      bar.classList.remove("visible");
      return;
    }

    bar.classList.add("visible");
    bar.innerHTML = `<div class="fav-label">⭐ Fréquents</div>
      <div class="fav-chips">${sorted
        .map(
          (f) =>
            `<div class="fav-chip" onclick="App.addFavorite('${encodeURIComponent(JSON.stringify(f))}')">${f.emoji} ${f.name}</div>`,
        )
        .join("")}</div>`;
  }

  function addFavorite(encoded) {
    const f = JSON.parse(decodeURIComponent(encoded));
    addItem({ name: f.name, emoji: f.emoji, category: f.category, qty: 1, note: "" });
  }

  function updateFavorites(name, emoji, category) {
    const key = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    const existing = state.favorites[key] || { name, emoji, category, count: 0 };
    existing.count += 1;
    state.favorites[key] = existing;
    DB.setFavorites(state.favorites);
  }

  // ── AUTOCOMPLETE ──
  function renderAutocomplete(query) {
    const list = document.getElementById("autocomplete-list");
    if (!query || query.length < 2) {
      list.classList.remove("visible");
      return;
    }

    const q = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Cherche dans favoris + historique
    const candidates = new Map();

    Object.values(state.favorites).forEach((f) => {
      const norm = f.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (norm.includes(q)) candidates.set(f.name.toLowerCase(), f);
    });

    state.history.forEach((session) => {
      (session.items || []).forEach((item) => {
        const norm = item.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (norm.includes(q) && !candidates.has(item.name.toLowerCase())) {
          candidates.set(item.name.toLowerCase(), {
            name: item.name,
            emoji: item.emoji,
            category: item.category,
            count: 0,
          });
        }
      });
    });

    const results = [...candidates.values()].slice(0, 5);

    if (results.length === 0) {
      list.classList.remove("visible");
      return;
    }

    list.innerHTML = results
      .map(
        (r) =>
          `<div class="ac-item" onclick="App.selectAutocomplete('${encodeURIComponent(JSON.stringify(r))}')">
        <span class="ac-emoji">${r.emoji}</span>
        <span class="ac-name">${r.name}</span>
        <span class="ac-cat">${r.category}</span>
      </div>`,
      )
      .join("");
    list.classList.add("visible");
  }

  function selectAutocomplete(encoded) {
    const item = JSON.parse(decodeURIComponent(encoded));
    document.getElementById("quick-input").value = "";
    document.getElementById("autocomplete-list").classList.remove("visible");
    addItem({ name: item.name, emoji: item.emoji, category: item.category, qty: 1, note: "" });
  }

  // ── QUICK ADD ──
  function quickAdd() {
    const val = document.getElementById("quick-input").value.trim();
    if (!val) {
      showToast("Saisis un nom d'article", "error");
      return;
    }
    document.getElementById("quick-input").value = "";
    document.getElementById("autocomplete-list").classList.remove("visible");
    addItem({ name: val, emoji: getEmoji(val), category: guessCategory(val), qty: 1, note: "" });
  }

  // ── ADVANCED ADD ──
  function addAdvanced() {
    const name = document.getElementById("adv-name").value.trim();
    if (!name) {
      showToast("Saisis un nom d'article", "error");
      return;
    }
    const note = document.getElementById("adv-note").value.trim();
    const category = document.getElementById("adv-category").value;
    const qty = parseInt(document.getElementById("adv-qty").value) || 1;
    addItem({ name, emoji: getEmoji(name), category, qty, note });
    document.getElementById("adv-name").value = "";
    document.getElementById("adv-note").value = "";
    document.getElementById("adv-qty").value = "1";
  }

  // ── ADD ITEM ──
  function addItem({ name, emoji, category, qty, note }) {
    if (!state.user) {
      showToast("Choisis ton profil d'abord", "error");
      return;
    }
    if (!state.currentListId) return;

    const list = state.lists[state.currentListId];
    if (!list) return;

    // Doublon ?
    const existing = Object.values(list.items || {}).find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && !i.done,
    );
    if (existing) {
      existing.qty += qty;
      saveCurrentList();
      showToast(`+${qty} ajouté à ${existing.name}`, "success");
      renderList();
      updateHeader();
      return;
    }

    if (!list.items) list.items = {};
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    list.items[id] = {
      id,
      name,
      emoji,
      category,
      qty,
      note,
      done: false,
      addedBy: state.user.initial,
      addedAt: Date.now(),
    };

    updateFavorites(name, emoji, category);
    saveCurrentList();
    renderList();
    renderFavorites();
    updateHeader();
    showToast(`${name} ajouté ✓`, "success");
    switchScreen("list");
  }

  // ── TOGGLE / QTY / DELETE ──
  function toggleItem(id) {
    const list = state.lists[state.currentListId];
    if (!list || !list.items || !list.items[id]) return;
    list.items[id].done = !list.items[id].done;
    saveCurrentList();
    renderList();
    updateHeader();
  }

  function changeQty(id, delta) {
    const list = state.lists[state.currentListId];
    if (!list || !list.items || !list.items[id]) return;
    const item = list.items[id];
    item.qty = Math.max(1, item.qty + delta);
    saveCurrentList();
    renderList();
  }

  function deleteItem(id) {
    const list = state.lists[state.currentListId];
    if (!list || !list.items) return;
    delete list.items[id];
    saveCurrentList();
    renderList();
    updateHeader();
  }

  // ── EDIT ITEM MODAL ──
  function openEditItem(id) {
    const list = state.lists[state.currentListId];
    if (!list || !list.items || !list.items[id]) return;
    const item = list.items[id];

    const catOptions = ["Frais", "Épicerie", "Bébé", "Hygiène", "Surgelés", "Boissons", "Boulangerie", "Autre"]
      .map((c) => `<option value="${c}" ${c === item.category ? "selected" : ""}>${CAT_ICONS[c]} ${c}</option>`)
      .join("");

    document.getElementById("modal-content").innerHTML = `
      <div class="modal-title">Modifier l'article</div>
      <div class="edit-row">
        <div class="edit-label">Nom</div>
        <input class="edit-input" type="text" id="edit-name" value="${item.name}" autocomplete="off">
      </div>
      <div class="edit-row">
        <div class="edit-label">Commentaire</div>
        <input class="edit-input" type="text" id="edit-note" value="${item.note || ""}" placeholder="Ex: prendre le bio…" autocomplete="off">
      </div>
      <div class="edit-row">
        <div class="edit-label">Rayon</div>
        <select class="edit-input" id="edit-category">${catOptions}</select>
      </div>
      <div class="edit-row">
        <div class="edit-label">Quantité</div>
        <input class="edit-input" type="number" id="edit-qty" value="${item.qty}" min="1" inputmode="numeric">
      </div>
      <button class="btn-save" onclick="App.saveEditItem('${id}')">Enregistrer</button>
    `;
    openModal();
  }

  function saveEditItem(id) {
    const list = state.lists[state.currentListId];
    if (!list || !list.items || !list.items[id]) return;
    const item = list.items[id];
    const name = document.getElementById("edit-name").value.trim();
    if (!name) return;
    item.name = name;
    item.note = document.getElementById("edit-note").value.trim();
    item.category = document.getElementById("edit-category").value;
    item.qty = parseInt(document.getElementById("edit-qty").value) || 1;
    item.emoji = getEmoji(name);
    saveCurrentList();
    closeModal();
    renderList();
    showToast("Article modifié ✓", "success");
  }

  // ── FINISH SHOPPING ──
  function finishShopping() {
    const list = state.lists[state.currentListId];
    if (!list) return;
    const items = Object.values(list.items || {});
    const done = items.filter((i) => i.done);
    const remaining = items.filter((i) => !i.done);

    if (done.length === 0) return;

    const session = {
      id: Date.now().toString(36),
      date: Date.now(),
      listName: list.name,
      items: done,
    };

    state.history.unshift(session);

    // Remettre les non-cochés sans le flag done
    list.items = {};
    remaining.forEach((i) => {
      list.items[i.id] = { ...i, done: false };
    });

    saveCurrentList();
    const histObj = {};
    state.history.forEach((s) => {
      histObj[s.id] = s;
    });
    DB.setHistory(histObj);

    renderList();
    renderHistory();
    updateHeader();
    showToast(`${done.length} article${done.length > 1 ? "s" : ""} archivé${done.length > 1 ? "s" : ""} ✓`, "success");
  }

  // ── HISTORY ──
  function renderHistory() {
    const container = document.getElementById("history-content");
    if (state.history.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Aucune course archivée.</p></div>`;
      return;
    }

    let html = "";
    for (const session of state.history) {
      const date = new Date(session.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const count = (session.items || []).length;
      const enc = encodeURIComponent(session.id);
      html += `<div class="history-session">
        <div class="history-session-header">
          <div>
            <div class="history-session-date">${date}</div>
            <div class="history-session-count">${session.listName || ""} · ${count} article${count !== 1 ? "s" : ""}</div>
          </div>
          <button class="btn-recreate" onclick="App.recreateList('${enc}')">🔁 Recréer</button>
        </div>
        <div class="item-list">`;
      for (const item of session.items || []) {
        html += `<div class="history-item" onclick="App.addFromHistory('${encodeURIComponent(JSON.stringify({ name: item.name, emoji: item.emoji, category: item.category, qty: item.qty, note: item.note || "" }))}')">
          <div class="history-item-info">
            <div class="history-item-name">${item.emoji} ${item.name}</div>
            <div class="history-item-meta">${item.category}${item.qty > 1 ? ` · x${item.qty}` : ""}</div>
          </div>
          <div class="history-item-add">+</div>
        </div>`;
      }
      html += `</div></div>`;
    }
    container.innerHTML = html;
  }

  function addFromHistory(encoded) {
    const item = JSON.parse(decodeURIComponent(encoded));
    addItem({ name: item.name, emoji: item.emoji, category: item.category, qty: item.qty, note: item.note || "" });
  }

  function recreateList(encodedId) {
    const id = decodeURIComponent(encodedId);
    const session = state.history.find((s) => s.id === id);
    if (!session) return;
    let added = 0;
    for (const item of session.items || []) {
      addItem({ name: item.name, emoji: item.emoji, category: item.category, qty: item.qty, note: item.note || "" });
      added++;
    }
    showToast(`${added} article${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} ✓`, "success");
  }

  // ── MODAL ──
  function openModal() {
    document.getElementById("modal-overlay").classList.add("open");
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.remove("open");
  }

  // ── SYNC DOT ──
  function setSyncState(s) {
    document.getElementById("sync-dot").className = "sync-dot " + s;
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

  // ── HELPERS ──
  function hide(id) {
    document.getElementById(id).classList.add("hidden");
  }

  // ── EVENTS ──
  function bindEvents() {
    document.getElementById("quick-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") quickAdd();
    });
    document.getElementById("quick-input").addEventListener("input", (e) => {
      renderAutocomplete(e.target.value);
    });
    document.getElementById("adv-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addAdvanced();
    });
  }

  // ── PUBLIC ──
  return {
    init,
    setUser,
    switchScreen,
    openListPicker,
    switchList,
    deleteList,
    submitNewList,
    toggleItem,
    changeQty,
    deleteItem,
    openEditItem,
    saveEditItem,
    quickAdd,
    addAdvanced,
    addFavorite,
    selectAutocomplete,
    addFromHistory,
    recreateList,
    finishShopping,
    closeModal,
    showToast,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
