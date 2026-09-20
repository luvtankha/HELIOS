import type { InterviewQuestionDto, LanguageCode } from "@helios/shared";

const hindiQuestions: Record<string, string> = {
  "common.bloodPressureProblem": "क्या आपको कभी बताया गया है कि आपको ब्लड प्रेशर की समस्या है?",
  "common.diabetesProblem": "क्या आपको कभी बताया गया है कि आपको मधुमेह या डायबिटीज़ है?",
  "common.ayushUse": "क्या आप अभी कोई आयुष उपचार या दवा ले रहे हैं?",
  "common.ayushSystem": "यह किस आयुष पद्धति से जुड़ा है?",
  "common.ayushTreatment": "आप कौन सा उपचार या दवा ले रहे हैं?",
  "common.ayushRecommendedBy": "इसकी सलाह किसने दी?",
  "common.ayushStarted": "आपने इसे कब शुरू किया?",
  "common.ayushUseStatus": "क्या आप अभी इसका उपयोग कर रहे हैं?",
  "common.ayushNewSymptoms": "इसे शुरू करने के बाद कोई नया लक्षण महसूस हुआ?",
  "common.ayushReportedEffect": "कौन सा लक्षण महसूस हुआ और कब शुरू हुआ?",
  "abdominal_pain.location": "दर्द कहाँ हो रहा है?",
  "abdominal_pain.duration": "यह परेशानी कितने समय से है?",
  "abdominal_pain.severity": "यह 0 से 10 तक कितना तेज़ है?",
  "abdominal_pain.associatedSymptoms": "क्या इसके साथ इनमें से कुछ हो रहा है?",
  "abdominal_pain.vomitingFrequency": "आपको कितनी बार उल्टी हुई?",
  "abdominal_pain.character": "दर्द कैसा महसूस होता है?",
  "chest_discomfort.location": "सीने में परेशानी कहाँ हो रही है?",
  "chest_discomfort.duration": "यह परेशानी कितने समय से है?",
  "chest_discomfort.severity": "यह 0 से 10 तक कितना तेज़ है?",
  "chest_discomfort.associatedSymptoms":
    "क्या इसके साथ इनमें से कुछ हो रहा है?",
  "headache.location": "सिर में दर्द कहाँ हो रहा है?",
  "headache.duration": "यह दर्द कितने समय से है?",
  "headache.severity": "यह 0 से 10 तक कितना तेज़ है?",
  "headache.associatedSymptoms": "क्या इसके साथ इनमें से कुछ हो रहा है?",
  "fever.location": "बुखार पूरे शरीर में महसूस हो रहा है?",
  "fever.duration": "बुखार कितने समय से है?",
  "fever.severity": "परेशानी 0 से 10 तक कितनी है?",
  "fever.associatedSymptoms": "क्या इसके साथ इनमें से कुछ हो रहा है?",
  "cough_breathing.location": "परेशानी गले में है या सीने में?",
  "cough_breathing.duration": "यह परेशानी कितने समय से है?",
  "cough_breathing.severity": "यह 0 से 10 तक कितनी तेज़ है?",
  "cough_breathing.associatedSymptoms": "क्या इसके साथ इनमें से कुछ हो रहा है?",
  "general_pain.location": "दर्द कहाँ हो रहा है?",
  "general_pain.duration": "यह परेशानी कितने समय से है?",
  "general_pain.severity": "यह 0 से 10 तक कितना तेज़ है?",
  "general_pain.associatedSymptoms": "क्या इसके साथ इनमें से कुछ हो रहा है?",
};

const hindiOptions: Record<string, string> = {
  Yes: "हाँ",
  No: "नहीं",
  "Not sure": "पता नहीं",
  "Prefer not to answer": "उत्तर नहीं देना चाहते",
  Today: "आज",
  "1–3 days": "1–3 दिन",
  "About a week": "लगभग एक सप्ताह",
  Longer: "इससे अधिक",
  "None of these": "इनमें से कोई नहीं",
  "Upper abdomen": "पेट का ऊपरी भाग",
  "Lower abdomen": "पेट का निचला भाग",
  "Around the navel": "नाभि के आसपास",
  "Left side": "बाईं ओर",
  "Right side": "दाईं ओर",
  Other: "अन्य",
  "Vomiting or nausea": "उल्टी या जी मिचलाना",
  Fever: "बुखार",
  "Loose stools": "दस्त",
  Constipation: "कब्ज़",
  "Shortness of breath": "सांस लेने में परेशानी",
  Sweating: "पसीना",
  Nausea: "जी मिचलाना",
  Dizziness: "चक्कर",
  Ayurveda: "आयुर्वेद",
  "Yoga/Naturopathy": "योग/प्राकृतिक चिकित्सा",
  Unani: "यूनानी",
  Siddha: "सिद्ध",
  Homoeopathy: "होम्योपैथी",
  Current: "अभी उपयोग कर रहे हैं",
  "Used in the past": "पहले उपयोग किया था",
  Stopped: "बंद कर दिया",
};

export function localizeQuestion(
  question: InterviewQuestionDto,
  language: LanguageCode,
): InterviewQuestionDto {
  const values = question.options ? [...question.options] : undefined;
  if (language === "en")
    return {
      ...question,
      version: 1,
      displayLanguage: language,
      ...(values && { optionValues: values }),
    };
  const { alternativeText: _alternativeText, ...base } = question;
  void _alternativeText;
  return {
    ...base,
    text: question.id.startsWith("clarify.")
      ? "कृपया अपने पिछले उत्तर की पुष्टि करें।"
      : (hindiQuestions[question.id] ?? question.text),
    ...(values && {
      options: values.map((option) => hindiOptions[option] ?? option),
      optionValues: values,
    }),
    version: 1,
    displayLanguage: language,
  };
}
