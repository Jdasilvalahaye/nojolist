/* ============================================================
   NOJOLIST — app.js
   ------------------------------------------------------------
   LOGIQUE PRINCIPALE de l'application.

   COMMENT ÇA MARCHE (le concept clé à comprendre) :

   1. Tout l'état de l'app vit dans l'objet `state` ci-dessous.
   2. Firebase nous envoie les données en temps réel → on met à
      jour `state` → on appelle les fonctions render…() qui
      redessinent l'écran à partir de `state`.
   3. Quand TU agis (cocher, ajouter…), on modifie `state` tout
      de suite (l'écran réagit instantanément) PUIS on envoie le
      changement à Firebase, qui le propage à l'autre téléphone.

   C'est le schéma : ACTION → STATE → RENDER, avec Firebase
   comme "source de vérité" partagée.

   SOMMAIRE (cherche les ════ pour naviguer) :
     1. Constantes        9. Ajout d'articles
     2. État             10. Packs
     3. Initialisation   11. Actions article (+ Annuler)
     4. Utilisateur       12. Terminer les courses (+ Annuler)
        & présence        13. Historique & stats
     5. Thème             14. Partage
     6. Firebase          15. Modales / Toast
     7. Listes            16. Mode Courses (wake lock, vibreur)
     8. Rendu de la liste 17. Mise à jour de l'app (SW)
   ============================================================ */

