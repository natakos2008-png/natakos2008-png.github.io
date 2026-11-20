// Справочник продуктов, аллергенов и ограничений.
// Формат продукта: id: [название, эмодзи, категория, 'аллергены через запятую', 'флаги через запятую']
// Флаги: meat (мясо), pork (свинина), poultry (птица), fish, seafood, animal (животное, не мясо: яйца/мёд), alcohol
window.DB = window.DB || {};

DB.allergens = {
  milk:     { n: 'Молоко и лактоза', e: '🥛' },
  gluten:   { n: 'Глютен',           e: '🌾' },
  egg:      { n: 'Яйца',             e: '🥚' },
  nuts:     { n: 'Орехи',            e: '🌰' },
  peanut:   { n: 'Арахис',           e: '🥜' },
  fish:     { n: 'Рыба',             e: '🐟' },
  shellfish:{ n: 'Морепродукты',     e: '🦐' },
  soy:      { n: 'Соя',              e: '🫘' },
  sesame:   { n: 'Кунжут',           e: '⚪' },
  citrus:   { n: 'Цитрусы',          e: '🍋' },
  honey:    { n: 'Мёд',              e: '🍯' },
};

// Принципы питания: какие флаги/аллергены они запрещают
DB.principles = {
  vegetarian:  { n: 'Вегетарианство',   e: '🥗', banFlags: ['meat', 'pork', 'poultry', 'fish', 'seafood'] },
  vegan:       { n: 'Веганство',        e: '🌱', banFlags: ['meat', 'pork', 'poultry', 'fish', 'seafood', 'animal'], banAllergens: ['milk', 'egg', 'honey'] },
  pescatarian: { n: 'Без мяса (рыбу можно)', e: '🐟', banFlags: ['meat', 'pork', 'poultry'] },
  no_pork:     { n: 'Без свинины',      e: '🐖', banFlags: ['pork'] },
  no_alcohol:  { n: 'Без алкоголя',     e: '🚫', banFlags: ['alcohol'] },
  no_seafood:  { n: 'Без морепродуктов', e: '🦑', banFlags: ['seafood'] },
};

DB.categories = [
  ['veg',    'Овощи и зелень',     '🥕'],
  ['fruit',  'Фрукты и ягоды',     '🍎'],
  ['meat',   'Мясо и птица',       '🥩'],
  ['fish',   'Рыба и морепродукты','🐟'],
  ['dairy',  'Молочное и яйца',    '🥚'],
  ['grain',  'Крупы, паста, бобовые','🍚'],
  ['bakery', 'Хлеб и тесто',       '🍞'],
  ['sauce',  'Соусы и консервы',   '🥫'],
  ['sweet',  'Сладкое и для выпечки','🍫'],
  ['nuts',   'Орехи и семена',     '🌰'],
  ['drink',  'Напитки',            '☕'],
  ['base',   'Базовое (всегда есть)','🧂'],
];

