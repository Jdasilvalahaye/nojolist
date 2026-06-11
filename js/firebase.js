/* ============================================================
   NOJOLIST — firebase.js
   ------------------------------------------------------------
   COUCHE DE DONNÉES (la seule qui parle à Firebase).

   Pourquoi isoler Firebase ici ?
   → Le reste de l'app (app.js) ne connaît que les fonctions
     DB.xxx(). Si un jour tu veux changer de base de données
     (Firestore, Supabase…) ou passer au SDK Firebase "modulaire"
     pour une vraie app sur les stores, tu ne modifies QUE ce
     fichier. C'est ce qu'on appelle une "couche d'abstraction".

   GRAND CHANGEMENT vs v1 :
   → Avant, on réécrivait TOUTE la liste à chaque modification
     (DB.setList). Si Jonathan et Noémie modifiaient en même
     temps, le dernier écrasait l'autre.
   → Maintenant, chaque article a son propre chemin dans la base
     (lists/abc/items/xyz) et on n'écrit QUE ce qui change.
     Deux personnes peuvent donc modifier la liste simultanément
     sans jamais se marcher dessus.
   ============================================================ */

// ── Configuration de TON projet Firebase ──
// (la clé "apiKey" n'est pas un secret : côté web Firebase, c'est
//  un identifiant public. La vraie sécurité = les RÈGLES de la
//  base, voir le README section "Sécurité".)
const firebaseConfig = {
  apiKey: "AIzaSyDsuWLg8hMaj8Dkq3-kycUVmVJvLfBTlSE",
  authDomain: "nojolist.firebaseapp.com",
  databaseURL: "https://nojolist-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nojolist",
  storageBucket: "nojolist.firebasestorage.app",
  messagingSenderId: "655476142859",
  appId: "1:655476142859:web:5f55b115288e3eff4ce80e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ------------------------------------------------------------
   STRUCTURE DE LA BASE (Realtime Database = un gros objet JSON)

   {
     lists: {
       <listId>: { id, name, createdAt, items: { <itemId>: {...} } }
     },
     history:   { <sessionId>: { id, date, listName, items: [...] } },
     favorites: { <cléNormalisée>: { name, emoji, category, count } },
     packs:     { <packId>: { id, name, emoji, items: [...] } },
     presence:  { J: { online, lastSeen }, N: { online, lastSeen } }
   }
   ------------------------------------------------------------ */

const DB = {
  /* ══════════ ÉCOUTEURS (temps réel) ══════════
     .on('value', …) = Firebase nous rappelle à CHAQUE changement,
     même fait par l'autre téléphone. C'est ça, la synchro. */

  onLists(cb, errCb)   { db.ref("lists").on("value", s => cb(s.val()), errCb); },
  onHistory(cb)        { db.ref("history").on("value", s => cb(s.val())); },
  onFavorites(cb)      { db.ref("favorites").on("value", s => cb(s.val())); },
  onPacks(cb)          { db.ref("packs").on("value", s => cb(s.val())); },
  onPresence(cb)       { db.ref("presence").on("value", s => cb(s.val())); },

  // .info/connected = chemin spécial Firebase qui dit si CE client
  // est connecté au serveur (pratique pour la pastille de synchro).
  onConnected(cb)      { db.ref(".info/connected").on("value", s => cb(s.val() === true)); },

  /* ══════════ LISTES ══════════ */

  createList(id, data)      { return db.ref(`lists/${id}`).set(data); },
  renameList(id, name)      { return db.ref(`lists/${id}/name`).set(name); },
  deleteList(id)            { return db.ref(`lists/${id}`).remove(); },

  /* ══════════ ARTICLES — écritures granulaires ══════════
     C'est ici que la magie anti-conflit opère : on ne touche
     qu'au chemin précis de l'article concerné. */

  setItem(listId, itemId, item)     { return db.ref(`lists/${listId}/items/${itemId}`).set(item); },
  updateItem(listId, itemId, patch) { return db.ref(`lists/${listId}/items/${itemId}`).update(patch); },
  removeItem(listId, itemId)        { return db.ref(`lists/${listId}/items/${itemId}`).remove(); },

  // Remplace d'un coup TOUS les articles d'une liste (utilisé
  // uniquement pour "Terminer les courses" et son annulation).
  setItems(listId, itemsObj)        { return db.ref(`lists/${listId}/items`).set(itemsObj || null); },

  /* ══════════ HISTORIQUE ══════════ */

  addHistorySession(id, session)    { return db.ref(`history/${id}`).set(session); },
  removeHistorySession(id)          { return db.ref(`history/${id}`).remove(); },

  /* ══════════ FAVORIS (fréquence d'achat) ══════════ */

  setFavorite(key, fav)             { return db.ref(`favorites/${key}`).set(fav); },

  /* ══════════ PACKS (kits réutilisables) ══════════ */

  setPack(id, pack)                 { return db.ref(`packs/${id}`).set(pack); },
  removePack(id)                    { return db.ref(`packs/${id}`).remove(); },

  /* ══════════ PRÉSENCE ══════════
     Signale "je suis en ligne" et, grâce à onDisconnect(),
     Firebase écrit automatiquement "hors ligne" côté serveur
     quand l'app se ferme ou perd le réseau. */

  setupPresence(initial) {
    const ref = db.ref(`presence/${initial}`);
    db.ref(".info/connected").on("value", snap => {
      if (snap.val() !== true) return;
      // Programmé côté serveur : s'exécutera même si le tel s'éteint
      ref.onDisconnect().update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
      ref.update({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    });
  },
};
