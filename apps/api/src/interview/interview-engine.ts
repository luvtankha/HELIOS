import type {
  ClinicalFactDto,
  InterviewStateDto,
  LanguageCode,
} from "@helios/shared";
import {
  ayushQuestions,
  publicQuestion,
  questionGraph,
  type PathwayId,
  type QuestionDefinition,
} from "./question-graph.js";
import { localizeQuestion } from "./question-localization.js";

export interface NormalizedAnswer {
  field: string;
  value?: unknown;
  state: "YES" | "NO" | "UNKNOWN" | "CONFLICT";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source: "PATIENT_REPORTED" | "AI_STRUCTURED";
  ambiguous?: boolean;
  clarification?: "APPLY" | "KEEP" | "PENDING";
}

export class InterviewEngine {
  initialize(chiefComplaint: string): InterviewStateDto {
    const pathway = classifyComplaint(chiefComplaint);
    const facts: Record<string, ClinicalFactDto> = {
      chiefComplaint: {
        // Keep the patient's accepted wording in the clinical record. The
        // pathway below is the separate internal routing classification.
        value: chiefComplaint.trim(),
        state: "YES",
        source: "PATIENT_REPORTED",
        confidence: "HIGH",
        rawAnswers: [chiefComplaint],
      },
    };
    const duration = extractDuration(chiefComplaint);
    if (duration)
      facts.duration = fact(duration, chiefComplaint, "AI_STRUCTURED");
    if (hasVomiting(chiefComplaint)) {
      facts.associatedSymptoms = fact(
        ["vomiting sensation"],
        chiefComplaint,
        "AI_STRUCTURED",
      );
    }
    return { pathway, facts, unknownFields: [], conflicts: [], conflictCandidates: {} };
  }

  getCurrentQuestion(state: InterviewStateDto, language: LanguageCode = "en") {
    return this.selectNextQuestion(state, language);
  }

  processAnswer(
    state: InterviewStateDto,
    questionId: string,
    rawAnswer: string,
  ): NormalizedAnswer {
    const definition = this.definition(state, questionId);
    const field = questionId.startsWith("clarify.")
      ? questionId.slice(8)
      : definition.field;
    const parsed = normalizeForQuestion(definition, rawAnswer);
    if (questionId.startsWith("clarify."))
      return this.resolveClarification(state, field, parsed);
    const existing = state.facts[field];
    if (
      !questionId.startsWith("clarify.") &&
      existing &&
      existing?.state !== "NOT_ASKED" &&
      existing?.state !== "UNKNOWN" &&
      parsed.state !== "UNKNOWN" &&
      !sameValue(existing.value, parsed.value)
    ) {
      return { ...parsed, field, state: "CONFLICT", confidence: "MEDIUM" };
    }
    return { ...parsed, field };
  }

  updateState(
    state: InterviewStateDto,
    answer: NormalizedAnswer,
    rawAnswer: string,
  ): InterviewStateDto {
    const candidates = { ...(state.conflictCandidates ?? {}) };
    if (answer.state === "CONFLICT") {
      candidates[answer.field] = {
        ...(answer.value !== undefined && { value: answer.value }),
        state: answer.value === false ? "NO" : "YES",
        source: answer.source,
        confidence: answer.confidence,
        rawAnswer,
      };
      return {
        ...state,
        conflicts: Array.from(new Set([...state.conflicts, answer.field])),
        conflictCandidates: candidates,
      };
    }
    // An unrecognised fixed option is not a clinical fact. Keeping the prior
    // state makes the same question repeat rather than recording a guess.
    if (answer.ambiguous && answer.state === "UNKNOWN" && answer.value === undefined)
      return state;
    if (answer.clarification === "PENDING") return state;
    const previous = state.facts[answer.field];
    const facts = {
      ...state.facts,
      [answer.field]: {
        ...(answer.value !== undefined && { value: answer.value }),
        state: answer.state,
        source: answer.source,
        confidence: answer.confidence,
        rawAnswers: [...(previous?.rawAnswers ?? []), rawAnswer],
      },
    };
    const conflicts = answer.ambiguous
      ? Array.from(new Set([...state.conflicts, answer.field]))
      : state.conflicts.filter((field) => field !== answer.field);
    if (answer.clarification === "APPLY" || answer.clarification === "KEEP")
      delete candidates[answer.field];
    const unknownFields =
      answer.state === "UNKNOWN"
        ? Array.from(new Set([...state.unknownFields, answer.field]))
        : state.unknownFields.filter((field) => field !== answer.field);
    return { ...state, facts, conflicts, unknownFields, conflictCandidates: candidates };
  }