DB.products = {
  // Овощи и зелень
  tomato:        ['Помидоры', '🍅', 'veg'],
  cherry_tomato: ['Черри', '🍅', 'veg'],
  cucumber:      ['Огурцы', '🥒', 'veg'],
  onion:         ['Лук репчатый', '🧅', 'veg'],
  red_onion:     ['Лук красный', '🧅', 'veg'],
  green_onion:   ['Зелёный лук', '🌱', 'veg'],
  garlic:        ['Чеснок', '🧄', 'veg'],
  carrot:        ['Морковь', '🥕', 'veg'],
  potato:        ['Картофель', '🥔', 'veg'],
  sweet_potato:  ['Батат', '🍠', 'veg'],
  bell_pepper:   ['Болгарский перец', '🫑', 'veg'],
  chili:         ['Острый перец', '🌶️', 'veg'],
  zucchini:      ['Кабачок', '🥒', 'veg'],
  eggplant:      ['Баклажан', '🍆', 'veg'],
  cabbage:       ['Капуста', '🥬', 'veg'],
  chinese_cabbage:['Пекинская капуста', '🥬', 'veg'],
  cauliflower:   ['Цветная капуста', '🥦', 'veg'],
  broccoli:      ['Брокколи', '🥦', 'veg'],
  green_beans:   ['Стручковая фасоль', '🫛', 'veg'],
  peas:          ['Зелёный горошек', '🫛', 'veg'],
  corn:          ['Кукуруза', '🌽', 'veg'],
  mushrooms:     ['Грибы', '🍄', 'veg'],
  spinach:       ['Шпинат', '🥬', 'veg'],
  lettuce:       ['Листья салата', '🥬', 'veg'],
  arugula:       ['Руккола', '🌿', 'veg'],
  avocado:       ['Авокадо', '🥑', 'veg'],
  beet:          ['Свёкла', '🟣', 'veg'],
  pumpkin:       ['Тыква', '🎃', 'veg'],
  radish:        ['Редис', '🔴', 'veg'],
  celery:        ['Сельдерей', '🥬', 'veg'],
  ginger:        ['Имбирь', '🫚', 'veg'],
  greens:        ['Укроп / петрушка', '🌿', 'veg'],
  cilantro:      ['Кинза', '🌿', 'veg'],
  basil:         ['Базилик', '🌿', 'veg'],
  mint:          ['Мята', '🌱', 'veg'],
  pickles:       ['Солёные огурцы', '🥒', 'veg'],
  sauerkraut:    ['Квашеная капуста', '🥬', 'veg'],

  // Фрукты и ягоды
  lemon:      ['Лимон', '🍋', 'fruit', 'citrus'],
  lime:       ['Лайм', '🍋', 'fruit', 'citrus'],
  orange:     ['Апельсин', '🍊', 'fruit', 'citrus'],
  apple:      ['Яблоки', '🍎', 'fruit'],
  pear:       ['Груша', '🍐', 'fruit'],
  banana:     ['Бананы', '🍌', 'fruit'],
  berries:    ['Ягоды', '🫐', 'fruit'],
  strawberry: ['Клубника', '🍓', 'fruit'],
  cherry:     ['Вишня', '🍒', 'fruit'],
  mango:      ['Манго', '🥭', 'fruit'],
  pineapple:  ['Ананас', '🍍', 'fruit'],
  kiwi:       ['Киви', '🥝', 'fruit'],
  peach:      ['Персики', '🍑', 'fruit'],
  pomegranate:['Гранат', '🔴', 'fruit'],
  raisins:    ['Изюм', '🍇', 'fruit'],
  dried_fruit:['Курага / чернослив', '🟠', 'fruit'],
  coconut:    ['Кокосовая стружка', '🥥', 'fruit'],

  // Мясо и птица
  chicken:      ['Куриное филе', '🍗', 'meat', '', 'poultry'],
  chicken_thigh:['Куриные бёдра / ножки', '🍗', 'meat', '', 'poultry'],
  whole_chicken:['Курица целиком', '🐔', 'meat', '', 'poultry'],
  turkey:       ['Индейка', '🦃', 'meat', '', 'poultry'],
  duck:         ['Утка', '🦆', 'meat', '', 'poultry'],
  beef:         ['Говядина', '🥩', 'meat', '', 'meat'],
  pork:         ['Свинина', '🥩', 'meat', '', 'meat,pork'],
  lamb:         ['Баранина', '🍖', 'meat', '', 'meat'],
  minced_beef:  ['Фарш говяжий', '🥩', 'meat', '', 'meat'],
  minced_mix:   ['Фарш свино-говяжий', '🥩', 'meat', '', 'meat,pork'],
  minced_chicken:['Фарш куриный', '🍗', 'meat', '', 'poultry'],
  bacon:        ['Бекон', '🥓', 'meat', '', 'meat,pork'],
  ham:          ['Ветчина', '🍖', 'meat', '', 'meat,pork'],
  sausages:     ['Сосиски', '🌭', 'meat', '', 'meat,pork'],
  salami:       ['Колбаса / салями', '🍕', 'meat', '', 'meat,pork'],

  // Рыба и морепродукты
  salmon:     ['Лосось / сёмга', '🐟', 'fish', 'fish', 'fish'],
  salted_salmon:['Слабосолёный лосось', '🐟', 'fish', 'fish', 'fish'],
  white_fish: ['Белая рыба (треска, минтай)', '🐟', 'fish', 'fish', 'fish'],
  tuna_can:   ['Тунец консервированный', '🥫', 'fish', 'fish', 'fish'],
  herring:    ['Сельдь', '🐟', 'fish', 'fish', 'fish'],
  shrimp:     ['Креветки', '🦐', 'fish', 'shellfish', 'seafood'],
  squid:      ['Кальмары', '🦑', 'fish', 'shellfish', 'seafood'],
  mussels:    ['Мидии', '🦪', 'fish', 'shellfish', 'seafood'],
  crab_sticks:['Крабовые палочки', '🦀', 'fish', 'fish,egg', 'fish'],

  // Молочное и яйца
  eggs:        ['Яйца', '🥚', 'dairy', 'egg', 'animal'],
  milk:        ['Молоко', '🥛', 'dairy', 'milk', 'animal'],
  kefir:       ['Кефир', '🥛', 'dairy', 'milk', 'animal'],
  butter:      ['Сливочное масло', '🧈', 'dairy', 'milk', 'animal'],
  cheese:      ['Сыр твёрдый', '🧀', 'dairy', 'milk', 'animal'],
  mozzarella:  ['Моцарелла', '🧀', 'dairy', 'milk', 'animal'],
  feta:        ['Фета / брынза', '🧀', 'dairy', 'milk', 'animal'],
  suluguni:    ['Сулугуни', '🧀', 'dairy', 'milk', 'animal'],
  parmesan:    ['Пармезан', '🧀', 'dairy', 'milk', 'animal'],
  cream_cheese:['Сливочный сыр', '🧀', 'dairy', 'milk', 'animal'],
  mascarpone:  ['Маскарпоне', '🧀', 'dairy', 'milk', 'animal'],
  cottage:     ['Творог', '🥣', 'dairy', 'milk', 'animal'],
  sour_cream:  ['Сметана', '🥣', 'dairy', 'milk', 'animal'],
  cream:       ['Сливки', '🥛', 'dairy', 'milk', 'animal'],
  yogurt:      ['Йогурт натуральный', '🥣', 'dairy', 'milk', 'animal'],
  plant_milk:  ['Растительное молоко', '🥛', 'dairy'],
  tofu:        ['Тофу', '⬜', 'dairy', 'soy'],

  // Крупы, паста, бобовые
  pasta:       ['Макароны / паста', '🍝', 'grain', 'gluten'],
  spaghetti:   ['Спагетти', '🍝', 'grain', 'gluten'],
  noodles:     ['Пшеничная лапша', '🍜', 'grain', 'gluten,egg'],
  rice_noodles:['Рисовая лапша', '🍜', 'grain'],
  rice:        ['Рис', '🍚', 'grain'],
  round_rice:  ['Рис круглый (для суши/ризотто)', '🍙', 'grain'],
  buckwheat:   ['Гречка', '🟤', 'grain'],
  oats:        ['Овсяные хлопья', '🥣', 'grain', 'gluten'],
  bulgur:      ['Булгур', '🌾', 'grain', 'gluten'],
  couscous:    ['Кускус', '🌾', 'grain', 'gluten'],
  quinoa:      ['Киноа', '🌾', 'grain'],
  semolina:    ['Манка', '🌾', 'grain', 'gluten'],
  millet:      ['Пшено', '🟡', 'grain'],
  lentils:     ['Чечевица', '🟠', 'grain'],
  chickpeas:   ['Нут', '🟡', 'grain'],
  beans:       ['Фасоль консервированная', '🫘', 'grain'],
  flour:       ['Мука пшеничная', '🌾', 'grain', 'gluten'],

  // Хлеб и тесто
  bread:       ['Хлеб / батон', '🍞', 'bakery', 'gluten'],
  baguette:    ['Багет / чиабатта', '🥖', 'bakery', 'gluten'],
  tortilla:    ['Лаваш / тортилья', '🌯', 'bakery', 'gluten'],
  pita:        ['Пита', '🫓', 'bakery', 'gluten'],
  puff_pastry: ['Слоёное тесто', '🥐', 'bakery', 'gluten,milk'],
  cookies:     ['Печенье', '🍪', 'bakery', 'gluten,milk,egg'],
  savoiardi:   ['Савоярди', '🍪', 'bakery', 'gluten,egg'],
  nori:        ['Нори', '🟩', 'bakery'],
  rice_paper:  ['Рисовая бумага', '⚪', 'bakery'],

  // Соусы и консервы
  tomato_paste:   ['Томатная паста', '🥫', 'sauce'],
  canned_tomatoes:['Томаты в собственном соку', '🥫', 'sauce'],
  soy_sauce:      ['Соевый соус', '🍶', 'sauce', 'soy,gluten'],
  fish_sauce:     ['Рыбный соус', '🍶', 'sauce', 'fish', 'fish'],
  mayo:           ['Майонез', '🫙', 'sauce', 'egg', 'animal'],
  mustard:        ['Горчица', '🟡', 'sauce'],
  ketchup:        ['Кетчуп', '🥫', 'sauce'],
  pesto:          ['Песто', '🌿', 'sauce', 'nuts,milk', 'animal'],
  curry_paste:    ['Паста карри', '🍛', 'sauce'],
  coconut_milk:   ['Кокосовое молоко', '🥥', 'sauce'],
  olives:         ['Оливки / маслины', '🫒', 'sauce'],
  capers:         ['Каперсы', '🟢', 'sauce'],
  tahini:         ['Тахини', '🫙', 'sauce', 'sesame'],
  adjika:         ['Аджика', '🌶️', 'sauce'],
  sesame_oil:     ['Кунжутное масло', '🫗', 'sauce', 'sesame'],
  rice_vinegar:   ['Рисовый уксус', '🍶', 'sauce'],
  wasabi:         ['Васаби', '🟢', 'sauce'],
  kimchi:         ['Кимчи', '🥬', 'sauce', 'fish', 'fish'],
  salsa:          ['Сальса', '🥫', 'sauce'],

  // Сладкое
  sugar:        ['Сахар', '🍬', 'base'],
  honey:        ['Мёд', '🍯', 'sweet', 'honey', 'animal'],
  chocolate:    ['Шоколад', '🍫', 'sweet', 'milk'],
  cocoa:        ['Какао-порошок', '🟫', 'sweet'],
  condensed_milk:['Сгущёнка', '🥫', 'sweet', 'milk', 'animal'],
  jam:          ['Варенье / джем', '🍓', 'sweet'],
  vanilla:      ['Ванильный сахар', '🍦', 'sweet'],
  baking_powder:['Разрыхлитель', '🧪', 'sweet'],
  gelatin:      ['Желатин', '🟨', 'sweet', '', 'animal'],
  ice_cream:    ['Мороженое', '🍨', 'sweet', 'milk,egg', 'animal'],
  starch:       ['Крахмал', '⚪', 'sweet'],
  maple_syrup:  ['Кленовый сироп', '🍁', 'sweet'],

  // Орехи и семена
  walnuts:   ['Грецкие орехи', '🌰', 'nuts', 'nuts'],
  almonds:   ['Миндаль', '🌰', 'nuts', 'nuts'],
  hazelnuts: ['Фундук', '🌰', 'nuts', 'nuts'],
  cashew:    ['Кешью', '🌰', 'nuts', 'nuts'],
  peanuts:   ['Арахис', '🥜', 'nuts', 'peanut'],
  peanut_butter:['Арахисовая паста', '🥜', 'nuts', 'peanut'],
  sesame:    ['Кунжут', '⚪', 'nuts', 'sesame'],
  seeds:     ['Семечки (тыквенные, подсолнечные)', '🌻', 'nuts'],

  // Напитки
  coffee:      ['Кофе', '☕', 'drink'],
  tea:         ['Чай чёрный', '🫖', 'drink'],
  green_tea:   ['Чай зелёный', '🍵', 'drink'],
  juice:       ['Сок', '🧃', 'drink'],
  sparkling_water:['Газированная вода', '💧', 'drink'],
  tonic:       ['Тоник', '🫧', 'drink'],
  wine_red:    ['Красное вино', '🍷', 'drink', '', 'alcohol'],
  wine_white:  ['Белое вино', '🥂', 'drink', '', 'alcohol'],
  sparkling:   ['Игристое вино', '🍾', 'drink', '', 'alcohol'],
  rum:         ['Ром', '🥃', 'drink', '', 'alcohol'],
  gin:         ['Джин', '🍸', 'drink', '', 'alcohol'],
  beer:        ['Пиво', '🍺', 'drink', 'gluten', 'alcohol'],

  // Базовое
  salt:        ['Соль', '🧂', 'base'],
  black_pepper:['Перец чёрный', '⚫', 'base'],
  oil:         ['Растительное масло', '🫗', 'base'],
  olive_oil:   ['Оливковое масло', '🫒', 'base'],
  vinegar:     ['Уксус', '🍶', 'base'],
  spices:      ['Специи (паприка, зира, куркума)', '🌶️', 'base'],
  cinnamon:    ['Корица', '🟤', 'base'],
  bay_leaf:    ['Лавровый лист', '🍃', 'base'],
  herbs_dry:   ['Сушёные травы (орегано, прованские)', '🌿', 'base'],
};

