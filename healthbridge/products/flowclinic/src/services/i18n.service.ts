import type { SupportedLanguage, SoapNote } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// i18n message templates
const messages: Record<string, Record<SupportedLanguage, string>> = {
  queue_confirmation: {
    ar: '🏥 تم تسجيل دخولك بنجاح!\nرقمك: #{queueNumber}\nالوقت المتوقع للانتظار: {estimatedWait} دقيقة\nالقسم: {department}\n\nيرجى الانتظار حتى يتم استدعاؤك.',
    en: '🏥 You have been registered!\nYour number: #{queueNumber}\nEstimated wait: {estimatedWait} min\nDepartment: {department}\n\nPlease wait until you are called.',
    ur: '🏥 آپ کا اندراج ہو گیا!\nآپ کا نمبر: #{queueNumber}\nانتظار کا تخمینی وقت: {estimatedWait} منٹ\nڈپارٹمنٹ: {department}\n\nبراہ کرم انتظار کریں۔',
    tl: '🏥 Matagumpay kang na-register!\nIyong numero: #{queueNumber}\nTinatayang paghihintay: {estimatedWait} min\nDepartment: {department}\n\nMangyaring maghintay hanggang tawagin ka.',
    bn: '🏥 আপনার নিবন্ধন সফল হয়েছে!\nআপনার নম্বর: #{queueNumber}\nআনুমানিক অপেক্ষার সময়: {estimatedWait} মিনিট\nবিভাগ: {department}\n\nঅনুগ্রহ করে অপেক্ষা করুন।',
    hi: '🏥 आपका पंजीकरण सफल रहा!\nआपका नंबर: #{queueNumber}\nअनुमानित प्रतीक्षा: {estimatedWait} मिनट\nविभाग: {department}\n\nकृपया प्रतीक्षा करें।',
  },
  queue_update: {
    ar: '⏰ تحديث: أنت الآن في المركز #{position}\nالحالي: #{currentServing}',
    en: '⏰ Update: You are now at position #{position}\nCurrently serving: #{currentServing}',
    ur: '⏰ اپڈیٹ: آپ اب #{position} پوزیشن پر ہیں\nفی معلومات: #{currentServing}',
    tl: '⏰ Update: Ikaw ay nasa posisyon #{position}\nKasalukuyang sinisilbihan: #{currentServing}',
    bn: '⏰ আপডেট: আপনি এখন #{position} অবস্থানে\nবর্তমানে পরিবেশন: #{currentServing}',
    hi: '⏰ अपडेट: आप अब #{position} स्थान पर हैं\nवर्तमान में सेवा: #{currentServing}',
  },
  ready_notification: {
    ar: '🚨 دورك الآن! يرجى التوجه إلى {department} {room}',
    en: '🚨 Your turn! Please proceed to {department} {room}',
    ur: '🚨 آپ کی باری! براہ کرم {department} {room} پر جائیں',
    tl: '🚨 Ikaw na! Mangyaring pumunta sa {department} {room}',
    bn: '🚨 আপনার পালা! অনুগ্রহ করে {department} {room} এ যান',
    hi: '🚨 आपकी बारी! कृपया {department} {room} पर जाएं',
  },
  lab_results: {
    ar: '🔬 نتائج الفحوصات جاهزة!\nعرض النتائج: {link}',
    en: '🔬 Your lab results are ready!\nView results: {link}',
    ur: '🔬 آپ کے لیب کے نتائج تیار ہیں!\nنتائج دیکھیں: {link}',
    tl: '🔬 Ang iyong mga resulta ng lab ay handa na!\nTingnan ang mga resulta: {link}',
    bn: '🔬 আপনার ল্যাব ফলাফল প্রস্তুত!\nফলাফল দেখুন: {link}',
    hi: '🔬 आपकी लैब रिपोर्ट तैयार है!\nपरिणाम देखें: {link}',
  },
  check_in_confirmation: {
    ar: '✅ تم تسجيل حضورك. رقمك: #{queueNumber}',
    en: '✅ Checked in successfully. Your number: #{queueNumber}',
    ur: '✅ چیک ان کامیاب۔ آپ کا نمبر: #{queueNumber}',
    tl: '✅ Matagumpay na nag-check in. Iyong numero: #{queueNumber}',
    bn: '✅ সফলভাবে চেক ইন হয়েছে। আপনার নম্বর: #{queueNumber}',
    hi: '✅ सफलतापूर्वक चेक इन। आपका नंबर: #{queueNumber}',
  },
};

