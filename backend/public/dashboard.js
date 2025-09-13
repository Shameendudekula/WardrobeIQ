function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return Promise.reject('No token');
  }
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  options.credentials = 'include';  // if backend requires cookies/session
  return fetch(url, options).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return Promise.reject('Unauthorized');
    }
    return res;
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const weatherInfo = document.getElementById("weatherInfo");
  const weatherDetails = document.getElementById("weatherDetails");
  const wardrobeItemsDiv = document.getElementById("wardrobeItems");
  const suggestionsDiv = document.getElementById("suggestions");
  const addItemForm = document.getElementById("addItemForm");
  const voiceCommandBtn = document.getElementById("voiceCommandBtn");
  const voiceStatus = document.getElementById("voiceStatus");
  const languageSwitcher = document.getElementById("languageSwitcher");
  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn.addEventListener('click', async () => {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch(err) {
    console.warn('Logout failed:', err);
  }
  localStorage.removeItem('token');  // clear token on logout
  location.href = '/login.html';
});



  // Long language list (popular + many)
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



  function applyUILanguage(code) {
  const t = UI[code] || UI.en;
  
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });
}
languageSwitcher.addEventListener('change', (e) => {
  applyUILanguage(e.target.value);
});

applyUILanguage('en'); // default on page load
  

  

  // Load wardrobe items (GET /api/wardrobe)
 async function loadWardrobe() {
  wardrobeItemsDiv.textContent = "Loading...";
  try {
    const res = await authFetch('/api/wardrobe');
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) wardrobeItemsDiv.innerHTML = '<em>No items yet</em>';
    else wardrobeItemsDiv.innerHTML = items.map(renderCard).join('');
  } catch (err) {
    wardrobeItemsDiv.textContent = "Error loading wardrobe";
    console.error(err);
  }
}



  function renderCard(it) {
    const last = it.lastWornDate ? new Date(it.lastWornDate).toLocaleDateString() : 'Never';
    return `
      <div class="item-card">
        ${it.imageUrl ? `<img src="${it.imageUrl}" alt="${escapeHtml(it.itemName || it.name || '')}" style="width:100%;height:140px;object-fit:cover;border-radius:8px">` : ''}
        <p><strong>${escapeHtml(it.itemName || it.name)}</strong></p>
        <p>Category: ${escapeHtml(it.category)}</p>
        <p>Last Worn: ${last}</p>
        <div style="margin-top:6px">
          <button onclick="markAsWorn('${it._id}')" class="btn-ghost">Mark worn</button>
          <button onclick="deleteItem('${it._id}')" class="btn-ghost">Delete</button>
        </div>
      </div>
    `;
  }

window.markAsWorn = async (id) => {
  try {
    const res = await authFetch(`/api/wardrobe/${id}/wear`, { method: "POST" });
    if (!res.ok) throw new Error("Update failed");
    await loadWardrobe();
    await loadWeatherAndSuggestions();
    await loadOutfitHistories();
  } catch (err) {
    alert(err.message);
    console.error(err);
  }
};


async function loadOutfitHistories() {
  const historyDiv = document.getElementById("historyItems");
  historyDiv.textContent = "Loading...";

  try {
    const res = await authFetch('/api/wardrobe/api/wardrobe/outfithistories');

    // Always get text first, then try to parse JSON
    const resText = await res.text();
    let histories;

    try {
      histories = JSON.parse(resText);
    } catch (parseErr) {
      console.error("Failed to parse JSON. Response:", resText);
      historyDiv.textContent = "Error loading history (invalid server response)";
      return;
    }

    if (!Array.isArray(histories) || histories.length === 0) {
      historyDiv.innerHTML = "<em>No history yet</em>";
      return;
    }

    // Render history items safely
    historyDiv.innerHTML = histories.map(h => `
      <div class="item-card">
        ${h.itemId?.imageUrl ? `<img src="${h.itemId.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:20px">` : ''}
        <p><strong>${escapeHtml(h.itemId?.itemName || h.itemId?.name || '')}</strong></p>
        <p>Category: ${escapeHtml(h.itemId?.category || '')}</p>
        <p>Worn At: ${h.wornAt ? new Date(h.wornAt).toLocaleString() : 'Unknown'}</p>
      </div>
    `).join('');

  } catch (err) {
    console.error("Error fetching outfit histories:", err);
    historyDiv.textContent = "Error loading history";
  }
}

// Simple escapeHtml function to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}




