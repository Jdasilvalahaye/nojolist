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

const DB = {
  // Listes
  listsRef: () => db.ref('lists'),
  listRef: (id) => db.ref(`lists/${id}`),
  itemsRef: (listId) => db.ref(`lists/${listId}/items`),

  // Historique (global, partagé)
  historyRef: () => db.ref('history'),

  // Favoris (global, basé sur fréquence)
  favoritesRef: () => db.ref('favorites'),

  onLists(cb, errCb) {
    this.listsRef().on('value', snap => cb(snap.val()), errCb);
  },

  onHistory(cb) {
    this.historyRef().on('value', snap => cb(snap.val()));
  },

  onFavorites(cb) {
    this.favoritesRef().on('value', snap => cb(snap.val()));
  },

  setList(listId, data) {
    return this.listRef(listId).set(data);
  },

  setHistory(obj) {
    return this.historyRef().set(obj && Object.keys(obj).length > 0 ? obj : null);
  },

  setFavorites(obj) {
    return this.favoritesRef().set(obj && Object.keys(obj).length > 0 ? obj : null);
  },

  deleteList(listId) {
    return this.listRef(listId).remove();
  }
};
