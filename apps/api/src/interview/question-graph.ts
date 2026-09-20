import type { InterviewInputType, InterviewQuestionDto } from "@helios/shared";

export type PathwayId =
  | "abdominal_pain"
  | "chest_discomfort"
  | "headache"
  | "fever"
  | "cough_breathing"
  | "general_pain";

export interface QuestionDefinition extends InterviewQuestionDto {
  field: string;
  pathway: PathwayId | "common";
  dependsOn?: { field: string; includes: string };
}

export const ayushQuestions: QuestionDefinition[] = [
  {
    id: "common.bloodPressureProblem",
    pathway: "common",
    field: "bloodPressureProblem",
    category: "MEDICAL_HISTORY",
    text: "Have you ever been told that you have a blood pressure problem?",
    alternativeText: "This includes high or low blood pressure.",
    inputType: "YES_NO",
    options: ["Yes", "No", "Not sure", "Prefer not to answer"],
    required: true,
    priority: 60,
  },
  {
    id: "common.diabetesProblem",
    pathway: "common",
    field: "diabetesProblem",
    category: "MEDICAL_HISTORY",
    text: "Have you ever been told that you have diabetes?",
    inputType: "YES_NO",
    options: ["Yes", "No", "Not sure", "Prefer not to answer"],
    required: true,
    priority: 59,
  },
  {
    id: "common.ayushUse",
    pathway: "common",
    field: "ayushUse",
    category: "AYUSH",
    text: "Are you currently using any AYUSH treatment or medicine?",
    alternativeText: "क्या आप अभी कोई आयुष उपचार या दवा ले रहे हैं?",
    inputType: "YES_NO",
    options: ["Yes", "No", "Not sure", "Prefer not to answer"],
    required: true,
    priority: 30,
    helpText:
      "This includes Ayurveda, Yoga/Naturopathy, Unani, Siddha, and Homoeopathy.",
  },
  {
    id: "common.ayushSystem",
    pathway: "common",
    field: "ayushSystem",
    category: "AYUSH",
    text: "Which AYUSH system is it?",
    inputType: "CHOICE",
    options: [
      "Ayurveda",
      "Yoga/Naturopathy",
      "Unani",
      "Siddha",
      "Homoeopathy",
      "Other",
      "Not sure",
    ],
    required: true,
    priority: 29,
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushTreatment",
    pathway: "common",
    field: "ayushTreatment",
    category: "AYUSH",
    text: "What treatment or medicine are you using?",
    inputType: "TEXT",
    required: true,
    priority: 28,
    helpText:
      "Use the name on the package or document. It is okay if the name is not known.",
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushRecommendedBy",
    pathway: "common",
    field: "ayushRecommendedBy",
    category: "AYUSH",
    text: "Who recommended it?",
    inputType: "TEXT",
    required: true,
    priority: 27,
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushStarted",
    pathway: "common",
    field: "ayushStarted",
    category: "AYUSH",
    text: "When did you start using it?",
    inputType: "DATE",
    required: true,
    priority: 26,
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushUseStatus",
    pathway: "common",
    field: "ayushUseStatus",
    category: "AYUSH",
    text: "Are you using it now?",
    inputType: "CHOICE",
    options: ["Current", "Used in the past", "Stopped", "Not sure"],
    required: true,
    priority: 25,
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushNewSymptoms",
    pathway: "common",
    field: "ayushNewSymptoms",
    category: "AYUSH",
    text: "Have you noticed any new symptoms after starting it?",
    inputType: "YES_NO",
    options: ["Yes", "No", "Not sure", "Prefer not to answer"],
    required: true,
    priority: 24,
    dependsOn: { field: "ayushUse", includes: "true" },
  },
  {
    id: "common.ayushReportedEffect",
    pathway: "common",
    field: "ayushReportedEffect",
    category: "AYUSH",
    text: "What symptom did you notice, and when did it begin?",
    inputType: "LONG_TEXT",
    required: true,
    priority: 23,
    dependsOn: { field: "ayushNewSymptoms", includes: "true" },
  },
];