window.deleteItem = async (id) => {
  console.log('Deleting item id:', id);
  if (!confirm('Delete this item?')) return;
  try {
    const res = await authFetch(`/api/wardrobe/${id}`, { method: 'DELETE' });
    console.log('Delete response status:', res.status);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('Delete failed:', errJson);
      throw new Error(errJson.message || 'Delete failed');
    }
    alert('Deleted successfully');
    await loadWardrobe();
  } catch (err) {
    alert('Error: ' + err.message);
    console.error(err);
  }
};


  // Add item using FormData
  addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(addItemForm);
  try {
    const res = await authFetch('/api/wardrobe', {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    if (!res.ok) return alert(json.message || 'Upload failed');
    addItemForm.reset();
    await loadWardrobe();
    await loadOutfitHistories();
    await loadWeatherAndSuggestions();
  } catch (err) {
    alert('Network error');
    console.error(err);
  }
});

document.getElementById('applyFiltersBtn').addEventListener('click', () => {
  loadWeatherAndSuggestions();  // or a dedicated function to fetch suggestions using current selects
});
['locationSelect', 'occasionSelect', 'purposeSelect'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('change', loadWeatherAndSuggestions);
});

  // Load weather -> send weather to suggestions endpoint (POST)
  async function loadWeatherAndSuggestions() {
  weatherInfo.textContent = UI[languageSwitcher.value]?.weatherLoading || 'Loading weather...';
  if (!navigator.geolocation) { weatherInfo.textContent = 'Geolocation not supported'; return; }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    try {
      const weatherRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const weather = await weatherRes.json();

      const city = weather.city || 'your area';
      const description = weather.description || '';
      const temp = weather.temperature || '';
      const windSpeed = weather.windSpeed ?? '-';
      const humidity = weather.humidity ?? '-';

      weatherInfo.textContent = `${city} · ${description} · ${temp}°C`;
      weatherDetails.textContent = `Wind: ${windSpeed} m/s • Humidity: ${humidity}`;

      // Get user inputs for context
      const location = document.getElementById('locationSelect').value || '';
      const occasion = document.getElementById('occasionSelect').value || '';
      const purpose = document.getElementById('purposeSelect').value || '';

      // POST to suggestions with weather + context
      const sugRes = await authFetch('/api/wardrobe/suggestions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    temp: Number(temp), 
    condition: description,
    location,
    occasion,
    purpose
  })
});


      const result = await sugRes.json();
      const items = result.suggestions || [];
      suggestionsDiv.innerHTML = items.length ? items.map(i =>
        `<div class="item-card">${i.imageUrl ? `<img src="${i.imageUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px">` : ''}<p>${escapeHtml(i.itemName || i.name)}</p></div>`
      ).join('') : '<em>No suggestions</em>';

    } catch (err) {
      weatherInfo.textContent = 'Error loading weather';
      suggestionsDiv.textContent = '';
      console.error(err);
    }
  }, err => {
    weatherInfo.textContent = 'Location permission required';
    console.error(err);
  }, { timeout: 10000 });
}


  // Voice command: simple filter / add prefill
  voiceCommandBtn.addEventListener('click', () => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    rec.lang = languageSwitcher.value || 'en-US';
    voiceStatus.textContent = 'Listening...';
    rec.onresult = async (ev) => {
      const text = ev.results[0][0].transcript.toLowerCase();
      voiceStatus.textContent = `Heard: ${text}`;
      if (text.includes('show') && text.includes('jack')) {
  // filter jackets
  const res = await authFetch('/api/wardrobe?category=jackets');
  const items = await res.json();
  wardrobeItemsDiv.innerHTML = items.map(renderCard).join('');
}
 else if (text.startsWith('add ')) {
        const name = text.replace(/^add\s+/, '').trim();
        document.getElementById('itemName').value = name;
        document.getElementById('category').focus();
      } else if (text.includes('suggest') || text.includes('outfit')) {
        await loadWeatherAndSuggestions();
      } else {
        alert('Command not recognized: ' + text);
      }
      rec.stop();
      voiceStatus.textContent = '';
    };
    rec.onerror = (e) => {
      voiceStatus.textContent = 'Voice error: ' + (e.error || 'unknown');
      console.error(e);
    };
    rec.start();
  });

  languageSwitcher.addEventListener('change', (ev) => applyUILanguage(ev.target.value));

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // initial load
  loadWardrobe();
  loadWeatherAndSuggestions();
});  