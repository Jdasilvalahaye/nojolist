# Listo 🛒

Liste de courses partagée — Jonathan & Noémie.

## Structure

```
listo/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── firebase.js   — config Firebase
│   ├── emojis.js     — emojis & catégories
│   └── app.js        — logique principale
└── README.md
```

## Fonctionnalités

- Listes multiples (créer / supprimer librement)
- Ajout rapide avec autocomplétion (historique + favoris)
- Favoris automatiques basés sur la fréquence
- Quantité ajustable +/− directement sur chaque article
- Commentaire par article
- Édition après ajout
- Terminer les courses : cochés archivés, non-cochés conservés
- Historique avec réajout par article ou recréation complète
- Sync temps réel Firebase (J & N voient la même liste)
- Badge J / N sur chaque article
