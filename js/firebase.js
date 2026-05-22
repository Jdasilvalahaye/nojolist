// ── FIREBASE CONFIG ──
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
  listRef: db.ref('list'),
  historyRef: db.ref('history'),

  onList(cb, errCb) {
    this.listRef.on('value', snap => cb(snap.val()), errCb);
  },

  onHistory(cb) {
    this.historyRef.on('value', snap => cb(snap.val()));
  },

  setList(obj) {
    return this.listRef.set(obj && Object.keys(obj).length > 0 ? obj : null);
  },

  setHistory(obj) {
    return this.historyRef.set(obj && Object.keys(obj).length > 0 ? obj : null);
  }
};
