/* WardrobeIQ — dashboard */
function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login';
    return Promise.reject('No token');
  }
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, options).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject('Unauthorized');
    }
    return res;
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

document.addEventListener("DOMContentLoaded", () => {
  const { toast, animateCount, bindTilt, observeReveals } = window.WIQ;
  const $ = (id) => document.getElementById(id);

  const wardrobeItemsDiv = $("wardrobeItems");
  const historyDiv = $("historyItems");
  const addItemForm = $("addItemForm");
  const languageSwitcher = $("languageSwitcher");

  const state = { items: [], history: [], category: 'all', search: '', editingId: null };

  /* ---------- User + greeting ---------- */
  try {
    const payload = JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('expired');
    const first = (payload.name || 'there').split(' ')[0];
    $("userName").textContent = first;
    $("avatar").textContent = first.charAt(0).toUpperCase();
    $("avatar").title = payload.email || '';
  } catch {
    localStorage.removeItem('token');
    window.location.replace('/login');
    return;
  }
  const hour = new Date().getHours();
  $("greeting").textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  $("todayDate").textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  $("logoutBtn").addEventListener('click', async () => {
    try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch (err) { console.warn('Logout failed:', err); }
    localStorage.removeItem('token');
    location.href = '/login';
  });

  /* ---------- Language ---------- */
  const LANGS = [
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['hi', 'हिन्दी'],
  ['zh', '中文'],
  ['ar', 'العربية'],
  ['ru', 'Русский'],
  ['pt', 'Português'],
  ['bn', 'বাংলা'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['it', 'Italiano'],
  ['tr', 'Türkçe'],
  ['vi', 'Tiếng Việt'],
  ['nl', 'Nederlands'],
  ['pl', 'Polski'],
  ['sv', 'Svenska'],
  ['no', 'Norsk'],
  ['da', 'Dansk'],
  ['fi', 'Suomi'],
  ['he', 'עברית'],
  ['cs', 'Česky'],
  ['ro', 'Română'],
  ['hu', 'Magyar'],
  ['el', 'Ελληνικά'],
  ['uk', 'Українська'],
  ['th', 'ไทย'],
  ['te', 'తెలుగు'],        // Telugu
  ['kn', 'ಕನ್ನಡ'],         // Kannada
  ['ta', 'தமிழ்'],          // Tamil
  ['ml', 'മലയാളം']          // Malayalam
];

  LANGS.forEach(([code,label])=>{
    const o = document.createElement('option'); o.value = code; o.textContent = label;
    languageSwitcher.appendChild(o);
  });

  // Simple ui text mapping (expand as needed)
  const UI = {
  en: {
    brandName: "WardrobeIQ",
    logoutBtn: "Logout",
    weatherLoading: "Loading weather...",
    wardrobeTitle: "Your Wardrobe",
    loadingWardrobe: "Loading wardrobe...",
    addTitle: "Add New Item",
    itemNamePlaceholder: "Item name",
    categoryPlaceholder: "Category (e.g., jacket, dress)",
    addItemBtn: "Add Item",
    clearBtn: "Clear",
    suggestionsTitle: "AI Outfit Suggestions",
    loadingSuggestions: "Loading suggestions...",
    historyTitle: "Outfit History",
    voiceBtn: "🎤 Voice"
  },

  es: {
    brandName: "WardrobeIQ",
    logoutBtn: "Cerrar sesión",
    weatherLoading: "Cargando clima...",
    wardrobeTitle: "Tu guardarropa",
    loadingWardrobe: "Cargando guardarropa...",
    addTitle: "Agregar prenda",
    itemNamePlaceholder: "Nombre de la prenda",
    categoryPlaceholder: "Categoría (por ejemplo, chaqueta, vestido)",
    addItemBtn: "Agregar prenda",
    clearBtn: "Limpiar",
    suggestionsTitle: "Sugerencias de atuendo",
    loadingSuggestions: "Cargando sugerencias...",
    historyTitle: "Historial de atuendos",
    voiceBtn: "🎤 Voz"
  },

  fr: {
    brandName: "WardrobeIQ",
    logoutBtn: "Se déconnecter",
    weatherLoading: "Chargement météo...",
    wardrobeTitle: "Votre garde-robe",
    loadingWardrobe: "Chargement du garde-robe...",
    addTitle: "Ajouter un article",
    itemNamePlaceholder: "Nom de l'article",
    categoryPlaceholder: "Catégorie (ex : veste, robe)",
    addItemBtn: "Ajouter l'article",
    clearBtn: "Effacer",
    suggestionsTitle: "Suggestions de tenues IA",
    loadingSuggestions: "Chargement des suggestions...",
    historyTitle: "Historique des tenues",
    voiceBtn: "🎤 Voix"
  },

  de: {
    brandName: "WardrobeIQ",
    logoutBtn: "Abmelden",
    weatherLoading: "Wetter wird geladen...",
    wardrobeTitle: "Dein Kleiderschrank",
    loadingWardrobe: "Kleiderschrank wird geladen...",
    addTitle: "Neues Teil hinzufügen",
    itemNamePlaceholder: "Name des Teils",
    categoryPlaceholder: "Kategorie (z.B. Jacke, Kleid)",
    addItemBtn: "Teil hinzufügen",
    clearBtn: "Löschen",
    suggestionsTitle: "KI Outfit Vorschläge",
    loadingSuggestions: "Vorschläge werden geladen...",
    voiceBtn: "🎤 Stimme"
  },

  hi: {
    brandName: "WardrobeIQ",
    logoutBtn: "लॉग आउट",
    weatherLoading: "मौसम लोड हो रहा है...",
    wardrobeTitle: "आपकी अलमारी",
    loadingWardrobe: "अलमारी लोड हो रही है...",
    addTitle: "नया आइटम जोड़ें",
    itemNamePlaceholder: "आइटम का नाम",
    categoryPlaceholder: "श्रेणी (जैसे, जैकेट, ड्रेस)",
    addItemBtn: "आइटम जोड़ें",
    clearBtn: "साफ़ करें",
    suggestionsTitle: "एआई आउटफिट सुझाव",
    loadingSuggestions: "सुझाव लोड हो रहे हैं...",
    voiceBtn: "🎤 आवाज़"
  },

  te: {
    brandName: "WardrobeIQ",
    logoutBtn: "లాగ్ అవుట్",
    weatherLoading: "వాతావరణం లోడ్ అవుతుంది...",
    wardrobeTitle: "మీ అల్మారీ",
    loadingWardrobe: "అల్మారీ లోడ్ అవుతోంది...",
    addTitle: "కొత్త వస్తువు జోడించండి",
    itemNamePlaceholder: "వస్తువు పేరు",
    categoryPlaceholder: "వర్గం (ఉదా: జాకెట్, డ్రెస్)",
    addItemBtn: "వస్తువు జోడించండి",
    clearBtn: "సాఫ్ చేయండి",
    suggestionsTitle: "ఏఐ దుస్తులు సూచనలు",
    loadingSuggestions: "సూచనలు లోడ్ అవుతున్నాయి...",
    voiceBtn: "🎤 వాయిస్"
  },

  kn: {
    brandName: "WardrobeIQ",
    logoutBtn: "ಲಾಗ್ ಔಟ್",
    weatherLoading: "ಹವಾಮಾನ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    wardrobeTitle: "ನಿಮ್ಮ ಅಲ್ಮಾರಿ",
    loadingWardrobe: "ಅಲ್ಮಾರಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    addTitle: "ಹೊಸ ವಸ್ತು ಸೇರಿಸಿ",
    itemNamePlaceholder: "ವಸ್ತು ಹೆಸರು",
    categoryPlaceholder: "ವರ್ಗ (ಉದಾ: ಜಾಕೆಟ್, ಉಡುಪು)",
    addItemBtn: "ವಸ್ತು ಸೇರಿಸಿ",
    clearBtn: "ಸಾಫು ಮಾಡಿ",
    suggestionsTitle: "ಏಐ ಅಟ್ಟire ಸಲಹೆಗಳು",
    loadingSuggestions: "ಸಲಹೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    voiceBtn: "🎤 ಧ್ವನಿ"
  },

  ta: {
    brandName: "WardrobeIQ",
    logoutBtn: "வெளியேறு",
    weatherLoading: "வானிலை ஏற்றப்படுகிறது...",
    wardrobeTitle: "உங்கள் அலமாரி",
    loadingWardrobe: "அலமாரி ஏற்றப்படுகிறது...",
    addTitle: "புதிய பொருள் சேர்க்கவும்",
    itemNamePlaceholder: "பொருள் பெயர்",
    categoryPlaceholder: "வகை (எ.கா., ஜாக்கெட், உடை)",
    addItemBtn: "பொருள் சேர்க்கவும்",
    clearBtn: "தூக்கு",
    suggestionsTitle: "ஏஐ உடை பரிந்துரைகள்",
    loadingSuggestions: "பரிந்துரைகள் ஏற்றப்படுகின்றன...",
    voiceBtn: "🎤 குரல்"
  },

  ml: {
    brandName: "WardrobeIQ",
    logoutBtn: "ലോഗൗട്ട്",
    weatherLoading: "വേനൽപ്പെരുക്കം ലോഡ് ചെയ്യുന്നു...",
    wardrobeTitle: "നിങ്ങളുടെ അലമാരി",
    loadingWardrobe: "അലമാരി ലോഡ് ചെയ്യുന്നു...",
    addTitle: "പുതിയ വസ്തു ചേർക്കുക",
    itemNamePlaceholder: "വസ്തു പേര്",
    categoryPlaceholder: "വിഭാഗം (ഉദാ: ജാക്കറ്റ്, വസ്ത്രം)",
    addItemBtn: "വസ്തു ചേർക്കുക",
    clearBtn: "വെട്ടുക",
    suggestionsTitle: "എ.ഐ വസ്ത്ര നിർദ്ദേശങ്ങൾ",
    loadingSuggestions: "നിർദ്ദേശങ്ങൾ ലോഡ് ചെയ്യുന്നു...",
    voiceBtn: "🎤 ശബ്ദം"
  },

  zh: {
    brandName: "WardrobeIQ",
    logoutBtn: "登出",
    weatherLoading: "正在加载天气...",
    wardrobeTitle: "您的衣橱",
    loadingWardrobe: "正在加载衣橱...",
    addTitle: "添加新物品",
    itemNamePlaceholder: "物品名称",
    categoryPlaceholder: "类别（例如夹克，连衣裙）",
    addItemBtn: "添加物品",
    clearBtn: "清除",
    suggestionsTitle: "AI 穿搭建议",
    loadingSuggestions: "正在加载建议...",
    voiceBtn: "🎤 语音"
  },

  ar: {
    brandName: "WardrobeIQ",
    logoutBtn: "تسجيل خروج",
    weatherLoading: "جارٍ تحميل الطقس...",
    wardrobeTitle: "خزانتك",
    loadingWardrobe: "جارٍ تحميل الخزانة...",
    addTitle: "إضافة عنصر جديد",
    itemNamePlaceholder: "اسم العنصر",
    categoryPlaceholder: "الفئة (مثال: جاكيت، فستان)",
    addItemBtn: "أضف عنصرًا",
    clearBtn: "مسح",
    suggestionsTitle: "اقتراحات الملابس الذكية",
    loadingSuggestions: "جارٍ تحميل الاقتراحات...",
    voiceBtn: "🎤 الصوت"
  },

  ru: {
    brandName: "WardrobeIQ",
    logoutBtn: "Выйти",
    weatherLoading: "Загрузка погоды...",
    wardrobeTitle: "Ваш гардероб",
    loadingWardrobe: "Загрузка гардероба...",
    addTitle: "Добавить новый предмет",
    itemNamePlaceholder: "Название предмета",
    categoryPlaceholder: "Категория (например, куртка, платье)",
    addItemBtn: "Добавить предмет",
    clearBtn: "Очистить",
    suggestionsTitle: "Рекомендации по одежде AI",
    loadingSuggestions: "Загрузка рекомендаций...",
    voiceBtn: "🎤 Голос"
  },

  // add other languages you want here ...
   pt: {
    brandName: "WardrobeIQ",
    logoutBtn: "Sair",
    weatherLoading: "Carregando clima...",
    wardrobeTitle: "Seu Guarda-roupa",
    loadingWardrobe: "Carregando guarda-roupa...",
    addTitle: "Adicionar Novo Item",
    itemNamePlaceholder: "Nome do item",
    categoryPlaceholder: "Categoria (ex: jaqueta, vestido)",
    addItemBtn: "Adicionar Item",
    clearBtn: "Limpar",
    suggestionsTitle: "Sugestões de Roupas AI",
    loadingSuggestions: "Carregando sugestões...",
    voiceBtn: "🎤 Voz"
  },

  bn: {
    brandName: "WardrobeIQ",
    logoutBtn: "লগ আউট",
    weatherLoading: "আবহাওয়া লোড হচ্ছে...",
    wardrobeTitle: "আপনার ওয়ার্ডরোব",
    loadingWardrobe: "ওয়ার্ডরোব লোড হচ্ছে...",
    addTitle: "নতুন আইটেম যোগ করুন",
    itemNamePlaceholder: "আইটেমের নাম",
    categoryPlaceholder: "শ্রেণী (যেমন, জ্যাকেট, পোশাক)",
    addItemBtn: "আইটেম যোগ করুন",
    clearBtn: "মুছে ফেলুন",
    suggestionsTitle: "এআই আউটফিট প্রস্তাবনা",
    loadingSuggestions: "প্রস্তাবনা লোড হচ্ছে...",
    voiceBtn: "🎤 ভয়েস"
  },

  ja: {
    brandName: "WardrobeIQ",
    logoutBtn: "ログアウト",
    weatherLoading: "天気を読み込み中...",
    wardrobeTitle: "あなたのワードローブ",
    loadingWardrobe: "ワードローブを読み込み中...",
    addTitle: "新しいアイテムを追加",
    itemNamePlaceholder: "アイテム名",
    categoryPlaceholder: "カテゴリー（例：ジャケット、ドレス）",
    addItemBtn: "アイテムを追加",
    clearBtn: "クリア",
    suggestionsTitle: "AIのコーディネート提案",
    loadingSuggestions: "提案を読み込み中...",
    voiceBtn: "🎤 音声"
  },

  ko: {
    brandName: "WardrobeIQ",
    logoutBtn: "로그아웃",
    weatherLoading: "날씨 로딩 중...",
    wardrobeTitle: "당신의 옷장",
    loadingWardrobe: "옷장 로딩 중...",
    addTitle: "새 아이템 추가",
    itemNamePlaceholder: "아이템 이름",
    categoryPlaceholder: "카테고리 (예: 재킷, 드레스)",
    addItemBtn: "아이템 추가",
    clearBtn: "초기화",
    suggestionsTitle: "AI 의상 추천",
    loadingSuggestions: "추천 로딩 중...",
    voiceBtn: "🎤 음성"
  },

  it: {
    brandName: "WardrobeIQ",
    logoutBtn: "Disconnetti",
    weatherLoading: "Caricamento meteo...",
    wardrobeTitle: "Il tuo guardaroba",
    loadingWardrobe: "Caricamento guardaroba...",
    addTitle: "Aggiungi nuovo articolo",
    itemNamePlaceholder: "Nome articolo",
    categoryPlaceholder: "Categoria (es. giacca, vestito)",
    addItemBtn: "Aggiungi articolo",
    clearBtn: "Pulisci",
    suggestionsTitle: "Suggerimenti outfit AI",
    loadingSuggestions: "Caricamento suggerimenti...",
    voiceBtn: "🎤 Voce"
  },

  tr: {
    brandName: "WardrobeIQ",
    logoutBtn: "Çıkış",
    weatherLoading: "Hava durumu yükleniyor...",
    wardrobeTitle: "Gardırobunuz",
    loadingWardrobe: "Gardırop yükleniyor...",
    addTitle: "Yeni öğe ekle",
    itemNamePlaceholder: "Öğe adı",
    categoryPlaceholder: "Kategori (ör. ceket, elbise)",
    addItemBtn: "Öğe ekle",
    clearBtn: "Temizle",
    suggestionsTitle: "Yapay Zeka Kıyafet Önerileri",
    loadingSuggestions: "Öneriler yükleniyor...",
    voiceBtn: "🎤 Ses"
  },

  vi: {
    brandName: "WardrobeIQ",
    logoutBtn: "Đăng xuất",
    weatherLoading: "Đang tải thời tiết...",
    wardrobeTitle: "Tủ quần áo của bạn",
    loadingWardrobe: "Đang tải tủ quần áo...",
    addTitle: "Thêm mục mới",
    itemNamePlaceholder: "Tên mục",
    categoryPlaceholder: "Thể loại (ví dụ: áo khoác, váy)",
    addItemBtn: "Thêm mục",
    clearBtn: "Xóa",
    suggestionsTitle: "Gợi ý trang phục AI",
    loadingSuggestions: "Đang tải gợi ý...",
    voiceBtn: "🎤 Giọng nói"
  },

  nl: {
    brandName: "WardrobeIQ",
    logoutBtn: "Uitloggen",
    weatherLoading: "Weer wordt geladen...",
    wardrobeTitle: "Je kledingkast",
    loadingWardrobe: "Kledingkast laden...",
    addTitle: "Nieuw item toevoegen",
    itemNamePlaceholder: "Itemnaam",
    categoryPlaceholder: "Categorie (bijv. jas, jurk)",
    addItemBtn: "Item toevoegen",
    clearBtn: "Wissen",
    suggestionsTitle: "AI Outfit Suggesties",
    loadingSuggestions: "Suggesties laden...",
    voiceBtn: "🎤 Stem"
  },

  pl: {
    brandName: "WardrobeIQ",
    logoutBtn: "Wyloguj się",
    weatherLoading: "Ładowanie pogody...",
    wardrobeTitle: "Twoja garderoba",
    loadingWardrobe: "Ładowanie garderoby...",
    addTitle: "Dodaj nowy element",
    itemNamePlaceholder: "Nazwa przedmiotu",
    categoryPlaceholder: "Kategoria (np. kurtka, sukienka)",
    addItemBtn: "Dodaj element",
    clearBtn: "Wyczyść",
    suggestionsTitle: "Sugestie strojów AI",
    loadingSuggestions: "Ładowanie sugestii...",
    voiceBtn: "🎤 Głos"
  },

  sv: {
    brandName: "WardrobeIQ",
    logoutBtn: "Logga ut",
    weatherLoading: "Laddar väder...",
    wardrobeTitle: "Din garderob",
    loadingWardrobe: "Laddar garderob...",
    addTitle: "Lägg till nytt föremål",
    itemNamePlaceholder: "Föremålsnamn",
    categoryPlaceholder: "Kategori (t.ex. jacka, klänning)",
    addItemBtn: "Lägg till föremål",
    clearBtn: "Rensa",
    suggestionsTitle: "AI Outfit Förslag",
    loadingSuggestions: "Laddar förslag...",
    voiceBtn: "🎤 Röst"
  },

  no: {
    brandName: "WardrobeIQ",
    logoutBtn: "Logg ut",
    weatherLoading: "Laster vær...",
    wardrobeTitle: "Din garderobe",
    loadingWardrobe: "Laster garderobe...",
    addTitle: "Legg til nytt element",
    itemNamePlaceholder: "Elementnavn",
    categoryPlaceholder: "Kategori (f.eks. jakke, kjole)",
    addItemBtn: "Legg til element",
    clearBtn: "Tøm",
    suggestionsTitle: "AI antrekksforslag",
    loadingSuggestions: "Laster forslag...",
    voiceBtn: "🎤 Stemme"
  },
da: {
  brandName: "WardrobeIQ",
  logoutBtn: "Log ud",
  weatherLoading: "Indlæser vejr...",
  wardrobeTitle: "Din garderobe",
  loadingWardrobe: "Indlæser garderobe...",
  addTitle: "Tilføj nyt element",
  itemNamePlaceholder: "Elementnavn",
  categoryPlaceholder: "Kategori (f.eks. jakke, kjole)",
  addItemBtn: "Tilføj element",
  clearBtn: "Ryd",
  suggestionsTitle: "AI Outfit Forslag",
  loadingSuggestions: "Indlæser forslag...",
  voiceBtn: "🎤 Stem"
}

};

  LANGS.forEach(([code, label]) => {
    const o = document.createElement('option'); o.value = code; o.textContent = label;
    languageSwitcher.appendChild(o);
  });

  function applyUILanguage(code) {
    const t = UI[code] || UI.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t[key] || UI.en[key] || el.textContent;
    });
    document.documentElement.lang = code;
    document.documentElement.dir = ['ar', 'he'].includes(code) ? 'rtl' : 'ltr';
  }
  let savedLang = 'en';
  try { savedLang = localStorage.getItem('lang') || 'en'; } catch {}
  languageSwitcher.value = UI[savedLang] || LANGS.some(([c]) => c === savedLang) ? savedLang : 'en';
  applyUILanguage(languageSwitcher.value);
  languageSwitcher.addEventListener('change', (e) => {
    applyUILanguage(e.target.value);
    try { localStorage.setItem('lang', e.target.value); } catch {}
  });
  const t = (key) => (UI[languageSwitcher.value] || UI.en)[key] || UI.en[key];

  /* ---------- Helpers ---------- */
  const DAY = 86400000;
  const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null;
  function wornLabel(date) {
    const d = daysSince(date);
    if (d === null) return { text: 'Never worn', cls: '' };
    if (d === 0) return { text: 'Worn today', cls: 'fresh' };
    if (d === 1) return { text: 'Worn yesterday', cls: 'fresh' };
    if (d < 14) return { text: `Worn ${d} days ago`, cls: d < 7 ? 'fresh' : 'mid' };
    return { text: `Not worn in ${d} days`, cls: 'old' };
  }
  const skeletons = (n) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');

  /* ---------- Stats ---------- */
  function updateStats() {
    const cats = new Set(state.items.map(i => i.category));
    const weekAgo = Date.now() - 7 * DAY;
    const wornThisWeek = state.history.filter(h => new Date(h.wornAt).getTime() > weekAgo).length;
    const idle = state.items.filter(i => { const d = daysSince(i.lastWornDate); return d === null || d >= 30; }).length;
    animateCount($("statItems"), state.items.length);
    animateCount($("statCategories"), cats.size);
    animateCount($("statWeek"), wornThisWeek);
    animateCount($("statIdle"), idle);
  }

  /* ---------- Wardrobe ---------- */
  function renderCategoryFilters() {
    const counts = {};
    state.items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
    if (state.category !== 'all' && !counts[state.category]) state.category = 'all';
    const chips = [['all', state.items.length], ...Object.entries(counts).sort((a, b) => b[1] - a[1])];
    $("categoryFilters").innerHTML = chips.map(([cat, n]) =>
      `<button type="button" role="tab" class="fchip${state.category === cat ? ' active' : ''}" data-cat="${escapeHtml(cat)}" aria-selected="${state.category === cat}">${cat === 'all' ? 'All' : escapeHtml(cat)}<span class="count">${n}</span></button>`
    ).join('');
  }

  function renderCard(it, i) {
    const worn = wornLabel(it.lastWornDate);
    const name = escapeHtml(it.itemName || it.name);
    return `
      <article class="item-card" data-tilt="5" data-id="${it._id}" style="--i:${i}">
        <div class="img-wrap">
          ${it.imageUrl ? `<img src="${escapeHtml(it.imageUrl)}" alt="${name}" loading="lazy">` : ''}
          <span class="tag">${escapeHtml(it.category)}</span>
          <div class="actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="wear" data-id="${it._id}">✓ Wear today</button>
            <button type="button" class="btn btn-ghost btn-sm del" data-action="edit" data-id="${it._id}" aria-label="Edit ${name}">✏️</button>
            <button type="button" class="btn btn-ghost btn-sm del" data-action="delete" data-id="${it._id}" aria-label="Delete ${name}">🗑</button>
          </div>
        </div>
        <div class="item-body">
          <strong title="${name}">${name}</strong>
          <span class="worn ${worn.cls}">${worn.text}</span>
        </div>
      </article>`;
  }

  function renderWardrobe() {
    const q = state.search.trim().toLowerCase();
    const list = state.items.filter(i =>
      (state.category === 'all' || i.category === state.category) &&
      (!q || `${i.itemName} ${i.category}`.toLowerCase().includes(q))
    );
    if (!state.items.length) {
      wardrobeItemsDiv.innerHTML = `<div class="empty"><span class="e-ico">👗</span><strong>Your wardrobe is empty</strong>Add your first piece to start getting outfit ideas.<br><button class="btn btn-primary" type="button" data-action="open-add">+ ${escapeHtml(t('addTitle'))}</button></div>`;
    } else if (!list.length) {
      wardrobeItemsDiv.innerHTML = `<div class="empty"><span class="e-ico">🔍</span><strong>No matches</strong>Try a different search or category.</div>`;
    } else {
      wardrobeItemsDiv.innerHTML = list.map(renderCard).join('');
      bindTilt(wardrobeItemsDiv);
    }
  }

  async function loadWardrobe() {
    try {
      const res = await authFetch('/api/wardrobe');
      const items = await res.json();
      state.items = Array.isArray(items) ? items : [];
    } catch (err) {
      console.error(err);
      wardrobeItemsDiv.innerHTML = '<div class="empty"><span class="e-ico">⚠️</span><strong>Couldn\'t load your wardrobe</strong>Check your connection and refresh.</div>';
      return;
    }
    renderCategoryFilters();
    renderWardrobe();
    updateStats();
  }

  $("categoryFilters").addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    state.category = chip.dataset.cat;
    renderCategoryFilters();
    renderWardrobe();
  });
  let searchTimer;
  $("searchInput").addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value; renderWardrobe(); }, 150);
  });

  // Card + empty-state actions (event delegation)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'wear') markAsWorn(id, btn);
    else if (action === 'delete') deleteItem(id);
    else if (action === 'edit') openEdit(id);
    else if (action === 'open-add') { resetAddForm(); openModal($("addModal")); }
  });

  async function markAsWorn(id, btn) {
    btn?.classList.add('loading');
    try {
      const res = await authFetch(`/api/wardrobe/${id}/wear`, { method: "POST" });
      if (!res.ok) throw new Error("Couldn't mark as worn");
      const { item } = await res.json();
      toast(`${item.itemName} marked as worn today`, 'success');
      await Promise.all([loadWardrobe(), loadOutfitHistories()]);
      document.querySelector(`.item-card[data-id="${id}"]`)?.classList.add('just-worn');
    } catch (err) {
      toast(err.message || 'Something went wrong', 'error');
      console.error(err);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  /* ---------- Delete with confirm modal ---------- */
  let pendingDelete = null;
  function deleteItem(id) {
    const item = state.items.find(i => i._id === id);
    pendingDelete = id;
    $("confirmTitle").textContent = `Delete "${item?.itemName || 'this item'}"?`;
    openModal($("confirmModal"));
  }
  $("confirmOk").addEventListener('click', async () => {
    const id = pendingDelete;
    if (!id) return;
    const okBtn = $("confirmOk");
    okBtn.classList.add('loading');
    try {
      const res = await authFetch(`/api/wardrobe/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Delete failed');
      }
      closeModal($("confirmModal"));
      const card = document.querySelector(`.item-card[data-id="${id}"]`);
      if (card) {
        card.classList.add('removing');
        await new Promise(r => setTimeout(r, 420));
      }
      toast('Item deleted', 'success');
      await Promise.all([loadWardrobe(), loadOutfitHistories(), loadRecentOutfits()]);
    } catch (err) {
      toast(err.message, 'error');
      console.error(err);
    } finally {
      okBtn.classList.remove('loading');
      pendingDelete = null;
    }
  });

  /* ---------- Modals ---------- */
  let lastFocus = null;
  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.remove('closing');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('input:not([hidden]), .btn-danger, [data-close]')?.focus(), 50);
  }
  function closeModal(modal) {
    if (modal.hidden) return;
    modal.classList.add('closing');
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove('closing');
      document.body.style.overflow = '';
      lastFocus?.focus?.();
    }, 240);
  }
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(modal); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal:not([hidden])').forEach(closeModal);
  });
  $("openAddBtn").addEventListener('click', () => { resetAddForm(); openModal($("addModal")); });

  /* ---------- Add item ---------- */
  const fileInput = $("imageFile");
  const dropzone = $("dropzone");
  const previewImg = $("previewImg");

  function setPreview(file) {
    if (!file) {
      previewImg.hidden = true;
      previewImg.removeAttribute('src');
      dropzone.classList.remove('has-img');
      return;
    }
    if (!file.type.startsWith('image/')) { toast('Please choose an image file', 'error'); return; }
    if (file.size > 4 * 1024 * 1024) { toast('Image must be under 4MB', 'error'); return; }
    previewImg.src = URL.createObjectURL(file);
    previewImg.hidden = false;
    dropzone.classList.add('has-img');
  }
  fileInput.addEventListener('change', () => setPreview(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    setPreview(file);
  });
  addItemForm.querySelectorAll('.field input').forEach(input =>
    input.addEventListener('input', () => input.parentElement.classList.remove('invalid')));

  function resetAddForm() {
    addItemForm.reset();
    setPreview(null);
    addItemForm.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
    state.editingId = null;
    dropzone.hidden = false;
    $("addItemTitle").textContent = t('addTitle');
    addItemForm.querySelector('[type="submit"] span').textContent = t('addItemBtn');
  }

  // Edit an existing item's details (the photo stays the same)
  function openEdit(id) {
    const item = state.items.find(i => i._id === id);
    if (!item) return;
    resetAddForm();
    state.editingId = id;
    dropzone.hidden = true;
    $("addItemTitle").textContent = 'Edit item';
    addItemForm.querySelector('[type="submit"] span').textContent = 'Save changes';
    $("itemName").value = item.itemName || '';
    $("category").value = item.category || '';
    $("colors").value = (item.colors || []).join(', ');
    $("formality").value = item.formality || '';
    $("pattern").value = item.pattern || '';
    $("material").value = item.material || '';
    $("notes").value = item.notes || '';
    addItemForm.querySelectorAll('input[name="seasons"]').forEach(c => { c.checked = (item.seasons || []).includes(c.value); });
    $("moreDetails").open = true;
    openModal($("addModal"));
  }
  $("clearAdd").addEventListener('click', resetAddForm);

  addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = $("itemName"), catEl = $("category");
    if (!state.editingId && !fileInput.files[0]) { toast('Add a photo of the item', 'error'); dropzone.classList.add('drag'); setTimeout(() => dropzone.classList.remove('drag'), 600); return; }
    for (const el of [nameEl, catEl]) {
      if (!el.value.trim()) { el.parentElement.classList.add('invalid'); el.focus(); toast('Please fill in all fields', 'error'); return; }
    }
    const submitBtn = addItemForm.querySelector('[type="submit"]');
    submitBtn.classList.add('loading');
    try {
      const editing = state.editingId;
      let res;
      if (editing) {
        const fd = new FormData(addItemForm);
        const body = {
          itemName: fd.get('itemName'), category: fd.get('category'), colors: fd.get('colors') || '',
          formality: fd.get('formality') || null, pattern: fd.get('pattern') || '', material: fd.get('material') || '',
          seasons: fd.getAll('seasons'), notes: fd.get('notes') || '',
        };
        res = await authFetch(`/api/wardrobe/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        res = await authFetch('/api/wardrobe', { method: 'POST', body: new FormData(addItemForm) });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || (editing ? 'Save failed' : 'Upload failed'));
      toast(editing ? `${json.itemName} updated` : `${json.itemName} added to your wardrobe`, 'success');
      resetAddForm();
      closeModal($("addModal"));
      if (!editing) state.category = 'all';
      await loadWardrobe();
    } catch (err) {
      toast(err.message || 'Network error', 'error');
      console.error(err);
    } finally {
      submitBtn.classList.remove('loading');
    }
  });

  /* ---------- History ---------- */
  async function loadOutfitHistories() {
    try {
      const res = await authFetch('/api/wardrobe/history');
      const histories = await res.json();
      state.history = Array.isArray(histories) ? histories.filter(h => h.itemId) : [];
    } catch (err) {
      console.error("Error fetching outfit histories:", err);
      historyDiv.innerHTML = '<div class="empty"><strong>Couldn\'t load history</strong></div>';
      return;
    }
    updateStats();

    if (!state.history.length) {
      historyDiv.innerHTML = '<div class="empty"><span class="e-ico">🗓️</span><strong>No outfits logged yet</strong>Tap "Wear today" on any item to start your history.</div>';
      return;
    }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - DAY).toDateString();
    let html = '', lastDay = '', i = 0;
    for (const h of state.history.slice(0, 40)) {
      const d = new Date(h.wornAt);
      const key = d.toDateString();
      if (key !== lastDay) {
        lastDay = key;
        const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        html += `<div class="tl-day">${label}</div>`;
      }
      html += `<div class="tl-item" style="--i:${i++}">
        ${h.itemId.imageUrl ? `<img src="${escapeHtml(h.itemId.imageUrl)}" alt="" loading="lazy">` : ''}
        <div><strong>${escapeHtml(h.itemId.itemName || '')}</strong><small>${escapeHtml(h.itemId.category || '')}</small></div>
        <time datetime="${d.toISOString()}">${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
      </div>`;
    }
    historyDiv.innerHTML = html;
  }

  /* ---------- Weather ---------- */
  let weatherPromise = null;
  const weatherCard = $("weatherCard");

  function weatherTheme(desc = '') {
    const d = desc.toLowerCase();
    if (/thunder|storm/.test(d)) return ['storm', '⛈️'];
    if (/snow|sleet/.test(d)) return ['snowy', '❄️'];
    if (/rain|drizzle|shower/.test(d)) return ['rainy', '🌧️'];
    if (/clear/.test(d)) return [new Date().getHours() >= 19 || new Date().getHours() < 6 ? 'cloudy' : 'sunny', new Date().getHours() >= 19 || new Date().getHours() < 6 ? '🌙' : '☀️'];
    if (/few clouds|scattered/.test(d)) return ['sunny', '⛅'];
    if (/cloud|overcast|mist|haze|fog|smoke/.test(d)) return ['cloudy', '☁️'];
    return ['', '⛅'];
  }

  function showWeatherTip({ temperature: temp, description = '' }) {
    const d = description.toLowerCase();
    let tip;
    if (/thunder|storm/.test(d)) tip = 'Stormy out — stay in comfy layers, or grab a raincoat and boots if you head out ⚡';
    else if (/rain|drizzle|shower/.test(d)) tip = 'Rain expected — grab a raincoat and skip the suede ☔';
    else if (/snow|sleet/.test(d)) tip = 'Snow day — coat, boots and warm layers ❄️';
    else if (temp >= 30) tip = 'Hot one — go for breathable cotton, light colours and sunglasses 🕶️';
    else if (temp >= 25) tip = 'Warm and pleasant — tees, light kurtas and sneakers are perfect 👟';
    else if (temp >= 15) tip = 'Mild weather — a shirt with jeans, plus a light layer for the evening 🧥';
    else tip = 'Chilly — reach for a jacket, sweater or a warm kurta set 🧣';
    const el = $("weatherTip");
    el.innerHTML = `<strong>Stylist tip</strong>${escapeHtml(tip)}`;
    el.hidden = false;
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 600000 });
    });
  }

  async function loadWeather() {
    $("weatherInfo").textContent = t('weatherLoading');
    $("refreshWeather").classList.add('spin');
    try {
      const pos = await getPosition();
      const weatherRes = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      if (!weatherRes.ok) throw new Error('Weather request failed');
      const weather = await weatherRes.json();

      const [theme, icon] = weatherTheme(weather.description);
      weatherCard.className = `weather-card in ${theme}`;
      $("weatherIcon").textContent = icon;
      $("weatherTemp").textContent = `${Math.round(weather.temperature)}°`;
      $("weatherInfo").textContent = `${weather.city || 'Your area'} · ${weather.description || ''}`;
      $("wWind").textContent = `${weather.windSpeed ?? '–'} m/s`;
      $("wHumidity").textContent = `${weather.humidity ?? '–'}%`;
      showWeatherTip(weather);
      return weather;
    } catch (err) {
      console.error(err);
      weatherCard.className = 'weather-card in cloudy';
      $("weatherIcon").textContent = err.code === 1 ? '📍' : '🌤️';
      $("weatherTemp").textContent = '--°';
      $("weatherInfo").textContent = err.code === 1
        ? 'Allow location access for weather-based suggestions'
        : 'Weather unavailable — showing suggestions without it';
      return null;
    } finally {
      $("refreshWeather").classList.remove('spin');
    }
  }
  $("refreshWeather").addEventListener('click', () => { weatherPromise = loadWeather(); });

  /* ---------- AI stylist entry + recent AI outfits (history only; no AI call here) ---------- */
  const goToStylist = (q) => { location.href = `/stylist?q=${encodeURIComponent(q)}&auto=1`; };
  $("askStylist").addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $("askInput").value.trim();
    if (q.length < 3) { toast('Tell the stylist what you need', 'error'); $("askInput").focus(); return; }
    goToStylist(q);
  });
  document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => goToStylist(b.dataset.ask)));

  async function loadRecentOutfits() {
    const box = $("recentOutfits");
    try {
      const res = await authFetch('/api/stylist/outfits?limit=6');
      const { outfits = [] } = await res.json();
      box.innerHTML = outfits.length ? outfits.map((o, n) => `
        <a class="s-card recent-card" href="/stylist#history" style="--i:${n}">
          <div class="collage">${o.items.slice(0, 3).map(i => `<img src="${escapeHtml(i.item.imageUrl)}" alt="" loading="lazy">`).join('')}</div>
          <div class="s-body"><strong>${o.saved ? '★ ' : ''}${escapeHtml(o.title)}</strong><small>${o.items.length} items${o.occasion ? ' · ' + escapeHtml(o.occasion) : ''}</small></div>
        </a>`).join('')
        : '<div class="empty"><span class="e-ico">🪄</span><strong>No AI outfits yet</strong>Ask the stylist above — it builds looks from your own clothes.</div>';
    } catch (err) {
      if (err !== 'Unauthorized') box.innerHTML = '<div class="empty"><strong>Couldn\'t load recent outfits</strong></div>';
      console.error(err);
    }
  }

  /* ---------- Voice commands ---------- */
  const voiceBtn = $("voiceCommandBtn");
  const voiceOverlay = $("voiceStatus");
  const voiceText = voiceOverlay.querySelector('.voice-text');
  voiceBtn.addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast('Voice commands need Chrome or Edge', 'error'); return; }
    const rec = new Recognition();
    rec.lang = languageSwitcher.value === 'en' ? 'en-US' : languageSwitcher.value;
    rec.interimResults = true;
    voiceBtn.classList.add('listening');
    voiceOverlay.hidden = false;
    voiceText.textContent = 'Listening…';

    const finish = (delay = 0) => setTimeout(() => {
      voiceBtn.classList.remove('listening');
      voiceOverlay.hidden = true;
    }, delay);

    rec.onresult = async (ev) => {
      const result = ev.results[ev.results.length - 1];
      const text = result[0].transcript.toLowerCase().trim();
      voiceText.textContent = `"${text}"`;
      if (!result.isFinal) return;

      const show = text.match(/^(?:show|find)(?: me)?(?: my)? (.+)$/);
      if (show) {
        const cat = show[1].replace(/s$/, '');
        $("searchInput").value = '';
        state.search = cat;
        state.category = 'all';
        renderCategoryFilters();
        renderWardrobe();
        $("wardrobeSection").scrollIntoView({ behavior: 'smooth' });
        toast(`Showing "${cat}"`, 'info');
      } else if (text.startsWith('add ')) {
        openModal($("addModal"));
        $("itemName").value = text.replace(/^add\s+/, '');
        setTimeout(() => $("category").focus(), 80);
      } else if (text.includes('suggest') || text.includes('outfit') || text.includes('wear')) {
        goToStylist(text);
      } else {
        toast(`Didn't catch a command in "${text}"`, 'error');
      }
      finish(700);
    };
    rec.onerror = (e) => {
      voiceText.textContent = e.error === 'not-allowed' ? 'Microphone access denied' : 'Voice error: ' + (e.error || 'unknown');
      console.error(e);
      finish(1500);
    };
    rec.onend = () => { if (voiceBtn.classList.contains('listening')) finish(400); };
    rec.start();
  });

  /* ---------- Initial load ---------- */
  wardrobeItemsDiv.innerHTML = skeletons(8);
  historyDiv.innerHTML = skeletons(3);
  observeReveals();
  loadWardrobe();
  weatherPromise = loadWeather();
  loadRecentOutfits();
  loadOutfitHistories();
});