  calculateMissingInformation(state: InterviewStateDto): string[] {
    return this.activeQuestions(state)
      .filter(
        (question) =>
          question.required && !isCaptured(state.facts[question.field]),
      )
      .map((question) => question.field);
  }

  selectNextQuestion(state: InterviewStateDto, language: LanguageCode = "en") {
    const conflict = state.conflicts[0];
    if (conflict) {
      return localizeQuestion(
        {
          id: `clarify.${conflict}`,
          category: "CLARIFICATION",
          text: clarificationText(conflict, state.conflictCandidates?.[conflict]?.rawAnswer),
          inputType: "YES_NO" as const,
          options: ["Yes", "No", "Not sure"],
          required: true,
          priority: 1000,
        },
        language,
      );
    }
    const next = this.activeQuestions(state)
      .filter(
        (question) =>
          question.required && !isCaptured(state.facts[question.field]),
      )
      .sort((a, b) => b.priority - a.priority)[0];
    return next ? localizeQuestion(publicQuestion(next), language) : undefined;
  }

  isComplete(state: InterviewStateDto) {
    return (
      this.calculateMissingInformation(state).length === 0 &&
      state.conflicts.length === 0
    );
  }

  getSummary(state: InterviewStateDto) {
    return Object.fromEntries(
      Object.entries(state.facts)
        .filter(([, value]) => value.state !== "NOT_ASKED")
        .map(([key, value]) => [key, value.value ?? value.state]),
    );
  }

  revise(state: InterviewStateDto, field: string): InterviewStateDto {
    if (field === "chiefComplaint")
      throw new Error("Chief complaint is revised separately");
    const definition = this.activeQuestions(state).find(
      (question) => question.field === field,
    );
    if (!definition)
      throw new Error(`Unknown or inactive interview field: ${field}`);
    const previous = state.facts[field];
    return {
      ...state,
      facts: {
        ...state.facts,
        [field]: {
          state: "NOT_ASKED",
          source: previous?.source ?? "PATIENT_REPORTED",
          rawAnswers: previous?.rawAnswers ?? [],
        },
      },
      conflicts: state.conflicts.filter((item) => item !== field),
      unknownFields: state.unknownFields.filter((item) => item !== field),
      conflictCandidates: Object.fromEntries(
        Object.entries(state.conflictCandidates ?? {}).filter(([key]) => key !== field),
      ),
    };
  }

  completeness(state: InterviewStateDto) {
    const required = this.activeQuestions(state).filter(
      (question) => question.required,
    );
    const captured = required.filter((question) =>
      isCaptured(state.facts[question.field]),
    ).length;
    return required.length ? captured / required.length : 1;
  }

  private activeQuestions(state: InterviewStateDto) {
    return [
      ...questionGraph[state.pathway as PathwayId],
      ...ayushQuestions,
    ].filter((question) => {
      if (!question.dependsOn) return true;
      const value = state.facts[question.dependsOn.field]?.value;
      return (JSON.stringify(value) ?? "")
        .toLowerCase()
        .includes(question.dependsOn.includes);
    });
  }

  private definition(state: InterviewStateDto, id: string): QuestionDefinition {
    if (id.startsWith("clarify.")) {
      return {
        id,
        pathway: state.pathway as PathwayId,
        field: id.slice(8),
        category: "CLARIFICATION",
        text: clarificationText(id.slice(8)),
        inputType: "YES_NO",
        options: ["Yes", "No", "Not sure"],
        required: true,
        priority: 1000,
      };
    }
    const found = [
      ...questionGraph[state.pathway as PathwayId],
      ...ayushQuestions,
    ].find((question) => question.id === id);
    if (!found) throw new Error(`Unknown interview question: ${id}`);
    return found;
  }

