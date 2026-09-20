"use client";

import type { LanguageCode } from "@helios/shared";
import { useEffect, useState } from "react";
import { languageApi } from "@/services/languages";

const KEY = "helios.doctor.display-language";

export function useDoctorLanguage(doctorToken?: string) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  useEffect(() => {
    setLanguageState(localStorage.getItem(KEY) === "hi" ? "hi" : "en");
  }, []);
  function setLanguage(value: LanguageCode) {
    setLanguageState(value);
    localStorage.setItem(KEY, value);
    document.documentElement.lang = value;
    if (doctorToken) void languageApi.setDoctorLanguage(value, doctorToken);
  }
  return { language, setLanguage };
}

export function DoctorLanguageControl(props: {
  language: LanguageCode;
  onChange(value: LanguageCode): void;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 text-sm font-bold">
      <span>
        {props.language === "hi" ? "प्रदर्शन भाषा" : "Display language"}
      </span>
      <select
        aria-label="Doctor display language"
        value={props.language}
        onChange={(event) => props.onChange(event.target.value as LanguageCode)}
        className="bg-transparent outline-none"
      >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
    </label>
  );
}

export function doctorText(
  language: LanguageCode,
  english: string,
  hindi: string,
) {
  return language === "hi" ? hindi : english;
}
