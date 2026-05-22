const EMOJIS = {
  'lait':'🥛','fromage':'🧀','oeuf':'🥚','beurre':'🧈','yaourt':'🍶',
  'creme':'🥛','mozzarella':'🧀','camembert':'🧀','viande':'🥩',
  'boeuf':'🥩','veau':'🥩','porc':'🥩','agneau':'🥩','poulet':'🍗',
  'dinde':'🍗','canard':'🍗','poisson':'🐟','saumon':'🐟','thon':'🐟',
  'sardine':'🐟','crevette':'🦐','jambon':'🥓','lardons':'🥓','saucisse':'🌭',
  'pates':'🍝','pasta':'🍝','riz':'🍚','farine':'🌾','pain':'🍞',
  'baguette':'🥖','brioche':'🥐','biscottes':'🍞','cereales':'🥣',
  'granola':'🥣','muesli':'🥣','avoine':'🥣','semoule':'🍚',
  'quinoa':'🍚','lentilles':'🍲','pomme':'🍎','banane':'🍌',
  'orange':'🍊','citron':'🍋','fraise':'🍓','raisin':'🍇','poire':'🍐',
  'peche':'🍑','mangue':'🥭','ananas':'🍍','melon':'🍈','tomate':'🍅',
  'carotte':'🥕','brocoli':'🥦','salade':'🥗','courgette':'🥒',
  'concombre':'🥒','poivron':'🫑','oignon':'🧅','ail':'🧄',
  'pomme de terre':'🥔','epinard':'🥬','chou':'🥬','champignon':'🍄',
  'avocat':'🥑','mais':'🌽','sauce':'🥫','conserve':'🥫','soupe':'🥣',
  'haricot':'🥫','ketchup':'🍅','mayonnaise':'🫙','moutarde':'🫙',
  'huile':'🫙','vinaigre':'🫙','eau':'💧','jus':'🥤','soda':'🥤',
  'limonade':'🥤','sirop':'🍹','cafe':'☕','the':'🍵','infusion':'🍵',
  'vin':'🍷','biere':'🍺','champagne':'🍾','cidre':'🍺','chips':'🍟',
  'crackers':'🍘','biscuit':'🍪','cookie':'🍪','gateau':'🎂','cake':'🎂',
  'chocolat':'🍫','bonbon':'🍬','caramel':'🍮','confiture':'🍓',
  'miel':'🍯','nutella':'🍫','glace':'🍦','sorbet':'🍧','compote':'🍎',
  'surgele':'❄️','pizza':'🍕','lasagne':'🍝','sel':'🧂','sucre':'🧂',
  'poivre':'🌶️','curry':'🌶️','herbes':'🌿','basilic':'🌿',
  'dentifrice':'🦷','shampooing':'🧴','douche':'🧴','savon':'🧼',
  'deodorant':'🧴','lessive':'🧺','vaisselle':'🧽','nettoyant':'🧹',
  'essuie':'🧻','toilette':'🚽','couche':'👶','lingette':'🧻',
  'bebe':'👶','biberon':'🍼','maternise':'🍼',
};

function getEmoji(name) {
  if (!name) return '🛒';
  const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, emoji] of Object.entries(EMOJIS)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normKey)) return emoji;
  }
  return '🛒';
}

function guessCategory(name) {
  const l = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/lait|yaourt|fromage|beurre|creme|oeuf|viande|poisson|jambon|charcuterie/.test(l)) return 'Frais';
  if (/surgele|glace|sorbet/.test(l)) return 'Surgelés';
  if (/pain|baguette|brioche|viennoiserie/.test(l)) return 'Boulangerie';
  if (/bebe|couche|biberon|maternise/.test(l)) return 'Bébé';
  if (/shampooing|douche|savon|dentifrice|deodorant|lessive|vaisselle|nettoyant|essuie|toilette|lingette/.test(l)) return 'Hygiène';
  if (/eau|jus|soda|vin|biere|sirop|limonade|champagne|cidre/.test(l)) return 'Boissons';
  return 'Épicerie';
}
