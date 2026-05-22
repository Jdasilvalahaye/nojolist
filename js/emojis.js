// ── EMOJIS ──
const EMOJIS = {
  // Produits laitiers
  'lait': '🥛', 'fromage': '🧀', 'oeuf': '🥚', 'beurre': '🧈',
  'yaourt': '🍶', 'creme': '🥛', 'mozzarella': '🧀', 'camembert': '🧀',
  // Viandes & poissons
  'viande': '🥩', 'boeuf': '🥩', 'veau': '🥩', 'porc': '🥩',
  'agneau': '🥩', 'poulet': '🍗', 'dinde': '🍗', 'canard': '🍗',
  'poisson': '🐟', 'saumon': '🐟', 'thon': '🐟', 'sardine': '🐟',
  'crevette': '🦐', 'jambon': '🥓', 'lardons': '🥓', 'saucisse': '🌭',
  // Féculents & céréales
  'pates': '🍝', 'pasta': '🍝', 'riz': '🍚', 'farine': '🌾',
  'pain': '🍞', 'baguette': '🥖', 'brioche': '🥐', 'biscottes': '🍞',
  'cereales': '🥣', 'granola': '🥣', 'muesli': '🥣', 'avoine': '🥣',
  'semoule': '🍚', 'quinoa': '🍚', 'lentilles': '🍲',
  // Fruits & légumes
  'pomme': '🍎', 'banane': '🍌', 'orange': '🍊', 'citron': '🍋',
  'fraise': '🍓', 'raisin': '🍇', 'poire': '🍐', 'peche': '🍑',
  'mangue': '🥭', 'ananas': '🍍', 'melon': '🍈', 'tomate': '🍅',
  'carotte': '🥕', 'brocoli': '🥦', 'salade': '🥗', 'courgette': '🥒',
  'concombre': '🥒', 'poivron': '🫑', 'oignon': '🧅', 'ail': '🧄',
  'pomme de terre': '🥔', 'epinard': '🥬', 'chou': '🥬',
  'champignon': '🍄', 'avocat': '🥑', 'mais': '🌽',
  // Conserves & sauces
  'sauce': '🥫', 'conserve': '🥫', 'soupe': '🥣', 'haricot': '🥫',
  'ketchup': '🍅', 'mayonnaise': '🫙', 'moutarde': '🫙',
  'huile': '🫙', 'vinaigre': '🫙',
  // Boissons
  'eau': '💧', 'jus': '🥤', 'soda': '🥤', 'limonade': '🥤',
  'sirop': '🍹', 'cafe': '☕', 'the': '🍵', 'infusion': '🍵',
  'vin': '🍷', 'biere': '🍺', 'champagne': '🍾', 'cidre': '🍺',
  // Snacks & sucreries
  'chips': '🍟', 'crackers': '🍘', 'biscuit': '🍪', 'cookie': '🍪',
  'gateau': '🎂', 'cake': '🎂', 'chocolat': '🍫', 'bonbon': '🍬',
  'caramel': '🍮', 'confiture': '🍓', 'miel': '🍯', 'nutella': '🍫',
  'glace': '🍦', 'sorbet': '🍧', 'compote': '🍎',
  // Surgelés
  'surgele': '❄️', 'pizza': '🍕', 'lasagne': '🍝',
  // Condiments & épices
  'sel': '🧂', 'sucre': '🧂', 'poivre': '🌶️', 'curry': '🌶️',
  'herbes': '🌿', 'basilic': '🌿',
  // Hygiène & entretien
  'dentifrice': '🦷', 'shampooing': '🧴', 'douche': '🧴',
  'savon': '🧼', 'deodorant': '🧴', 'lessive': '🧺',
  'vaisselle': '🧽', 'nettoyant': '🧹', 'essuie': '🧻',
  'toilette': '🚽', 'couche': '👶', 'lingette': '🧻',
  // Bébé
  'bebe': '👶', 'biberon': '🍼', 'maternise': '🍼',
};

function getEmoji(name) {
  if (!name) return '🛒';
  // Normalise: minuscules, retire accents
  const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, emoji] of Object.entries(EMOJIS)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normKey)) return emoji;
  }
  return '🛒';
}