const choice = (
  id: string,
  pathway: PathwayId,
  field: string,
  text: string,
  options: string[],
  priority: number,
  required = true,
): QuestionDefinition => ({
  id,
  pathway,
  field,
  category: "HPI",
  text,
  inputType: "CHOICE",
  options: [...options, "Not sure", "Prefer not to answer"],
  required,
  priority,
});

const standard = (
  pathway: PathwayId,
  locationOptions: string[],
  associatedOptions: string[],
): QuestionDefinition[] => [
  choice(
    `${pathway}.location`,
    pathway,
    "location",
    "Where do you feel it?",
    locationOptions,
    100,
  ),
  {
    id: `${pathway}.duration`,
    pathway,
    field: "duration",
    category: "HPI",
    text: "How long has this been happening?",
    alternativeText: "When did this begin?",
    inputType: "DURATION",
    options: ["Today", "1–3 days", "About a week", "Longer", "Not sure"],
    required: true,
    priority: 95,
  },
  {
    id: `${pathway}.severity`,
    pathway,
    field: "severity",
    category: "HPI",
    text: "How strong is it from 0 to 10?",
    alternativeText: "Choose the number that best matches how strong it feels.",
    inputType: "SLIDER",
    required: true,
    priority: 90,
  },
  {
    id: `${pathway}.associatedSymptoms`,
    pathway,
    field: "associatedSymptoms",
    category: "HPI",
    text: "Are you noticing any of these with it?",
    inputType: "MULTI_SELECT",
    options: [...associatedOptions, "None of these", "Not sure"],
    required: true,
    priority: 85,
  },
];

export const questionGraph: Record<PathwayId, QuestionDefinition[]> = {
  abdominal_pain: [
    ...standard(
      "abdominal_pain",
      [
        "Upper abdomen",
        "Lower abdomen",
        "Around the navel",
        "Left side",
        "Right side",
        "Other",
      ],
      ["Vomiting or nausea", "Fever", "Loose stools", "Constipation"],
    ),
    {
      id: "abdominal_pain.vomitingFrequency",
      pathway: "abdominal_pain",
      field: "vomitingFrequency",
      category: "HPI",
      text: "How often have you vomited?",
      inputType: "TEXT",
      required: true,
      priority: 80,
      dependsOn: { field: "associatedSymptoms", includes: "vomit" },
    },
    {
      id: "abdominal_pain.character",
      pathway: "abdominal_pain",
      field: "character",
      category: "HPI",
      text: "How would you describe the pain?",
      inputType: "CHOICE",
      options: ["Cramping", "Burning", "Sharp", "Dull", "Not sure"],
      required: false,
      priority: 40,
    },
  ],
  chest_discomfort: standard(
    "chest_discomfort",
    ["Centre of chest", "Left side", "Right side", "All over", "Other"],
    ["Shortness of breath", "Sweating", "Nausea", "Dizziness"],
  ),
  headache: standard(
    "headache",
    ["Front", "Back", "One side", "Both sides", "All over"],
    ["Nausea", "Light sensitivity", "Sound sensitivity", "Vision change"],
  ),
  fever: standard(
    "fever",
    ["Whole body", "Not applicable"],
    ["Chills", "Body ache", "Cough", "Sore throat"],
  ),
  cough_breathing: standard(
    "cough_breathing",
    ["Throat", "Chest", "Both", "Not sure"],
    ["Phlegm", "Fever", "Wheezing", "Shortness of breath"],
  ),
  general_pain: standard(
    "general_pain",
    ["Head", "Chest", "Abdomen", "Back", "Arm or leg", "Other"],
    ["Fever", "Swelling", "Weakness", "Nausea"],
  ),
};

export function publicQuestion(
  question: QuestionDefinition,
): InterviewQuestionDto {
  const {
    pathway: _pathway,
    field: _field,
    dependsOn: _dependsOn,
    ...dto
  } = question;
  void _pathway;
  void _field;
  void _dependsOn;
  return dto;
}

export const supportedInputTypes: readonly InterviewInputType[] = [
  "TEXT",
  "LONG_TEXT",
  "VOICE",
  "CHOICE",
  "MULTI_SELECT",
  "YES_NO",
  "NUMBER",
  "DATE",
  "DURATION",
  "SLIDER",
];