const App = (() => {

  /* ════ 1. CONSTANTES ════ */

  const APP_VERSION = "2.0.0";

  // Ordre d'affichage des rayons (≈ ordre d'un parcours en magasin).
  // Pour ajouter un rayon : ajoute-le ici, dans CAT_ICONS, et dans
  // les <select> de index.html. C'est tout !
  const CAT_ORDER = ["Frais", "Surgelés", "Boulangerie", "Épicerie", "Boissons", "Hygiène", "Bébé", "Autre"];
  const CAT_ICONS = {
    Frais: "🧊", Épicerie: "🛒", Bébé: "👶", Hygiène: "🧴",
    Surgelés: "❄️", Boissons: "🥤", Boulangerie: "🥖", Autre: "📦",
  };

  // Pas d'incrémentation des boutons +/− selon l'unité
  // (taper +1 gramme n'aurait aucun sens).
  const UNIT_STEPS = { x: 1, pack: 1, g: 100, kg: 0.5, L: 0.5, cL: 25 };

  /* ════ 2. ÉTAT ════ */

  let state = {
    lists: {},            // { id: { id, name, items: {} } }
    currentListId: null,
    history: [],          // [ { id, date, listName, items: [] } ] trié récent → ancien
    favorites: {},        // { cléNormalisée: { name, emoji, category, count } }
    packs: {},            // { id: { id, name, emoji, items: [] } }
    user: null,           // { initial: 'J'|'N', name }
    dbReady: false,
    currentScreen: "list",
    searchQuery: "",
    shopping: false,      // Mode Courses actif ?
    theme: "auto",        // 'auto' | 'light' | 'dark'
  };

  // Données volatiles (jamais sauvegardées) : utilisées pour
  // l'annulation et pour passer des objets aux clics sans les
  // encoder dans le HTML (plus propre et plus sûr qu'avant).
  let volatile = {
    undo: null,           // { type, payload } dernière action annulable
    acResults: [],        // résultats d'autocomplétion affichés
    favShown: [],         // favoris affichés
    wakeLock: null,       // verrou d'écran du Mode Courses
    swRegistration: null, // pour la mise à jour de l'app
  };

  /* ════ 3. INITIALISATION ════ */

  function init() {
    loadTheme();
    loadUser();
    listenFirebase();
    bindEvents();
    handleShortcut(); // ?screen=add depuis l'icône d'app (appui long)

    // Si Firebase ne répond pas en 6 s, on prévient au lieu de
    // laisser un écran de chargement infini.
    setTimeout(() => {
      if (!state.dbReady) {
        hide("loading-overlay");
        showToast("Connexion lente…", "error");
        setSyncState("error");
      }
    }, 6000);
  }

  // Gère les raccourcis du manifest (appui long sur l'icône → "Ajouter")
  function handleShortcut() {
    const params = new URLSearchParams(location.search);
    const screen = params.get("screen");
    if (screen && ["list", "add", "history"].includes(screen)) switchScreen(screen);
  }

  /* ════ 4. UTILISATEUR & PRÉSENCE ════ */

  function loadUser() {
    const saved = localStorage.getItem("listo_user"); // même clé qu'en v1 → pas de re-onboarding
    if (saved) {
      state.user = JSON.parse(saved);
      document.getElementById("onboarding-overlay").classList.add("hidden");
      updateUserBadge();
      DB.setupPresence(state.user.initial);
    }
  }

  function setUser(initial, name) {
    state.user = { initial, name };
    localStorage.setItem("listo_user", JSON.stringify(state.user));
    document.getElementById("onboarding-overlay").classList.add("hidden");
    updateUserBadge();
    DB.setupPresence(initial);
    showToast(`Bienvenue ${name} !`, "success");
  }

  function updateUserBadge() {
    if (!state.user) return;
    const badge = document.getElementById("user-badge");
    badge.textContent = state.user.initial;
    badge.className = `user-badge who-${state.user.initial}`;
  }

  // Affiche / cache la pastille "l'autre est en ligne"
  function renderPresence(presence) {
    if (!state.user || !presence) return;
    const other = state.user.initial === "J" ? "N" : "J";
    const badge = document.getElementById("partner-badge");
    const online = presence[other] && presence[other].online;
    badge.textContent = other;
    badge.className = `partner-badge who-${other}` + (online ? " online" : "");
    badge.title = online ? `${other === "J" ? "Jonathan" : "Noémie"} est en ligne` : "";
  }

  /* ════ 5. THÈME (clair / sombre / auto) ════ */

  function loadTheme() {
    state.theme = localStorage.getItem("nojolist_theme") || "auto";
    applyTheme();
    // Si réglé sur "auto", on suit en direct le réglage du téléphone
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => { if (state.theme === "auto") applyTheme(); });
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem("nojolist_theme", theme);
    applyTheme();
    openSettings(); // re-rendre la modale pour mettre à jour le sélecteur
  }

  function applyTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = state.theme === "dark" || (state.theme === "auto" && prefersDark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    // La couleur de la barre système du téléphone suit le thème
    document.getElementById("meta-theme").setAttribute("content", dark ? "#191512" : "#FAF7F2");
  }

  /* ════ 6. FIREBASE — écouteurs temps réel ════ */

  function listenFirebase() {
    DB.onLists(
      (data) => {
        state.lists = data || {};

        // Première utilisation : on crée une liste par défaut
        if (Object.keys(state.lists).length === 0) {
          createList("Courses", true);
          return;
        }

        // Restaurer la dernière liste consultée sur cet appareil
        const savedId = localStorage.getItem("listo_current_list");
        state.currentListId = (savedId && state.lists[savedId]) ? savedId : Object.keys(state.lists)[0];

        if (!state.dbReady) {
          state.dbReady = true;
          hide("loading-overlay");
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

    DB.onPacks((data) => {
      state.packs = data || {};
      renderPacks();
    });

    DB.onPresence(renderPresence);

    // Pastille de synchro pilotée par l'état réel de la connexion
    DB.onConnected((connected) => setSyncState(connected ? "connected" : "error"));
  }

  function currentList() { return state.lists[state.currentListId] || { name: "", items: {} }; }
  function currentItems() { return Object.values(currentList().items || {}); }

  /* ════ 7. LISTES (créer / renommer / supprimer) ════ */

  function createList(name, isDefault = false) {
    const id = Date.now().toString(36);
    const newList = { id, name, createdAt: Date.now(), items: {} };
    state.lists[id] = newList;
    DB.createList(id, newList);
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
    renderList(); updateHeader(); updateListPickerBtn();
  }

  function deleteList(id) {
    if (Object.keys(state.lists).length <= 1) {
      showToast("Impossible de supprimer la dernière liste", "error");
      return;
    }
    if (!confirm(`Supprimer la liste « ${state.lists[id]?.name} » et tout son contenu ?`)) return;
    DB.deleteList(id);
    delete state.lists[id];
    if (state.currentListId === id) {
      state.currentListId = Object.keys(state.lists)[0];
      localStorage.setItem("listo_current_list", state.currentListId);
    }
    openListPicker(); // re-rendre la modale
    renderList(); updateHeader(); updateListPickerBtn();
  }

  function promptRenameList(id) {
    const list = state.lists[id];
    if (!list) return;
    const name = prompt("Nouveau nom de la liste :", list.name);
    if (!name || !name.trim()) return;
    list.name = name.trim();
    DB.renameList(id, list.name);
    openListPicker();
    updateListPickerBtn(); updateHeader();
  }

  function updateListPickerBtn() {
    document.getElementById("current-list-name").textContent = currentList().name || "Nojolist";
  }

  function openListPicker() {
    const lists = Object.values(state.lists).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    let html = `<div class="modal-title">Mes listes</div>`;

    for (const list of lists) {
      const count = Object.values(list.items || {}).filter(i => !i.done).length;
      const isActive = list.id === state.currentListId;
      html += `<div class="list-picker-item ${isActive ? "active-list" : ""}" data-action="switch-list" data-id="${esc(list.id)}">
        <div class="list-picker-name">${esc(list.name)}</div>
        <div class="list-picker-count">${count} article${count !== 1 ? "s" : ""}</div>
        ${isActive ? '<div class="list-picker-active">✓</div>' : ""}
        <button class="list-picker-icon-btn" data-action="rename-list" data-id="${esc(list.id)}" title="Renommer">✏️</button>
        <button class="list-picker-icon-btn" data-action="delete-list" data-id="${esc(list.id)}" title="Supprimer">✕</button>
      </div>`;
    }

    html += `<div class="new-list-row">
      <input class="form-input" type="text" id="new-list-input" placeholder="Nouvelle liste…" autocomplete="off">
      <button class="btn-teal" data-action="create-list">Créer</button>
    </div>`;

    openModal(html);
    const inp = document.getElementById("new-list-input");
    inp?.addEventListener("keydown", e => { if (e.key === "Enter") submitNewList(); });
  }

  function submitNewList() {
    const inp = document.getElementById("new-list-input");
    const name = inp ? inp.value.trim() : "";
    if (!name) return;
    createList(name);
    closeModal();
    showToast(`Liste « ${name} » créée ✓`, "success");
  }

  /* ════ NAVIGATION & EN-TÊTE ════ */

  function switchScreen(name) {
    state.currentScreen = name;
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    document.querySelector(`[data-screen="${name}"]`).classList.add("active");
    if (name === "history") renderHistory();
    updateHeader();
  }

  function updateHeader() {
    const items = currentItems();
    const todo = items.filter(i => !i.done).length;
    const done = items.filter(i => i.done).length;
    const sub = document.getElementById("header-subtitle");

    if (state.currentScreen === "list") {
      sub.textContent = items.length === 0 ? "Liste vide" : `${todo} à acheter · ${done} dans le caddie`;
    } else if (state.currentScreen === "add") {
      sub.textContent = "Ajouter un article";
    } else {
      sub.textContent = "Courses précédentes";
    }

    // Petit compteur rouge sur l'onglet "Liste"
    const navCount = document.getElementById("nav-count");
    navCount.textContent = todo;
    navCount.classList.toggle("visible", todo > 0);
  }

  /* ════ 8. RENDU DE LA LISTE ════ */

  function renderList() {
    const container = document.getElementById("list-content");
    let items = currentItems();

    // Filtre de recherche (insensible aux accents)
    if (state.searchQuery) {
      const q = norm(state.searchQuery);
      items = items.filter(i => norm(i.name).includes(q) || norm(i.note || "").includes(q));
    }

    const todo = items.filter(i => !i.done);
    const done = items.filter(i => i.done);

    document.getElementById("finish-bar").style.display =
      currentItems().some(i => i.done) ? "block" : "none";

    updateProgress();

    if (items.length === 0) {
      container.innerHTML = state.searchQuery
        ? `<div class="empty-state"><div class="icon">🔍</div><p>Aucun article ne correspond à «&nbsp;${esc(state.searchQuery)}&nbsp;».</p></div>`
        : `<div class="empty-state"><div class="icon">🛒</div><p>Liste vide !<br>Ajoute des articles via l'onglet Ajouter.</p></div>`;
      return;
    }

    let html = "";

    if (todo.length > 0) {
      // Regroupement par rayon, dans l'ordre du magasin
      const cats = [...new Set(todo.map(i => i.category))]
        .sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
      html += `<div class="section-label">À acheter · ${todo.length}</div>`;
      for (const cat of cats) {
        html += `<div class="section-sublabel">${CAT_ICONS[cat] || "📦"} ${esc(cat)}</div>`;
        html += `<div class="item-list">${todo.filter(i => i.category === cat).map(renderItem).join("")}</div>`;
      }
    }

    if (done.length > 0) {
      html += `<div class="section-label" style="margin-top:8px;">Dans le caddie · ${done.length}</div>`;
      html += `<div class="item-list">${done.map(renderItem).join("")}</div>`;
    }

    container.innerHTML = html;
  }

  function renderItem(item) {
    // NOTE : tout texte venant de l'utilisateur passe par esc()
    // pour éviter qu'un nom contenant des caractères spéciaux
    // (<, ", '…) ne casse l'affichage ou n'injecte du code.
    return `<div class="item-card ${item.done ? "done" : ""}" id="item-${esc(item.id)}">
      <button class="check-btn ${item.done ? "checked" : ""}" data-action="toggle" data-id="${esc(item.id)}" aria-label="Cocher"></button>
      <div class="item-info" data-action="edit" data-id="${esc(item.id)}">
        <div class="item-name">${esc(item.emoji)} ${esc(item.name)}</div>
        ${item.note ? `<div class="item-note">💬 ${esc(item.note)}</div>` : ""}
        <div class="item-meta">${esc(item.category)}</div>
      </div>
      <div class="item-right">
        <div class="qty-ctrl">
          <button class="qty-btn" data-action="qty" data-id="${esc(item.id)}" data-delta="-1">−</button>
          <span class="qty-val">${fmtQty(item)}</span>
          <button class="qty-btn" data-action="qty" data-id="${esc(item.id)}" data-delta="1">+</button>
        </div>
        <div class="who-badge who-${esc(item.addedBy)}">${esc(item.addedBy)}</div>
        <div class="item-actions">
          <button class="action-btn edit" data-action="edit" data-id="${esc(item.id)}">✏️</button>
          <button class="action-btn del" data-action="delete" data-id="${esc(item.id)}">×</button>
        </div>
      </div>
    </div>`;
  }

  // Affichage de la quantité : "x2", "500 g", "1,5 kg"…
  function fmtQty(item) {
    const unit = item.unit || "x";
    const qty = item.qty ?? 1;
    const n = Number(qty).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    if (unit === "x") return qty === 1 ? "1" : `x${n}`;
    if (unit === "pack") return `${n} pk`;
    return `${n} ${unit}`;
  }

  // Barre de progression du Mode Courses
  function updateProgress() {
    if (!state.shopping) return;
    const items = currentItems();
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("progress-label").textContent =
      items.length ? `${done}/${items.length} · ${pct}%` : "";
  }

  /* ════ FAVORIS (articles fréquents) ════ */

  function renderFavorites() {
    const bar = document.getElementById("favorites-bar");
    const sorted = Object.values(state.favorites)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    volatile.favShown = sorted; // mémorisés pour le clic (par index)

    if (sorted.length === 0) { bar.classList.remove("visible"); return; }

    bar.classList.add("visible");
    bar.innerHTML = `<div class="fav-label">⭐ Fréquents</div>
      <div class="fav-chips">${sorted.map((f, i) =>
        `<div class="fav-chip" data-action="add-fav" data-idx="${i}">${esc(f.emoji)} ${esc(f.name)}</div>`
      ).join("")}</div>`;
  }

  function updateFavorites(name, emoji, category) {
    const key = norm(name).replace(/\s+/g, "_").replace(/[.#$/\[\]]/g, ""); // caractères interdits par Firebase
    if (!key) return;
    const existing = state.favorites[key] || { name, emoji, category, count: 0 };
    existing.count += 1;
    state.favorites[key] = existing;
    DB.setFavorite(key, existing);
  }

  /* ════ AUTOCOMPLÉTION ════ */

  function renderAutocomplete(query) {
    const list = document.getElementById("autocomplete-list");
    if (!query || query.length < 2) { list.classList.remove("visible"); return; }

    const q = norm(query);
    const candidates = new Map();

    // 1) Favoris  2) Historique — sans doublons
    Object.values(state.favorites).forEach(f => {
      if (norm(f.name).includes(q)) candidates.set(f.name.toLowerCase(), f);
    });
    state.history.forEach(session => {
      (session.items || []).forEach(item => {
        if (norm(item.name).includes(q) && !candidates.has(item.name.toLowerCase())) {
          candidates.set(item.name.toLowerCase(), { name: item.name, emoji: item.emoji, category: item.category, count: 0 });
        }
      });
    });

    const results = [...candidates.values()].slice(0, 5);
    volatile.acResults = results;

    if (results.length === 0) { list.classList.remove("visible"); return; }

    list.innerHTML = results.map((r, i) =>
      `<div class="ac-item" data-action="ac-select" data-idx="${i}">
        <span class="ac-emoji">${esc(r.emoji)}</span>
        <span class="ac-name">${esc(r.name)}</span>
        <span class="ac-cat">${esc(r.category)}</span>
      </div>`).join("");
    list.classList.add("visible");
  }

  /* ════ 9. AJOUT D'ARTICLES ════ */

  function quickAdd() {
    const input = document.getElementById("quick-input");
    const val = input.value.trim();
    if (!val) { showToast("Saisis un nom d'article", "error"); return; }
    input.value = "";
    document.getElementById("autocomplete-list").classList.remove("visible");
    addItem({ name: val, emoji: getEmoji(val), category: guessCategory(val), qty: 1, unit: "x", note: "" });
  }

  function addAdvanced() {
    const name = document.getElementById("adv-name").value.trim();
    if (!name) { showToast("Saisis un nom d'article", "error"); return; }
    addItem({
      name,
      emoji: getEmoji(name),
      category: document.getElementById("adv-category").value,
      qty: parseFloat(document.getElementById("adv-qty").value) || 1,
      unit: document.getElementById("adv-unit").value,
      note: document.getElementById("adv-note").value.trim(),
    });
    document.getElementById("adv-name").value = "";
    document.getElementById("adv-note").value = "";
    document.getElementById("adv-qty").value = "1";
    document.getElementById("adv-unit").value = "x";
  }

  function addItem({ name, emoji, category, qty, unit, note }, options = {}) {
    if (!state.user) { showToast("Choisis ton profil d'abord", "error"); return; }
    if (!state.currentListId) return;

    const list = state.lists[state.currentListId];
    if (!list) return;
    if (!list.items) list.items = {};

    // Anti-doublon : si l'article existe déjà (non coché), on
    // augmente sa quantité au lieu de créer une seconde ligne.
    const existing = Object.values(list.items).find(
      i => i.name.toLowerCase() === name.toLowerCase() && !i.done,
    );
    if (existing) {
      existing.qty = (existing.qty || 1) + (qty || 1);
      DB.updateItem(state.currentListId, existing.id, { qty: existing.qty });
      if (!options.silent) showToast(`Quantité de ${existing.name} augmentée`, "success");
      renderList(); updateHeader();
      return;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const item = {
      id, name,
      emoji: emoji || getEmoji(name),
      category: category || "Épicerie",
      qty: qty || 1,
      unit: unit || "x",
      note: note || "",
      done: false,
      addedBy: state.user.initial,
      addedAt: Date.now(),
    };

    list.items[id] = item;            // mise à jour locale immédiate…
    DB.setItem(state.currentListId, id, item); // …puis envoi à Firebase (granulaire)

    updateFavorites(item.name, item.emoji, item.category);
    renderList(); renderFavorites(); updateHeader();

    if (!options.silent) {
      showToast(`${name} ajouté ✓`, "success");
      switchScreen("list");
    }
  }

  /* ════ 10. PACKS (kits réutilisables) ════ */

  function renderPacks() {
    const bar = document.getElementById("packs-bar");
    const packs = Object.values(state.packs);
    if (packs.length === 0) {
      bar.innerHTML = `<div class="packs-empty">Sauvegarde des kits d'articles (ex. «&nbsp;Raclette&nbsp;») pour les rajouter en un geste.</div>`;
      return;
    }
    bar.innerHTML = packs.map(p =>
      `<div class="pack-chip" data-action="add-pack" data-id="${esc(p.id)}">
        ${esc(p.emoji || "📦")} ${esc(p.name)}
        <span class="pack-count">${(p.items || []).length}</span>
        <button class="pack-del" data-action="delete-pack" data-id="${esc(p.id)}" title="Supprimer le pack">×</button>
      </div>`).join("");
  }

  // Crée un pack à partir des articles NON COCHÉS de la liste actuelle
  function openPackCreator() {
    const items = currentItems().filter(i => !i.done);
    if (items.length === 0) {
      showToast("Ajoute d'abord des articles à ta liste", "error");
      return;
    }
    const preview = items.slice(0, 6).map(i => `${i.emoji} ${esc(i.name)}`).join(" · ")
      + (items.length > 6 ? ` · +${items.length - 6}` : "");

    openModal(`
      <div class="modal-title">📦 Créer un pack</div>
      <p style="font-size:13px;color:var(--text3);line-height:1.5;margin-bottom:14px;">
        Les <b>${items.length} articles à acheter</b> de ta liste actuelle seront enregistrés
        comme un kit réutilisable :<br><span style="font-size:12px;">${preview}</span>
      </p>
      <div class="edit-row">
        <div class="edit-label">Nom du pack</div>
        <input class="edit-input" type="text" id="pack-name" placeholder="Ex: Raclette, Petit-déj, Apéro…" autocomplete="off">
      </div>
      <button class="btn-save" data-action="save-pack">Enregistrer le pack</button>
    `);
    setTimeout(() => document.getElementById("pack-name")?.focus(), 250);
  }

  function savePack() {
    const name = document.getElementById("pack-name")?.value.trim();
    if (!name) { showToast("Donne un nom au pack", "error"); return; }
    const items = currentItems().filter(i => !i.done)
      .map(i => ({ name: i.name, emoji: i.emoji, category: i.category, qty: i.qty || 1, unit: i.unit || "x", note: i.note || "" }));

    const id = Date.now().toString(36);
    const pack = { id, name, emoji: getEmoji(name), items, createdAt: Date.now() };
    state.packs[id] = pack;
    DB.setPack(id, pack);
    closeModal();
    renderPacks();
    showToast(`Pack « ${name} » enregistré ✓`, "success");
  }

  function addPack(id) {
    const pack = state.packs[id];
    if (!pack) return;
    (pack.items || []).forEach(i => addItem({ ...i }, { silent: true }));
    showToast(`${pack.items.length} articles du pack « ${pack.name} » ajoutés ✓`, "success");
    switchScreen("list");
  }

  function deletePack(id) {
    const pack = state.packs[id];
    if (!pack || !confirm(`Supprimer le pack « ${pack.name} » ?`)) return;
    delete state.packs[id];
    DB.removePack(id);
    renderPacks();
  }

  /* ════ 11. ACTIONS SUR UN ARTICLE ════ */

  function toggleItem(id) {
    const list = state.lists[state.currentListId];
    if (!list?.items?.[id]) return;
    list.items[id].done = !list.items[id].done;
    DB.updateItem(state.currentListId, id, { done: list.items[id].done });
    if (list.items[id].done) vibrate(15); // petit retour haptique (Android)
    renderList(); updateHeader();
  }

  function changeQty(id, delta) {
    const list = state.lists[state.currentListId];
    if (!list?.items?.[id]) return;
    const item = list.items[id];
    const step = UNIT_STEPS[item.unit || "x"] || 1;
    // Arrondi pour éviter les flottants type 0.30000000004
    const next = Math.round((Number(item.qty || 1) + delta * step) * 100) / 100;
    item.qty = Math.max(step === 1 ? 1 : step, next);
    DB.updateItem(state.currentListId, id, { qty: item.qty });
    renderList();
  }

  // Suppression AVEC possibilité d'annuler (toast 5 s)
  function deleteItem(id) {
    const list = state.lists[state.currentListId];
    if (!list?.items?.[id]) return;
    const removed = { ...list.items[id] };

    delete list.items[id];
    DB.removeItem(state.currentListId, id);
    renderList(); updateHeader();

    volatile.undo = { type: "delete-item", item: removed, listId: state.currentListId };
    showToast(`${removed.name} supprimé`, "", { label: "Annuler", onAction: undoLast });
  }

  function undoLast() {
    const u = volatile.undo;
    if (!u) return;
    volatile.undo = null;

    if (u.type === "delete-item") {
      const list = state.lists[u.listId];
      if (!list) return;
      if (!list.items) list.items = {};
      list.items[u.item.id] = u.item;
      DB.setItem(u.listId, u.item.id, u.item);
      showToast(`${u.item.name} restauré ✓`, "success");
    }

    if (u.type === "finish") {
      // On restaure les articles cochés et on retire la session d'historique
      const list = state.lists[u.listId];
      if (!list) return;
      list.items = u.itemsSnapshot;
      DB.setItems(u.listId, u.itemsSnapshot);
      DB.removeHistorySession(u.sessionId);
      showToast("Courses restaurées ✓", "success");
    }

    renderList(); updateHeader();
  }

  /* ════ ÉDITION D'ARTICLE (modale) ════ */

  function openEditItem(id) {
    const item = state.lists[state.currentListId]?.items?.[id];
    if (!item) return;

    const catOptions = CAT_ORDER
      .map(c => `<option value="${c}" ${c === item.category ? "selected" : ""}>${CAT_ICONS[c]} ${c}</option>`)
      .join("");
    const unitOptions = Object.keys(UNIT_STEPS)
      .map(u => `<option value="${u}" ${u === (item.unit || "x") ? "selected" : ""}>${u}</option>`)
      .join("");

    openModal(`
      <div class="modal-title">Modifier l'article</div>
      <div class="edit-row">
        <div class="edit-label">Nom</div>
        <input class="edit-input" type="text" id="edit-name" value="${esc(item.name)}" autocomplete="off">
      </div>
      <div class="edit-row">
        <div class="edit-label">Commentaire</div>
        <input class="edit-input" type="text" id="edit-note" value="${esc(item.note || "")}" placeholder="Ex: prendre le bio…" autocomplete="off">
      </div>
      <div class="edit-row">
        <div class="edit-label">Rayon</div>
        <select class="edit-input" id="edit-category">${catOptions}</select>
      </div>
      <div class="two-col">
        <div class="edit-row">
          <div class="edit-label">Quantité</div>
          <input class="edit-input" type="number" id="edit-qty" value="${item.qty}" min="0" step="any" inputmode="decimal">
        </div>
        <div class="edit-row">
          <div class="edit-label">Unité</div>
          <select class="edit-input" id="edit-unit">${unitOptions}</select>
        </div>
      </div>
      <button class="btn-save" data-action="save-edit" data-id="${esc(id)}">Enregistrer</button>
    `);
  }

  function saveEditItem(id) {
    const item = state.lists[state.currentListId]?.items?.[id];
    if (!item) return;
    const name = document.getElementById("edit-name").value.trim();
    if (!name) return;

    item.name = name;
    item.note = document.getElementById("edit-note").value.trim();
    item.category = document.getElementById("edit-category").value;
    item.qty = parseFloat(document.getElementById("edit-qty").value) || 1;
    item.unit = document.getElementById("edit-unit").value;
    item.emoji = getEmoji(name);

    DB.updateItem(state.currentListId, id, {
      name: item.name, note: item.note, category: item.category,
      qty: item.qty, unit: item.unit, emoji: item.emoji,
    });
    closeModal();
    renderList();
    showToast("Article modifié ✓", "success");
  }

  /* ════ 12. TERMINER LES COURSES ════ */

  function finishShopping() {
    const list = state.lists[state.currentListId];
    if (!list) return;
    const items = Object.values(list.items || {});
    const done = items.filter(i => i.done);
    const remaining = items.filter(i => !i.done);
    if (done.length === 0) return;

    // Snapshot AVANT modification → permet l'annulation
    const snapshot = { ...(list.items || {}) };

    const session = {
      id: Date.now().toString(36),
      date: Date.now(),
      listName: list.name,
      finishedBy: state.user?.initial || "",
      items: done,
    };

    // Les non-cochés restent dans la liste, les cochés partent en historique
    const newItems = {};
    remaining.forEach(i => { newItems[i.id] = { ...i, done: false }; });
    list.items = newItems;

    DB.setItems(state.currentListId, newItems);
    DB.addHistorySession(session.id, session);

    if (state.shopping) toggleShoppingMode(); // on sort du Mode Courses

    renderList(); updateHeader();

    volatile.undo = { type: "finish", listId: state.currentListId, itemsSnapshot: snapshot, sessionId: session.id };
    showToast(`${done.length} article${done.length > 1 ? "s" : ""} archivé${done.length > 1 ? "s" : ""} ✓`, "success",
      { label: "Annuler", onAction: undoLast });
  }

  /* ════ 13. HISTORIQUE & STATS ════ */

  function renderHistory() {
    renderStats();
    const container = document.getElementById("history-content");

    if (state.history.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Aucune course archivée.</p></div>`;
      return;
    }

    let html = "";
    for (const session of state.history) {
      const date = new Date(session.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      const count = (session.items || []).length;
      html += `<div class="history-session">
        <div class="history-session-header">
          <div>
            <div class="history-session-date">${date}</div>
            <div class="history-session-count">${esc(session.listName || "")} · ${count} article${count !== 1 ? "s" : ""}</div>
          </div>
          <div class="history-session-actions">
            <button class="btn-recreate" data-action="recreate" data-id="${esc(session.id)}">🔁 Recréer</button>
            <button class="history-del-session" data-action="delete-session" data-id="${esc(session.id)}" title="Supprimer">✕</button>
          </div>
        </div>
        <div class="item-list">`;
      (session.items || []).forEach((item, idx) => {
        html += `<div class="history-item" data-action="add-from-history" data-sid="${esc(session.id)}" data-idx="${idx}">
          <div class="history-item-info">
            <div class="history-item-name">${esc(item.emoji)} ${esc(item.name)}</div>
            <div class="history-item-meta">${esc(item.category)}${item.qty > 1 ? ` · ${fmtQty(item)}` : ""}</div>
          </div>
          <div class="history-item-add">+</div>
        </div>`;
      });
      html += `</div></div>`;
    }
    container.innerHTML = html;
  }

  // 3 chiffres clés au-dessus de l'historique
  function renderStats() {
    const bar = document.getElementById("stats-bar");
    const sessions = state.history.length;
    const totalItems = state.history.reduce((sum, s) => sum + (s.items || []).length, 0);
    const top = Object.values(state.favorites).sort((a, b) => b.count - a.count)[0];

    if (sessions === 0) { bar.innerHTML = ""; return; }

    bar.innerHTML = `
      <div class="stat-card"><div class="stat-num">${sessions}</div><div class="stat-lbl">courses</div></div>
      <div class="stat-card"><div class="stat-num">${totalItems}</div><div class="stat-lbl">articles achetés</div></div>
      <div class="stat-card"><div class="stat-num">${top ? esc(top.emoji) : "—"}</div><div class="stat-lbl">${top ? esc(top.name) : "top article"}</div></div>`;
  }

  function addFromHistory(sessionId, idx) {
    const session = state.history.find(s => s.id === sessionId);
    const item = session?.items?.[idx];
    if (!item) return;
    addItem({ name: item.name, emoji: item.emoji, category: item.category, qty: item.qty || 1, unit: item.unit || "x", note: item.note || "" });
  }

  function recreateList(sessionId) {
    const session = state.history.find(s => s.id === sessionId);
    if (!session) return;
    (session.items || []).forEach(i =>
      addItem({ name: i.name, emoji: i.emoji, category: i.category, qty: i.qty || 1, unit: i.unit || "x", note: i.note || "" }, { silent: true }));
    showToast(`${session.items.length} articles ajoutés ✓`, "success");
    switchScreen("list");
  }

  function deleteSession(sessionId) {
    if (!confirm("Supprimer cette course de l'historique ?")) return;
    DB.removeHistorySession(sessionId);
    // (le listener onHistory re-rendra automatiquement)
  }

  /* ════ 14. PARTAGE DE LA LISTE ════ */

  async function shareList() {
    const items = currentItems().filter(i => !i.done);
    if (items.length === 0) { showToast("Rien à partager : liste vide", "error"); return; }

    // On génère un texte propre, groupé par rayon
    const cats = [...new Set(items.map(i => i.category))]
      .sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
    let text = `🛒 ${currentList().name} — Nojolist\n`;
    for (const cat of cats) {
      text += `\n${CAT_ICONS[cat] || "📦"} ${cat}\n`;
      items.filter(i => i.category === cat).forEach(i => {
        text += `  • ${i.name}${(i.qty > 1 || (i.unit && i.unit !== "x")) ? ` (${fmtQty(i)})` : ""}${i.note ? ` — ${i.note}` : ""}\n`;
      });
    }

    closeModal();
    // API native de partage (mobile) → sinon copie dans le presse-papier
    if (navigator.share) {
      try { await navigator.share({ title: "Nojolist", text }); } catch (e) { /* partage annulé */ }
    } else {
      await navigator.clipboard.writeText(text);
      showToast("Liste copiée dans le presse-papier ✓", "success");
    }
  }

  /* ════ RÉGLAGES ════ */

  function openSettings() {
    const themeBtns = [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]]
      .map(([v, l]) => `<button class="seg-btn ${state.theme === v ? "active" : ""}" data-action="set-theme" data-theme="${v}">${l}</button>`)
      .join("");

    openModal(`
      <div class="modal-title">Réglages</div>
      <div class="set-row">
        <div><div class="set-label">Profil</div><div class="set-sub">Connecté en tant que ${esc(state.user?.name || "?")}</div></div>
        <button class="btn-link" data-action="switch-user">Changer</button>
      </div>
      <div class="set-row">
        <div><div class="set-label">Thème</div><div class="set-sub">Auto suit le réglage du téléphone</div></div>
        <div class="seg">${themeBtns}</div>
      </div>
      <div class="set-row">
        <div><div class="set-label">Partager la liste</div><div class="set-sub">Envoyer la liste en texte (SMS, WhatsApp…)</div></div>
        <button class="btn-link" data-action="share-list">Partager</button>
      </div>
      <div class="set-version">Nojolist v${APP_VERSION} · Fait avec ❤️ pour J & N</div>
    `);
  }

  function switchUser() {
    localStorage.removeItem("listo_user");
    state.user = null;
    closeModal();
    document.getElementById("onboarding-overlay").classList.remove("hidden");
  }

  /* ════ 15. MODALES & TOAST ════ */

  function openModal(html) {
    if (html !== undefined) document.getElementById("modal-content").innerHTML = html;
    document.getElementById("modal-overlay").classList.add("open");
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.remove("open");
  }

  function setSyncState(s) {
    document.getElementById("sync-dot").className = "sync-dot " + s;
  }

  // Toast amélioré : peut afficher un bouton d'action ("Annuler").
  let toastTimer;
  function showToast(msg, type = "", action = null) {
    const t = document.getElementById("toast");
    document.getElementById("toast-msg").textContent = msg;

    const btn = document.getElementById("toast-action");
    btn.className = action ? "visible" : "";
    if (action) {
      btn.textContent = action.label;
      btn.onclick = () => { t.className = ""; action.onAction(); };
    }

    t.className = "show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ""; }, action ? 5000 : 2500);
  }

  /* ════ 16. MODE COURSES ════ */

  function toggleShoppingMode() {
    state.shopping = !state.shopping;
    document.body.classList.toggle("shopping", state.shopping);
    document.getElementById("shop-mode-btn").textContent =
      state.shopping ? "✕ Quitter" : "🛒 Mode courses";

    if (state.shopping) {
      requestWakeLock(); // l'écran ne s'éteint plus
      switchScreen("list");
      showToast("Mode courses : l'écran reste allumé 💡", "success");
    } else {
      releaseWakeLock();
    }
    renderList();
  }

  // Wake Lock = API qui empêche l'écran de s'éteindre.
  // Supportée sur Chrome Android et Safari iOS 16.4+.
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        volatile.wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch (e) { /* batterie faible ou non supporté : pas grave */ }
  }

  function releaseWakeLock() {
    volatile.wakeLock?.release().catch(() => {});
    volatile.wakeLock = null;
  }

  // Si on change d'app puis on revient, le verrou est perdu → on le reprend
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.shopping) requestWakeLock();
  });

  // Vibration courte (Android uniquement ; sans effet sur iPhone)
  function vibrate(ms) { navigator.vibrate?.(ms); }

  /* ════ 17. MISE À JOUR DE L'APP (Service Worker) ════
     Quand tu pousses une nouvelle version sur GitHub Pages, le
     navigateur télécharge le nouveau sw.js en arrière-plan. On
     détecte ce moment et on propose de recharger. */

  function watchForUpdates(registration) {
    volatile.swRegistration = registration;

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener("statechange", () => {
        // "installed" + un SW déjà actif = une mise à jour attend
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showToast("Nouvelle version disponible", "success",
            { label: "Mettre à jour", onAction: applyUpdate });
        }
      });
    });

    // Quand le nouveau SW prend la main → on recharge la page
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
  }

  function applyUpdate() {
    volatile.swRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }

  /* ════ OUTILS ════ */

  // Échappe les caractères spéciaux HTML (sécurité de l'affichage)
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Normalise un texte : minuscules, sans accents (pour comparer)
  function norm(str) {
    return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function hide(id) { document.getElementById(id).classList.add("hidden"); }

  /* ════ ÉVÉNEMENTS ════
     DÉLÉGATION : au lieu de mettre onclick="…" sur chaque élément
     généré (fragile avec les apostrophes des noms d'articles), on
     écoute les clics au niveau du document et on lit l'attribut
     data-action de l'élément cliqué. Une seule écoute, zéro bug
     d'échappement. */

  const ACTIONS = {
    "toggle":           el => toggleItem(el.dataset.id),
    "qty":              el => changeQty(el.dataset.id, parseInt(el.dataset.delta)),
    "delete":           el => deleteItem(el.dataset.id),
    "edit":             el => { if (!state.shopping) openEditItem(el.dataset.id); },
    "save-edit":        el => saveEditItem(el.dataset.id),
    "add-fav":          el => { const f = volatile.favShown[el.dataset.idx]; if (f) addItem({ name: f.name, emoji: f.emoji, category: f.category, qty: 1, unit: "x", note: "" }); },
    "ac-select":        el => { const r = volatile.acResults[el.dataset.idx]; if (r) { document.getElementById("quick-input").value = ""; document.getElementById("autocomplete-list").classList.remove("visible"); addItem({ name: r.name, emoji: r.emoji, category: r.category, qty: 1, unit: "x", note: "" }); } },
    "switch-list":      el => switchList(el.dataset.id),
    "rename-list":      el => promptRenameList(el.dataset.id),
    "delete-list":      el => deleteList(el.dataset.id),
    "create-list":      () => submitNewList(),
    "add-pack":         el => addPack(el.dataset.id),
    "delete-pack":      el => deletePack(el.dataset.id),
    "save-pack":        () => savePack(),
    "recreate":         el => recreateList(el.dataset.id),
    "delete-session":   el => deleteSession(el.dataset.id),
    "add-from-history": el => addFromHistory(el.dataset.sid, parseInt(el.dataset.idx)),
    "set-theme":        el => setTheme(el.dataset.theme),
    "switch-user":      () => switchUser(),
    "share-list":       () => shareList(),
  };

  function bindEvents() {
    // Délégation globale des clics
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      e.stopPropagation();
      ACTIONS[el.dataset.action]?.(el);
    });

    // Fermer la modale en cliquant sur le fond sombre
    // (e.target === l'overlay lui-même → on a cliqué À CÔTÉ de la modale, pas dedans)
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") closeModal();
    });

    // Champs de saisie
    document.getElementById("quick-input").addEventListener("keydown", e => { if (e.key === "Enter") quickAdd(); });
    document.getElementById("quick-input").addEventListener("input", e => renderAutocomplete(e.target.value));
    document.getElementById("adv-name").addEventListener("keydown", e => { if (e.key === "Enter") addAdvanced(); });
    document.getElementById("search-input").addEventListener("input", e => {
      state.searchQuery = e.target.value.trim();
      renderList();
    });
  }

  /* ════ API PUBLIQUE ════
     Seules ces fonctions sont accessibles depuis le HTML
     (onclick="App.xxx()"). Tout le reste est privé. */
  return {
    init,
    setUser,
    switchScreen,
    openListPicker,
    openSettings,
    openPackCreator,
    quickAdd,
    addAdvanced,
    finishShopping,
    toggleShoppingMode,
    closeModal,
    showToast,
    watchForUpdates,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
