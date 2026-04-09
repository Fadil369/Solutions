// FlowClinic Kiosk Frontend
// Single-page app with multilingual support

const API_BASE = window.location.origin;
let currentLanguage = 'ar';
let departments = [];
let labels = {};

// ---- Labels (i18n) ----
const LABELS = {
  welcome: {
    ar: 'مرحباً بك في العيادة', en: 'Welcome to the Clinic', ur: 'کلینک میں خوش آمدید',
    tl: 'Maligayang pagdating sa Klinika', bn: 'ক্লিনিকে স্বাগতম', hi: 'क्लिनिक में आपका स्वागत है',
  },
  select_language: {
    ar: 'اختر لغتك', en: 'Select your language', ur: 'اپنی زبان منتخب کریں',
    tl: 'Piliin ang iyong wika', bn: 'আপনার ভাষা নির্বাচন করুন', hi: 'अपनी भाषा चुनें',
  },
  new_patient: {
    ar: 'مريض جديد', en: 'New Patient', ur: 'نیا مریض',
    tl: 'Bagong Pasyente', bn: 'নতুন রোগী', hi: 'नया मरीज',
  },
  returning_patient: {
    ar: 'مريض سابق', en: 'Returning Patient', ur: 'واپسی والا مریض',
    tl: 'Bumalik na Pasyente', bn: 'ফিরতি রোগী', hi: 'पुराना मरीज',
  },
  national_id: {
    ar: 'رقم الهوية الوطنية', en: 'National ID', ur: 'قومی شناختی کارڈ',
    tl: 'National ID', bn: 'জাতীয় পরিচয়পত্র', hi: 'राष्ट्रीय पहचान पत्र',
  },
  full_name_ar: {
    ar: 'الاسم بالعربية', en: 'Name (Arabic)', ur: 'نام (عربی)',
    tl: 'Pangalan (Arabic)', bn: 'নাম (আরবি)', hi: 'नाम (अरबी)',
  },
  full_name_en: {
    ar: 'الاسم بالإنجليزية', en: 'Name (English)', ur: 'نام (انگریزی)',
    tl: 'Pangalan (English)', bn: 'নাম (ইংরেজি)', hi: 'नाम (अंग्रेज़ी)',
  },
  phone_number: {
    ar: 'رقم الجوال', en: 'Phone Number', ur: 'فون نمبر',
    tl: 'Numero ng Telepono', bn: 'ফোন নম্বর', hi: 'फोन नंबर',
  },
  insurance_id: {
    ar: 'رقم التأمين (اختياري)', en: 'Insurance ID (optional)', ur: 'انشورنس آئی ڈی (اختیاری)',
    tl: 'Insurance ID (opsyonal)', bn: 'বীমা আইডি (ঐচ্ছিক)', hi: 'बीमा आईडी (वैकल्पिक)',
  },
  department: {
    ar: 'القسم', en: 'Department', ur: 'شعبہ',
    tl: 'Department', bn: 'বিভাগ', hi: 'विभाग',
  },
  register: {
    ar: 'تسجيل', en: 'Register', ur: 'رجسٹر',
    tl: 'Mag-register', bn: 'নিবন্ধন', hi: 'पंजीकरण',
  },
  check_in: {
    ar: 'تسجيل الحضور', en: 'Check In', ur: 'چیک ان',
    tl: 'Mag-check in', bn: 'চেক ইন', hi: 'चेक इन',
  },
  your_ticket: {
    ar: 'تذكرتك', en: 'Your Ticket', ur: 'آپ کا ٹکٹ',
    tl: 'Iyong Tiket', bn: 'আপনার টিকিট', hi: 'आपका टिकट',
  },
  queue_number: {
    ar: 'رقم الدور', en: 'Queue Number', ur: 'قطار نمبر',
    tl: 'Numero ng Pila', bn: 'সারি নম্বর', hi: 'कतार संख्या',
  },
  estimated_wait: {
    ar: 'الوقت المتوقع للانتظار', en: 'Estimated Wait', ur: 'تخمینی وقت',
    tl: 'Tinatayang Paghihintay', bn: 'আনুমানিক অপেক্ষা', hi: 'अनुमानित प्रतीक्षा',
  },
  minutes: {
    ar: 'دقيقة', en: 'minutes', ur: 'منٹ',
    tl: 'minuto', bn: 'মিনিট', hi: 'मिनट',
  },
  please_wait: {
    ar: 'يرجى الانتظار حتى يتم استدعاؤك',
    en: 'Please wait until you are called',
    ur: 'براہ کرم اپنی باری کا انتظار کریں',
    tl: 'Mangyaring maghintay hanggang tawagin ka',
    bn: 'অনুগ্রহ করে অপেক্ষা করুন',
    hi: 'कृपया प्रतीक्षा करें',
  },
  invalid_national_id: {
    ar: 'رقم الهوية غير صحيح (10 أرقام تبدأ بـ 1 أو 2)',
    en: 'Invalid National ID (10 digits starting with 1 or 2)',
    ur: 'غلط قومی شناختی نمبر',
    tl: 'Hindi wastong National ID', bn: 'অবৈধ জাতীয় পরিচয়', hi: 'अमान्य राष्ट्रीय पहचान',
  },
  patient_not_found: {
    ar: 'لم يتم العثور على المريض. سجل كمريض جديد.',
    en: 'Patient not found. Please register as a new patient.',
    ur: 'مریض نہیں ملا۔',
    tl: 'Hindi natagpuan ang pasyente.', bn: 'রোগী পাওয়া যায়নি।', hi: 'मरीज नहीं मिला।',
  },
  error_occurred: {
    ar: 'حدث خطأ. يرجى المحاولة مرة أخرى',
    en: 'An error occurred. Please try again.',
    ur: 'خرابی ہوئی۔ دوبارہ کوشش کریں',
    tl: 'May naganap na error.', bn: 'ত্রুটি ঘটেছে।', hi: 'त्रुटि हुई।',
  },
  register_new: {
    ar: 'تسجيل مريض جديد', en: 'Register New Patient', ur: 'نیا مریض رجسٹر کریں',
    tl: 'Mag-register ng Bagong Pasyente', bn: 'নতুন রোগী নিবন্ধন', hi: 'नया मरीज पंजीकरण',
  },
  checkin_returning: {
    ar: 'تسجيل حضور مريض سابق', en: 'Check In Returning Patient', ur: 'واپسی والا مریض چیک ان',
    tl: 'Mag-check in ng Bumalik na Pasyente', bn: 'ফিরতি রোগী চেক ইন', hi: 'पुराना मरीज चेक इन',
  },
  national_id_hint: {
    ar: '10 أرقام تبدأ بـ 1 (سعودي) أو 2 (غير سعودي)',
    en: '10 digits starting with 1 (Saudi) or 2 (non-Saudi)',
    ur: '10 ہندسے 1 (سعودی) یا 2 سے شروع',
    tl: '10 numero na nagsisimula sa 1 o 2',
    bn: '10 সংখ্যা 1 বা 2 দিয়ে শুরু',
    hi: '10 अंक 1 या 2 से शुरू',
  },
  submitting: {
    ar: 'جاري المعالجة...', en: 'Processing...', ur: 'پروسیسنگ...',
    tl: 'Pinoproseso...', bn: 'প্রক্রিয়াকরণ...', hi: 'प्रक्रिया...',
  },
  new_ticket: {
    ar: 'تذكرة جديدة', en: 'New Ticket', ur: 'نیا ٹکٹ',
    tl: 'Bagong Tiket', bn: 'নতুন টিকিট', hi: 'नया टिकट',
  },
  select_department: {
    ar: 'اختر القسم', en: 'Select Department', ur: 'شعبہ منتخب کریں',
    tl: 'Piliin ang Department', bn: 'বিভাগ নির্বাচন করুন', hi: 'विभाग चुनें',
  },
  phone_tab: {
    ar: 'رقم الجوال', en: 'Phone', ur: 'فون',
    tl: 'Telepono', bn: 'ফোন', hi: 'फोन',
  },
  id_tab: {
    ar: 'رقم الهوية', en: 'National ID', ur: 'شناختی نمبر',
    tl: 'National ID', bn: 'পরিচয়পত্র', hi: 'पहचान पत्र',
  },
};

