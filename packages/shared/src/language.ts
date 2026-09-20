export type ActiveLanguageCode = "en" | "hi";
export type LanguageDirection = "LTR" | "RTL";
export type LanguageStatus =
  "SUPPORTED" | "PARTIALLY_SUPPORTED" | "COMING_SOON" | "UNSUPPORTED";

export interface RegistryLanguageProfile {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  locale: string;
  direction: LanguageDirection;
  uiSupported: boolean;
  speechSupported: boolean;
  textSupported: boolean;
  translationSupported: boolean;
  ttsSupported: boolean;
  clinicalGlossaryAvailable: boolean;
  status: LanguageStatus;
}

const future = (
  code: string,
  name: string,
  nativeName: string,
  script: string,
  direction: LanguageDirection = "LTR",
): RegistryLanguageProfile => ({
  code,
  name,
  nativeName,
  script,
  locale: `en-IN`,
  direction,
  uiSupported: false,
  speechSupported: false,
  textSupported: false,
  translationSupported: false,
  ttsSupported: false,
  clinicalGlossaryAvailable: false,
  status: "COMING_SOON",
});

export const languageRegistry: readonly RegistryLanguageProfile[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "LATN",
    locale: "en-IN",
    direction: "LTR",
    uiSupported: true,
    speechSupported: true,
    textSupported: true,
    translationSupported: true,
    ttsSupported: false,
    clinicalGlossaryAvailable: true,
    status: "SUPPORTED",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "DEVA",
    locale: "hi-IN",
    direction: "LTR",
    uiSupported: true,
    speechSupported: true,
    textSupported: true,
    translationSupported: true,
    ttsSupported: false,
    clinicalGlossaryAvailable: true,
    status: "SUPPORTED",
  },
  future("ta", "Tamil", "தமிழ்", "TAML"),
  future("te", "Telugu", "తెలుగు", "TELU"),
  future("mr", "Marathi", "मराठी", "DEVA"),
  future("bn", "Bengali", "বাংলা", "BENG"),
  future("gu", "Gujarati", "ગુજરાતી", "GUJR"),
  future("kn", "Kannada", "ಕನ್ನಡ", "KNDA"),
  future("ml", "Malayalam", "മലയാളം", "MLYM"),
  future("pa", "Punjabi", "ਪੰਜਾਬੀ", "GURU"),
  future("or", "Odia", "ଓଡ଼ିଆ", "ORYA"),
  future("ur", "Urdu", "اردو", "ARAB", "RTL"),
] as const;

