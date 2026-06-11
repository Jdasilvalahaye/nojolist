# Nojolist v2 🛒

Liste de courses partagée — Jonathan & Noémie.

PWA (Progressive Web App) hébergée sur **GitHub Pages**, données synchronisées en temps réel via **Firebase Realtime Database**. Fonctionne sur iPhone (Noémie) et Android (Jonathan), installable comme une vraie app depuis le navigateur.

---

## 🆕 Nouveautés de la v2

| Fonctionnalité | Description |
|---|---|
| 🛒 **Mode Courses** | Pensé pour le magasin : l'écran ne s'éteint plus (Wake Lock), grosses cases à cocher, barre de progression, vibration au check (Android), édition désactivée pour éviter les fausses manips. |
| 📦 **Packs** | Sauvegarde ta liste actuelle comme un kit réutilisable ("Raclette", "Petit-déj"…) et rajoute tous ses articles en un tap. |
| ↩️ **Annuler** | Après une suppression d'article ou un "Terminer les courses", un bouton *Annuler* apparaît 5 secondes dans le toast. |
| 🌙 **Mode sombre** | Auto (suit le téléphone), clair ou sombre — dans Réglages (avatar en haut à droite). |
| 👀 **Présence** | Une pastille apparaît dans l'en-tête quand l'autre est en ligne. |
| 🔍 **Recherche** | Filtre la liste en direct, insensible aux accents. |
| ⚖️ **Unités** | Quantités en x, g, kg, L, cL ou pack — les boutons +/− s'adaptent (ex. +100 g, +0,5 kg). |
| 📤 **Partage** | Envoie la liste en texte propre (groupée par rayon) via SMS/WhatsApp, ou copie presse-papier sur PC. |
| 📊 **Stats** | En haut de l'historique : nombre de courses, total d'articles, article le plus acheté. |
| 🔄 **Mise à jour auto** | Quand tu déploies une nouvelle version, l'app propose "Mettre à jour" au lieu de rester bloquée sur l'ancienne. |
| 🔢 **Badge onglet** | Le nombre d'articles à acheter s'affiche sur l'onglet Liste. |
| ⚡ **Raccourcis d'icône** | Appui long sur l'icône de l'app → "Ajouter un article" ou "Historique". |

### Améliorations invisibles mais importantes

- **Écritures Firebase granulaires** : avant, chaque modification réécrivait *toute* la liste — si vous modifiiez en même temps, le dernier écrasait l'autre. Désormais chaque article a son propre chemin (`lists/{id}/items/{itemId}`) et on n'écrit que ce qui change. Modifications simultanées sans conflit. ✅
- **Sécurité de l'affichage** : tous les textes saisis passent par une fonction d'échappement (`esc()`). Un article nommé `Confiture d'abricot <bio>` ne casse plus rien.
- **Délégation d'événements** : fini les `onclick` avec du JSON encodé dans le HTML ; les clics sont gérés proprement via des attributs `data-action`.
- **Pastille de synchro fiable** : branchée sur `.info/connected` de Firebase (l'état réel de la connexion).
- **Rétrocompatibilité totale** : vos données existantes (listes, historique, favoris) fonctionnent telles quelles. Les articles sans unité sont traités comme `x`.

---

## 📁 Structure du projet

```
nojolist/
├── index.html        ← structure de la page (écrans, modale, nav)
├── manifest.json     ← identité PWA (nom, icônes, raccourcis)
├── sw.js             ← Service Worker (hors-ligne + mises à jour)
├── css/
│   └── style.css     ← tout le style (thèmes clair/sombre en variables)
├── js/
│   ├── firebase.js   ← COUCHE DE DONNÉES (seul fichier qui parle à Firebase)
│   ├── emojis.js     ← dictionnaires : emoji et rayon devinés depuis le nom
│   └── app.js        ← LOGIQUE (état, rendu, actions)
└── icons/            ← icônes de l'app
```

## 🧠 Comment ça marche (l'architecture en 1 minute)

Le principe central : **Action → State → Render**.

1. **`state`** (dans `app.js`) contient tout : listes, historique, favoris, utilisateur, écran courant…
2. Firebase pousse les changements en temps réel → on met à jour `state` → on appelle `renderList()`, `renderHistory()`… qui redessinent l'écran *à partir de* `state`.
3. Quand tu agis (cocher un article), on modifie `state` localement (réactivité instantanée) **puis** on envoie le changement à Firebase, qui le propage à l'autre téléphone, dont l'écran se met à jour tout seul.

`firebase.js` est une **couche d'abstraction** : `app.js` ne connaît que des fonctions comme `DB.updateItem(…)`. Pour changer de base de données un jour (Firestore, Supabase…), tu ne toucherais que ce fichier.

### Modèle de données Firebase

```
{
  lists: {
    <listId>: {
      id, name, createdAt,
      items: {
        <itemId>: { id, name, emoji, category, qty, unit, note,
                    done, addedBy ("J"|"N"), addedAt }
      }
    }
  },
  history:   { <sessionId>: { id, date, listName, finishedBy, items: [...] } },
  favorites: { <cléNormalisée>: { name, emoji, category, count } },
  packs:     { <packId>: { id, name, emoji, items: [...], createdAt } },
  presence:  { J: { online, lastSeen }, N: { online, lastSeen } }
}
```

---

## 🚀 Déployer

1. Remplace le contenu de ton dépôt GitHub par ces fichiers (en gardant le dossier `nojolist/` si ton site est servi sous `/nojolist/`).
2. **Incrémente la version du cache** dans `sw.js` (ligne `const CACHE = "nojolist-v4"` → `v5`, `v6`…). C'est ce qui déclenche la proposition de mise à jour sur vos téléphones.
3. Commit + push → GitHub Pages publie automatiquement.
4. À l'ouverture suivante, l'app affichera *"Nouvelle version disponible → Mettre à jour"*.

> ⚠️ Si ton dépôt est servi à la **racine** (pas sous `/nojolist/`), remplace tous les chemins `/nojolist/` par `/` dans `sw.js`, `manifest.json` et l'enregistrement du Service Worker dans `index.html`.

---

## 🛠️ Guide des modifications courantes

**Ajouter un rayon** (ex. "Jardin") :
1. `app.js` → ajoute `"Jardin"` dans `CAT_ORDER` (à la position voulue dans le parcours magasin) et `Jardin: "🌱"` dans `CAT_ICONS`.
2. `index.html` → ajoute `<option value="Jardin">🌱 Jardin</option>` dans le `<select id="adv-category">`.
3. (Optionnel) `emojis.js` → enrichis `guessCategory()` pour le deviner automatiquement.

**Ajouter une unité** (ex. "boîte") : `app.js` → ajoute `boîte: 1` dans `UNIT_STEPS`, et l'option dans le `<select id="adv-unit">` d'`index.html`.

**Changer les couleurs / le thème** : tout est dans la section 1 de `css/style.css` (variables `--teal`, `--bg`…). Le mode sombre redéfinit les mêmes variables sous `[data-theme="dark"]`.

**Ajouter un produit au dictionnaire d'emojis** : `emojis.js` → ajoute une ligne `"mon produit": "🥑",` dans l'objet `EMOJIS`.

**Changer le nombre de favoris affichés** : `app.js` → `renderFavorites()` → `.slice(0, 8)`.

---

## 🔐 Sécurité Firebase (important)

La `apiKey` dans `firebase.js` n'est **pas un secret** (c'est un identifiant public côté web). La vraie protection, ce sont les **règles** de la Realtime Database. Aujourd'hui, si elles sont en lecture/écriture libres, n'importe qui connaissant l'URL de la base pourrait y écrire.