  private resolveClarification(
    state: InterviewStateDto,
    field: string,
    answer: Omit<NormalizedAnswer, "field">,
  ): NormalizedAnswer {
    const candidate = state.conflictCandidates?.[field];
    const existing = state.facts[field];
    if (!candidate || !existing) {
      return {
        field,
        state: "UNKNOWN",
        confidence: "LOW",
        source: "PATIENT_REPORTED",
        ambiguous: true,
        clarification: "PENDING",
      };
    }
    if (answer.state === "YES") {
      return {
        field,
        ...(candidate.value !== undefined && { value: candidate.value }),
        state: candidate.state === "NO" ? "NO" : "YES",
        confidence: candidate.confidence ?? "HIGH",
        source: "PATIENT_REPORTED",
        clarification: "APPLY",
      };
    }
    if (answer.state === "NO") {
      return {
        field,
        ...(existing.value !== undefined && { value: existing.value }),
        state: existing.state === "NO" ? "NO" : "YES",
        confidence: existing.confidence ?? "HIGH",
        source: "PATIENT_REPORTED",
        clarification: "KEEP",
      };
    }
    return {
      field,
      state: "UNKNOWN",
      confidence: "LOW",
      source: "PATIENT_REPORTED",
      ambiguous: true,
      clarification: "PENDING",
    };
  }
}

function classifyComplaint(text: string): PathwayId {
  const value = text.toLowerCase();
  if (/पेट|\bpet\b|stomach|belly|abdomen|abdominal/.test(value))
    return "abdominal_pain";
  if (/chest|सीने|छाती/.test(value)) return "chest_discomfort";
  if (/headache|head pain|सिर.*दर्द/.test(value)) return "headache";
  if (/fever|बुखार/.test(value)) return "fever";
  if (/cough|खांसी|breath|सांस|wheez/.test(value)) return "cough_breathing";
  return "general_pain";
}

function extractDuration(text: string) {
  const value = text.toLowerCase();
  const match = value.match(
    /(\d+|one|two|three|four|एक|दो|तीन|चार|teen)\s*(day|days|दिन|din)/i,
  );
  if (!match) return undefined;
  const numberMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    एक: 1,
    दो: 2,
    तीन: 3,
    चार: 4,
    teen: 3,
  };
  return {
    value: Number(match[1]) || numberMap[match[1]!.toLowerCase()] || 0,
    unit: "days",
  };
}

function hasVomiting(text: string) {
  return (
    /vomit|nausea|उल्टी|ulti/.test(text.toLowerCase()) &&
    !/no vomit|उल्टी नहीं|ulti nahi/.test(text.toLowerCase())
  );
}

export function isDeterministicInput(inputType: string) {
  return ["YES_NO", "CHOICE", "MULTI_SELECT", "SLIDER"].includes(inputType);
}

function normalizeForQuestion(
  definition: QuestionDefinition,
  raw: string,
): Omit<NormalizedAnswer, "field"> {
  const value = raw.trim();
  if (isExplicitUnknown(value))
    return { state: "UNKNOWN", confidence: "HIGH", source: "PATIENT_REPORTED" };
  if (/^(sometimes|कभी कभी|kabhi kabhi)$/i.test(value))
    return {
      value,
      state: "UNKNOWN",
      confidence: "LOW",
      source: "PATIENT_REPORTED",
      ambiguous: true,
    };
  if (definition.inputType === "YES_NO") return normalizeYesNo(value);
  if (definition.inputType === "SLIDER") {
    const number = extractSeverity(value);
    return number !== undefined
      ? {
          value: number,
          state: "YES",
          confidence: "HIGH",
          source: "PATIENT_REPORTED",
        }
      : invalidFixedOption();
  }
  if (definition.inputType === "MULTI_SELECT") {
    if (/^(none|none of these|no|नहीं|nahi)$/i.test(value))
      return {
        value: [],
        state: "NO",
        confidence: "HIGH",
        source: "PATIENT_REPORTED",
      };
    const values = multiOptions(definition, value);
    return values
      ? {
          value: values,
          state: "YES",
          confidence: "HIGH",
          source: "PATIENT_REPORTED",
        }
      : invalidFixedOption();
  }
  if (definition.inputType === "CHOICE") {
    const selected = fixedOption(definition, value);
    if (!selected) return invalidFixedOption();
    if (definition.field === "ayushSystem")
      return {
        value: normalizeAyushSystem(selected),
        state: "YES",
        confidence: "HIGH",
        source: "AI_STRUCTURED",
      };
    if (definition.field === "ayushUseStatus")
      return {
        value: normalizeAyushUseStatus(selected),
        state: "YES",
        confidence: "HIGH",
        source: "AI_STRUCTURED",
      };
    return {
      value: selected,
      state: "YES",
      confidence: "HIGH",
      source: "PATIENT_REPORTED",
    };
  }
  if (definition.field === "ayushTreatment") {
    const unspecified =
      /^(some|unknown|not known|don't know|pata nahi|कुछ).*(medicine|dawa|दवा)?$/i.test(
        value,
      );
    return {
      value: unspecified ? "NOT_SPECIFIED" : value,
      state: "YES",
      confidence: unspecified ? "MEDIUM" : "HIGH",
      source: "PATIENT_REPORTED",
    };
  }
  if (definition.inputType === "DURATION") {
    const duration = extractDuration(value);
    const option = fixedOption(definition, value);
    return {
      value: duration ?? option ?? value,
      state: "YES",
      confidence: duration || option ? "HIGH" : "MEDIUM",
      source: "AI_STRUCTURED",
    };
  }
  return {
    value,
    state: "YES",
    confidence: "HIGH",
    source: "PATIENT_REPORTED",
  };
}