export const localeMessages = {
  en: {
    "common.continue": "Continue",
    "common.back": "Back",
    "common.tryAgain": "Try again",
    "common.typeInstead": "Type instead",
    "common.review": "Review",
    "common.edit": "Edit",
    "common.yes": "Yes",
    "common.no": "No",
    "common.notSure": "Not sure",
    "common.preferNot": "Prefer not to answer",
    "navigation.language": "Language",
    "patient.language.title": "Choose your language",
    "patient.language.subtitle":
      "You can change this later without losing your answers.",
    "patient.language.available": "Available",
    "patient.language.comingSoon": "Coming soon",
    "patient.complaint.title": "Tell us what you're experiencing.",
    "patient.complaint.placeholder": "Describe what is troubling you",
    "consent.title": "Your privacy and consent",
    "consent.accept": "I understand and agree",
    "interview.progress": "Health history progress",
    "interview.confirm": "Sounds right",
    "interview.clarification":
      "Please confirm this answer. We may need one short clarification.",
    "voice.start": "Tap to speak",
    "voice.listening": "Listening",
    "voice.failure": "We couldn't understand that. Please try again.",
    "documents.original": "Original document",
    "documents.extracted": "Original extracted text",
    "timeline.original": "Original patient wording",
    "comparison.changed": "Changed",
    "clinicalBrief.title": "Clinical Brief",
    "verification.original": "Original source",
    "verification.normalized": "Normalized fact",
    "verification.verified": "Doctor verified",
    "ayush.AYURVEDA": "Ayurveda",
    "ayush.YOGA_NATUROPATHY": "Yoga and Naturopathy",
    "ayush.UNANI": "Unani",
    "ayush.SIDDHA": "Siddha",
    "ayush.HOMOEOPATHY": "Homoeopathy",
    "safety.attention":
      "Some of your answers may need additional attention from the clinical team.",
    "errors.languageMismatch":
      "We may not be able to understand this language yet.",
    "errors.generic": "Something went wrong. Please try again.",
    "success.saved": "Saved",
    "accessibility.changeLanguage": "Change language",
  },
  hi: {
    "common.continue": "आगे बढ़ें",
    "common.back": "वापस",
    "common.tryAgain": "फिर से कोशिश करें",
    "common.typeInstead": "लिखकर बताएं",
    "common.review": "समीक्षा",
    "common.edit": "बदलें",
    "common.yes": "हाँ",
    "common.no": "नहीं",
    "common.notSure": "पता नहीं",
    "common.preferNot": "उत्तर नहीं देना चाहते",
    "navigation.language": "भाषा",
    "patient.language.title": "अपनी भाषा चुनें",
    "patient.language.subtitle":
      "आप अपने उत्तर खोए बिना बाद में भाषा बदल सकते हैं।",
    "patient.language.available": "उपलब्ध",
    "patient.language.comingSoon": "जल्द उपलब्ध",
    "patient.complaint.title": "आपको क्या परेशानी हो रही है, हमें बताएं।",
    "patient.complaint.placeholder": "अपनी परेशानी के बारे में बताएं",
    "consent.title": "आपकी गोपनीयता और सहमति",
    "consent.accept": "मैं समझता/समझती हूँ और सहमत हूँ",
    "interview.progress": "स्वास्थ्य जानकारी की प्रगति",
    "interview.confirm": "यह सही है",
    "interview.clarification":
      "कृपया इस उत्तर की पुष्टि करें। हमें एक छोटा सवाल पूछना पड़ सकता है।",
    "voice.start": "बोलना शुरू करें",
    "voice.listening": "सुन रहे हैं",
    "voice.failure": "हम इसे समझ नहीं पाए। कृपया फिर से बोलें।",
    "documents.original": "मूल दस्तावेज़",
    "documents.extracted": "मूल निकाला गया पाठ",
    "timeline.original": "रोगी के मूल शब्द",
    "comparison.changed": "बदला हुआ",
    "clinicalBrief.title": "क्लिनिकल सारांश",
    "verification.original": "मूल स्रोत",
    "verification.normalized": "सामान्यीकृत तथ्य",
    "verification.verified": "डॉक्टर द्वारा सत्यापित",
    "ayush.AYURVEDA": "आयुर्वेद",
    "ayush.YOGA_NATUROPATHY": "योग और प्राकृतिक चिकित्सा",
    "ayush.UNANI": "यूनानी",
    "ayush.SIDDHA": "सिद्ध",
    "ayush.HOMOEOPATHY": "होम्योपैथी",
    "safety.attention":
      "आपके कुछ उत्तरों पर चिकित्सकीय टीम द्वारा अतिरिक्त ध्यान देने की आवश्यकता हो सकती है।",
    "errors.languageMismatch":
      "हो सकता है कि हम अभी इस भाषा को ठीक से न समझ पाएं।",
    "errors.generic": "कुछ गलत हुआ। कृपया फिर से कोशिश करें।",
    "success.saved": "सहेजा गया",
    "accessibility.changeLanguage": "भाषा बदलें",
  },
} as const;

export type LocaleMessageKey = keyof (typeof localeMessages)["en"];

export function translateMessage(
  language: ActiveLanguageCode,
  key: LocaleMessageKey,
): string {
  return localeMessages[language][key] ?? localeMessages.en[key];
}