Recommandation minimale, dans la console Firebase → Realtime Database → Règles :

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

…ce qui nécessite d'activer l'**authentification anonyme** (Console Firebase → Authentication → Sign-in method → Anonyme) puis d'ajouter dans `firebase.js`, après `firebase.initializeApp(...)` :

```js
// nécessite d'ajouter le script firebase-auth-compat.js dans index.html
firebase.auth().signInAnonymously();
```

C'est une bonne étape v2.1 : elle bloque les curieux sans rien changer pour vous. (Pour une vraie app publique sur les stores, il faudrait des comptes utilisateurs et des règles par foyer — voir roadmap.)

---

## 📱 Roadmap : passer en "vraie app" sur les stores

Le code est prêt pour ça. Trois chemins, du plus simple au plus complet :

1. **PWABuilder** (Microsoft, gratuit) — *pwabuilder.com* : tu lui donnes l'URL de la PWA, il génère un package Android (TWA) publiable sur le Play Store quasi sans code. Nécessite un compte développeur Google (25 $ une fois). Côté Apple, le résultat est plus limité.
2. **Capacitor** (Ionic) — encapsule ton code web tel quel dans une app native iOS + Android, avec accès aux API natives (notifications push, widgets…). C'est le chemin recommandé si l'app décolle. Ton architecture s'y prête déjà : pas de framework imposé, `firebase.js` isolé, chemins relatifs faciles à adapter.
3. **Réécriture native / React Native** — uniquement si besoins très avancés.

Préparations déjà faites dans cette v2 : `manifest.json` complet (id, raccourcis, maskable icons), couche de données isolée, thème sombre, safe-areas iPhone, gestion des mises à jour.

Idées de fonctionnalités futures : notifications push ("Noémie a ajouté 3 articles"), budget/prix par article, mode invité pour un 3ᵉ membre, drag & drop pour réordonner les rayons, scan de code-barres.

---

## 📖 Glossaire express

- **PWA** : site web installable qui se comporte comme une app (icône, plein écran, hors-ligne).
- **Service Worker** : script qui tourne en arrière-plan, intercepte le réseau, gère le cache et les mises à jour.
- **Realtime Database** : base Firebase = un gros objet JSON synchronisé en temps réel entre tous les appareils connectés.
- **Wake Lock** : API qui empêche l'écran de s'éteindre (utilisée par le Mode Courses).
- **Délégation d'événements** : écouter les clics sur un parent plutôt que sur chaque enfant — plus simple et plus robuste pour du contenu généré dynamiquement.
- **state → render** : l'écran est toujours redessiné à partir des données ; on ne "bricole" jamais le HTML à la main après coup.