function normalizeYesNo(value: string): Omit<NormalizedAnswer, "field"> {
  const normalized = normalizePhrase(value);
  if (/^(no|nope|nah|nahi|नहीं)$/.test(normalized))
    return {
      value: false,
      state: "NO",
      confidence: "HIGH",
      source: "PATIENT_REPORTED",
    };
  if (/^(yes|yes please|yeah|yep|haan|ha|हाँ|हां)$/.test(normalized))
    return {
      value: true,
      state: "YES",
      confidence: "HIGH",
      source: "PATIENT_REPORTED",
    };
  return invalidFixedOption();
}

function invalidFixedOption(): Omit<NormalizedAnswer, "field"> {
  return {
    state: "UNKNOWN",
    confidence: "LOW",
    source: "PATIENT_REPORTED",
    ambiguous: true,
  };
}

function fixedOption(definition: QuestionDefinition, raw: string) {
  const options = optionsFor(definition);
  const heard = normalizePhrase(raw);
  const direct = options.find((option) => option.normalized === heard);
  if (direct) return direct.value;
  const ordinal = spokenOrdinal(heard);
  if (ordinal !== undefined && options[ordinal]) return options[ordinal].value;
  const alias = optionAlias(heard);
  if (alias) {
    const option = options.find((item) => item.normalized === alias);
    if (option) return option.value;
  }
  const exactPhrase = options.filter(
    (option) =>
      option.normalized.length >= 3 && containsPhrase(heard, option.normalized),
  );
  return exactPhrase.length === 1 ? exactPhrase[0]!.value : undefined;
}