const LANGUAGES = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', dir: 'rtl' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭', dir: 'ltr' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
];

// ---- Helpers ----
function getLabel(key) {
  return LABELS[key]?.[currentLanguage] || LABELS[key]?.['en'] || key;
}

function getDirection() {
  return currentLanguage === 'ar' || currentLanguage === 'ur' ? 'rtl' : 'ltr';
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function validateSaudiId(id) {
  return /^[12]\d{9}$/.test(id);
}

// ---- Language Selection ----
function initLanguageGrid() {
  const grid = document.getElementById('language-grid');
  grid.innerHTML = LANGUAGES.map(lang => `
    <button class="lang-btn" onclick="selectLanguage('${lang.code}')">
      <span class="flag">${lang.flag}</span>
      <span>${lang.name}</span>
    </button>
  `).join('');
}

function selectLanguage(code) {
  currentLanguage = code;
  const dir = getDirection();
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
  updateAllLabels();
  loadDepartments();
  showScreen('screen-menu');
}

function updateAllLabels() {
  // Welcome
  document.getElementById('menu-title').textContent = getLabel('welcome');
  document.getElementById('btn-new-text').textContent = getLabel('new_patient');
  document.getElementById('btn-returning-text').textContent = getLabel('returning_patient');

  // Register form
  document.getElementById('register-title').textContent = getLabel('register_new');
  document.getElementById('label-national-id').textContent = getLabel('national_id');
  document.getElementById('label-name-ar').textContent = getLabel('full_name_ar');
  document.getElementById('label-name-en').textContent = getLabel('full_name_en');
  document.getElementById('label-phone').textContent = getLabel('phone_number');
  document.getElementById('label-insurance').textContent = getLabel('insurance_id');
  document.getElementById('label-department').textContent = getLabel('department');
  document.getElementById('btn-register-submit').textContent = getLabel('register');
  document.getElementById('national-id-hint').textContent = getLabel('national_id_hint');

  // Check-in form
  document.getElementById('checkin-title').textContent = getLabel('checkin_returning');
  document.getElementById('tab-national-id').textContent = getLabel('id_tab');
  document.getElementById('tab-phone').textContent = getLabel('phone_tab');
  document.getElementById('label-checkin-national').textContent = getLabel('national_id');
  document.getElementById('label-checkin-phone').textContent = getLabel('phone_number');
  document.getElementById('label-checkin-dept').textContent = getLabel('department');
  document.getElementById('btn-checkin-submit').textContent = getLabel('check_in');

  // Ticket
  document.getElementById('ticket-your-number-label').textContent = getLabel('queue_number');
  document.getElementById('ticket-wait-label').textContent = getLabel('estimated_wait') + ': ';
  document.getElementById('ticket-minutes-label').textContent = ' ' + getLabel('minutes');
  document.getElementById('ticket-please-wait').textContent = getLabel('please_wait');
  document.querySelector('.btn-new-ticket').textContent = getLabel('new_ticket');
}

// ---- Departments ----
async function loadDepartments() {
  try {
    const res = await fetch(`${API_BASE}/api/kiosk/departments`);
    departments = await res.json();
    populateDepartmentSelects();
  } catch (err) {
    console.error('Failed to load departments:', err);
    // Use fallback
    departments = [
      { name_en: 'General Medicine', name_ar: 'الطب العام' },
      { name_en: 'Dental', name_ar: 'الأسنان' },
      { name_en: 'Ophthalmology', name_ar: 'العيون' },
      { name_en: 'Dermatology', name_ar: 'الجلدية' },
      { name_en: 'Pediatrics', name_ar: 'الأطفال' },
    ];
    populateDepartmentSelects();
  }
}

function populateDepartmentSelects() {
  const selects = ['reg-department', 'checkin-department'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${getLabel('select_department')}</option>`;
    departments.forEach(dept => {
      const name = currentLanguage === 'ar' ? dept.name_ar : dept.name_en;
      sel.innerHTML += `<option value="${dept.name_en}">${name}</option>`;
    });
  });
}

// ---- Check-in Tabs ----
function switchCheckinTab(tab) {
  const tabs = document.querySelectorAll('.checkin-tabs .tab');
  tabs.forEach(t => t.classList.remove('active'));

  if (tab === 'national-id') {
    document.getElementById('checkin-national-id-group').style.display = 'block';
    document.getElementById('checkin-phone-group').style.display = 'none';
    document.getElementById('checkin-national-id').required = true;
    document.getElementById('checkin-phone').required = false;
    tabs[0].classList.add('active');
  } else {
    document.getElementById('checkin-national-id-group').style.display = 'none';
    document.getElementById('checkin-phone-group').style.display = 'block';
    document.getElementById('checkin-national-id').required = false;
    document.getElementById('checkin-phone').required = true;
    tabs[1].classList.add('active');
  }
}

// ---- Registration ----
async function handleRegister(e) {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.style.display = 'none';

  const nationalId = document.getElementById('reg-national-id').value.trim();
  const nameAr = document.getElementById('reg-name-ar').value.trim();
  const nameEn = document.getElementById('reg-name-en').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const insuranceId = document.getElementById('reg-insurance').value.trim();
  const department = document.getElementById('reg-department').value;

  // Validate national ID
  if (!validateSaudiId(nationalId)) {
    errorEl.textContent = getLabel('invalid_national_id');
    errorEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btn-register-submit');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>${getLabel('submitting')}`;

  try {
    const res = await fetch(`${API_BASE}/api/kiosk/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nationalId,
        nameAr,
        nameEn,
        phone,
        preferredLanguage: currentLanguage,
        insuranceId: insuranceId || undefined,
        department,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    showTicket(data.queueEntry, department);
  } catch (err) {
    errorEl.textContent = err.message || getLabel('error_occurred');
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = getLabel('register');
  }
}

// ---- Check-In ----
async function handleCheckIn(e) {
  e.preventDefault();
  const errorEl = document.getElementById('checkin-error');
  errorEl.style.display = 'none';

  const nationalId = document.getElementById('checkin-national-id').value.trim();
  const phone = document.getElementById('checkin-phone').value.trim();
  const department = document.getElementById('checkin-department').value;

  const body = { department };
  if (nationalId) body.nationalId = nationalId;
  if (phone) body.phone = phone;

  const btn = document.getElementById('btn-checkin-submit');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>${getLabel('submitting')}`;

  try {
    const res = await fetch(`${API_BASE}/api/kiosk/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.status === 404) {
      errorEl.textContent = getLabel('patient_not_found');
      errorEl.style.display = 'block';
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || 'Check-in failed');
    }

    showTicket(data.queueEntry, department);
  } catch (err) {
    errorEl.textContent = err.message || getLabel('error_occurred');
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = getLabel('check_in');
  }
}

// ---- Ticket Display ----
function showTicket(queueEntry, department) {
  document.getElementById('ticket-number').textContent = `#${queueEntry.queue_number}`;

  // Department name
  const dept = departments.find(d => d.name_en === department);
  const deptName = currentLanguage === 'ar' ? (dept?.name_ar || department) : (dept?.name_en || department);
  document.getElementById('ticket-department').textContent = deptName;

  // Estimated wait
  document.getElementById('ticket-wait-time').textContent = queueEntry.estimated_wait_min;

  // Simple QR placeholder (draws a grid pattern)
  drawQRPattern();

  showScreen('screen-ticket');
}

function drawQRPattern() {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
  const size = 150;
  const cellSize = 6;
  const modules = Math.floor(size / cellSize);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';

  // Generate pseudo-random QR pattern
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      // Corner patterns
      if ((i < 7 && j < 7) || (i < 7 && j >= modules - 7) || (i >= modules - 7 && j < 7)) {
        if (i === 0 || i === 6 || j === 0 || j === 6 ||
            i === modules - 1 || i === modules - 7 || j === modules - 1 || j === modules - 7 ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4) ||
            (i >= 2 && i <= 4 && j >= modules - 5 && j <= modules - 3) ||
            (i >= modules - 5 && i <= modules - 3 && j >= 2 && j <= 4)) {
          ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
      } else if (Math.random() > 0.55) {
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }
}

function resetToLanguage() {
  document.getElementById('register-form').reset();
  document.getElementById('checkin-form').reset();
  document.getElementById('register-error').style.display = 'none';
  document.getElementById('checkin-error').style.display = 'none';
  showScreen('screen-language');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initLanguageGrid();
});