// Kiosk UI labels
export const kioskLabels: Record<string, Record<SupportedLanguage, string>> = {
  welcome: {
    ar: 'مرحباً بك في العيادة',
    en: 'Welcome to the Clinic',
    ur: 'کلینک میں خوش آمدید',
    tl: 'Maligayang pagdating sa Klinika',
    bn: 'ক্লিনিকে স্বাগতম',
    hi: 'क्लिनिक में आपका स्वागत है',
  },
  select_language: {
    ar: 'اختر لغتك',
    en: 'Select your language',
    ur: 'اپنی زبان منتخب کریں',
    tl: 'Piliin ang iyong wika',
    bn: 'আপনার ভাষা নির্বাচন করুন',
    hi: 'अपनी भाषा चुनें',
  },
  new_patient: {
    ar: 'مريض جديد',
    en: 'New Patient',
    ur: 'نیا مریض',
    tl: 'Bagong Pasyente',
    bn: 'নতুন রোগী',
    hi: 'नया मरीज',
  },
  returning_patient: {
    ar: 'مريض سابق',
    en: 'Returning Patient',
    ur: 'واپسی والا مریض',
    tl: 'Bumalik na Pasyente',
    bn: 'ফিরতি রোগী',
    hi: 'पुराना मरीज',
  },
  national_id: {
    ar: 'رقم الهوية الوطنية',
    en: 'National ID',
    ur: 'قومی شناختی کارڈ',
    tl: 'National ID',
    bn: 'জাতীয় পরিচয়পত্র',
    hi: 'राष्ट्रीय पहचान पत्र',
  },
  full_name: {
    ar: 'الاسم الكامل',
    en: 'Full Name',
    ur: 'پورا نام',
    tl: 'Buong Pangalan',
    bn: 'পুরো নাম',
    hi: 'पूरा नाम',
  },
  phone_number: {
    ar: 'رقم الجوال',
    en: 'Phone Number',
    ur: 'فون نمبر',
    tl: 'Numero ng Telepono',
    bn: 'ফোন নম্বর',
    hi: 'फोन नंबर',
  },
  department: {
    ar: 'القسم',
    en: 'Department',
    ur: 'شعبہ',
    tl: 'Department',
    bn: 'বিভাগ',
    hi: 'विभाग',
  },
  register: {
    ar: 'تسجيل',
    en: 'Register',
    ur: 'رجسٹر',
    tl: 'Mag-register',
    bn: 'নিবন্ধন',
    hi: 'पंजीकरण',
  },
  check_in: {
    ar: 'تسجيل الحضور',
    en: 'Check In',
    ur: 'چیک ان',
    tl: 'Mag-check in',
    bn: 'চেক ইন',
    hi: 'चेक इन',
  },
  your_ticket: {
    ar: 'تذكرتك',
    en: 'Your Ticket',
    ur: 'آپ کا ٹکٹ',
    tl: 'Iyong Tiket',
    bn: 'আপনার টিকিট',
    hi: 'आपका टिकट',
  },
  queue_number: {
    ar: 'رقم الدور',
    en: 'Queue Number',
    ur: 'قطار نمبر',
    tl: 'Numero ng Pila',
    bn: 'সারি নম্বর',
    hi: 'कतार संख्या',
  },
  estimated_wait: {
    ar: 'الوقت المتوقع للانتظار',
    en: 'Estimated Wait',
    ur: 'تخمینی وقت',
    tl: 'Tinatayang Paghihintay',
    bn: 'আনুমানিক অপেক্ষা',
    hi: 'अनुमानित प्रतीक्षा',
  },
  minutes: {
    ar: 'دقيقة',
    en: 'minutes',
    ur: 'منٹ',
    tl: 'minuto',
    bn: 'মিনিট',
    hi: 'मिनट',
  },
  please_wait: {
    ar: 'يرجى الانتظار حتى يتم استدعاؤك',
    en: 'Please wait until you are called',
    ur: 'براہ کرم اپنی باری کا انتظار کریں',
    tl: 'Mangyaring maghintay hanggang tawagin ka',
    bn: 'অনুগ্রহ করে অপেক্ষা করুন',
    hi: 'कृपया प्रतीक्षा करें',
  },
  insurance_id: {
    ar: 'رقم التأمين',
    en: 'Insurance ID',
    ur: 'انشورنس آئی ڈی',
    tl: 'Insurance ID',
    bn: 'বীমা আইডি',
    hi: 'बीमा आईडी',
  },
  invalid_national_id: {
    ar: 'رقم الهوية غير صحيح',
    en: 'Invalid National ID',
    ur: 'غلط قومی شناختی نمبر',
    tl: 'Hindi wastong National ID',
    bn: 'অবৈধ জাতীয় পরিচয়',
    hi: 'अमान्य राष्ट्रीय पहचान',
  },
  patient_not_found: {
    ar: 'لم يتم العثور على المريض',
    en: 'Patient not found',
    ur: 'مریض نہیں ملا',
    tl: 'Hindi natagpuan ang pasyente',
    bn: 'রোগী পাওয়া যায়নি',
    hi: 'मरीज नहीं मिला',
  },
  error_occurred: {
    ar: 'حدث خطأ. يرجى المحاولة مرة أخرى',
    en: 'An error occurred. Please try again.',
    ur: 'خرابی ہوئی۔ دوبارہ کوشش کریں',
    tl: 'May naganap na error. Subukan muli.',
    bn: 'একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।',
    hi: 'एक त्रुटि हुई। कृपया पुन: प्रयास करें।',
  },
};

export class I18nService {
  /**
   * Get a translated message with parameter substitution.
   */
  getMessage(key: string, language: SupportedLanguage, params?: Record<string, string | number>): string {
    const template = messages[key]?.[language] || messages[key]?.['en'] || key;

    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : match;
    });
  }

  /**
   * Get a kiosk UI label.
   */
  getLabel(key: string, language: SupportedLanguage): string {
    return kioskLabels[key]?.[language] || kioskLabels[key]?.['en'] || key;
  }

  /**
   * Get all kiosk labels for a language.
   */
  getAllLabels(language: SupportedLanguage): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const [key, translations] of Object.entries(kioskLabels)) {
      labels[key] = translations[language] || translations['en'] || key;
    }
    return labels;
  }
}

export const i18nService = new I18nService();