function multiOptions(definition: QuestionDefinition, raw: string) {
  const options = optionsFor(definition).filter(
    (option) => !["not sure", "prefer not to answer", "none of these"].includes(option.normalized),
  );
  const heard = normalizePhrase(raw);
  const selected = options.filter((option) =>
    containsPhrase(heard, option.normalized),
  );
  if (!selected.length) return undefined;
  let remainder = heard;
  for (const option of selected)
    remainder = remainder.replace(new RegExp(`\\b${escapeRegExp(option.normalized)}\\b`, "g"), " ");
  remainder = remainder
    .replace(/\b(and|or|also|i|have|with|a|the|symptom|symptoms|feel|feeling|experiencing)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (remainder) return undefined;
  return [...new Set(selected.map((option) => option.value))];
}

function optionsFor(definition: QuestionDefinition) {
  return (definition.options ?? []).map((display, index) => ({
    value: definition.optionValues?.[index] ?? display,
    normalized: normalizePhrase(display),
  }));
}

function isExplicitUnknown(value: string) {
  return /^(not sure|i do not know|i don t know|prefer not|prefer not to answer|pata nahi|पता नहीं|उत्तर नहीं देना चाहते)$/.test(
    normalizePhrase(value),
  );
}

function optionAlias(heard: string) {
  if (["yes", "yeah", "yep", "haan", "ha", "हाँ", "हां"].includes(heard))
    return "yes";
  if (["no", "nope", "nah", "nahi", "नहीं"].includes(heard)) return "no";
  return undefined;
}

function spokenOrdinal(value: string) {
  const numeric = value.match(/^(?:option|choice|विकल्प)\s*(?:number\s*)?(10|[1-9])$/)?.[1];
  if (numeric) return Number(numeric) - 1;
  const ordinals: Record<string, number> = {
    first: 0,
    one: 0,
    second: 1,
    two: 1,
    third: 2,
    three: 2,
    fourth: 3,
    four: 3,
    fifth: 4,
    five: 4,
    sixth: 5,
    six: 5,
    seventh: 6,
    seven: 6,
    eighth: 7,
    eight: 7,
    ninth: 8,
    nine: 8,
    tenth: 9,
    ten: 9,
    पहला: 0,
    पहली: 0,
    दूसरा: 1,
    दूसरी: 1,
    तीसरा: 2,
    तीसरी: 2,
    चौथा: 3,
    चौथी: 3,
    पांचवां: 4,
    पाँचवां: 4,
  };
  return ordinals[value];
}

function containsPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePhrase(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015]/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Accept spoken 0–10 ratings returned by English, Hindi, and Hinglish STT. */
function extractSeverity(value: string) {
  const normalized = value
    .toLocaleLowerCase()
    .replace(/[०-९]/g, (digit) => String("०१२३४५६७८९".indexOf(digit)))
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ");
  const numeric = normalized.match(/(?:^|\s)(10|[0-9])(?:\s|$)/)?.[1];
  if (numeric !== undefined) return Number(numeric);
  const words: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    shunya: 0,
    ek: 1,
    do: 2,
    teen: 3,
    char: 4,
    chaar: 4,
    panch: 5,
    paanch: 5,
    che: 6,
    chhe: 6,
    saat: 7,
    sat: 7,
    aath: 8,
    ath: 8,
    nau: 9,
    das: 10,
    शून्य: 0,
    एक: 1,
    दो: 2,
    तीन: 3,
    चार: 4,
    पांच: 5,
    पाँच: 5,
    छह: 6,
    छः: 6,
    सात: 7,
    आठ: 8,
    नौ: 9,
    दस: 10,
  };
  return normalized.split(/\s+/).map((word) => words[word]).find((rating) => rating !== undefined);
}

function normalizeAyushSystem(value: string) {
  const normalized = value.trim().toLowerCase();
  const exact: Record<string, string> = {
    ayurveda: "AYURVEDA",
    आयुर्वेद: "AYURVEDA",
    ஆயுர்வேதம்: "AYURVEDA",
    "yoga/naturopathy": "YOGA_NATUROPATHY",
    yoga: "YOGA_NATUROPATHY",
    naturopathy: "YOGA_NATUROPATHY",
    unani: "UNANI",
    यूनानी: "UNANI",
    siddha: "SIDDHA",
    homoeopathy: "HOMOEOPATHY",
    homeopathy: "HOMOEOPATHY",
    other: "OTHER_TRADITIONAL_SYSTEM",
  };
  return exact[normalized] ?? "UNKNOWN";
}

function normalizeAyushUseStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["current", "yes", "currently"].includes(normalized)) return "CURRENT";
  if (["used in the past", "historical", "past"].includes(normalized))
    return "HISTORICAL";
  if (["stopped", "discontinued"].includes(normalized)) return "STOPPED";
  return "UNKNOWN";
}

function fact(
  value: unknown,
  raw: string,
  source: "PATIENT_REPORTED" | "AI_STRUCTURED",
): ClinicalFactDto {
  return { value, state: "YES", source, confidence: "HIGH", rawAnswers: [raw] };
}

function isCaptured(factValue?: ClinicalFactDto) {
  return Boolean(
    factValue &&
    factValue.state !== "NOT_ASKED" &&
    factValue.state !== "CONFLICT",
  );
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clarificationText(field: string, candidate?: string) {
  const label = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return candidate
    ? `Just to confirm, is your latest answer about ${label} — ${candidate} — correct?`
    : `Just to confirm, is your latest answer about ${label} correct?`;
}