// То, что считается «есть всегда» при первом запуске
DB.defaultStaples = ['salt', 'black_pepper', 'oil', 'sugar', 'spices'];

// Нормализация: превращаем массивы в объекты
(function () {
  const out = {};
  for (const [id, a] of Object.entries(DB.products)) {
    out[id] = {
      id, n: a[0], e: a[1], cat: a[2],
      al: a[3] ? a[3].split(',') : [],
      fl: a[4] ? a[4].split(',') : [],
    };
  }
  DB.products = out;
})();

// Рецепты: каждый файл кухни вызывает R(...)
// R(id, название, кухня, раздел, приёмы, уровень, минуты, техника, острота, ккал, описание, обязательные, необязательные, шаги)
//   раздел: salad | soup | main | dessert | drink
//   приёмы: строка из букв b (завтрак) l (обед) d (ужин)
//   уровень: 1 лёгкое, 2 сбалансированное, 3 вау
//   техника: 'stove,oven' | '' ; oven можно заменить аэрогрилем
//   обязательные: 'eggs:3 шт;chicken|turkey:300 г'  — через | замены
//   шаги: через |
DB.recipes = DB.recipes || [];
window.R = function (id, n, cu, course, meals, tier, time, eq, spice, kcal, desc, req, opt, steps) {
  const parse = (s) => (s ? s.split(';').filter(Boolean).map((x) => {
    const i = x.indexOf(':');
    const ids = (i < 0 ? x : x.slice(0, i)).split('|').map((t) => t.trim());
    return { ids, amt: i < 0 ? '' : x.slice(i + 1).trim() };
  }) : []);
  DB.recipes.push({
    id, n, cu, course, meals, tier, time,
    eq: eq ? eq.split(',') : [], spice, kcal, desc,
    req: parse(req), opt: parse(opt),
    steps: steps ? steps.split('|') : [],
  });
};

DB.cuisines = {
  ru: '🇷🇺 Русская', ua: 'Украинская', ge: 'Грузинская', uz: 'Узбекская', it: 'Итальянская', fr: 'Французская',
  es: 'Испанская', gr: 'Греческая', me: 'Ближневосточная', tr: 'Турецкая', in: 'Индийская', jp: 'Японская',
  cn: 'Китайская', th: 'Тайская', kr: 'Корейская', vn: 'Вьетнамская', mx: 'Мексиканская', us: 'Американская',
  uk: 'Британская', de: 'Немецкая', sc: 'Скандинавская', intl: 'Интернациональная',
};
DB.cuisines.ru = 'Русская';

DB.courses = {
  salad:   { n: 'Салаты и закуски', e: '🥗' },
  soup:    { n: 'Супы',             e: '🍲' },
  main:    { n: 'Основное',         e: '🍽️' },
  dessert: { n: 'Десерты',          e: '🍰' },
  drink:   { n: 'Напитки',          e: '🍷' },
};
DB.meals = { b: 'Завтрак', l: 'Обед', d: 'Ужин' };
DB.tiers = { 1: 'Лёгкое', 2: 'Сбалансированное', 3: 'Вау' };
