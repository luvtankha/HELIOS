import {
  localeMessages,
  type LanguageCode,
  type TranslationContext,
  type TranslationDto,
} from "@helios/shared";

export interface TranslationProvider {
  readonly id: string;
  translate(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
    contextType: TranslationContext;
  }): Promise<TranslationDto>;
  translateBatch(
    inputs: Array<{
      text: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      contextType: TranslationContext;
    }>,
  ): Promise<TranslationDto[]>;
  supportedLanguages(): readonly LanguageCode[];
}

export class ApprovedResourceTranslationProvider implements TranslationProvider {
  readonly id = "approved-static-resources-v1";

  translate(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
    contextType: TranslationContext;
  }): Promise<TranslationDto> {
    if (input.sourceLanguage === input.targetLanguage)
      return Promise.resolve(this.result(input, input.text, false));
    const source = localeMessages[input.sourceLanguage];
    const target = localeMessages[input.targetLanguage];
    const key = Object.entries(source).find(
      ([, value]) => value === input.text,
    )?.[0] as keyof typeof source | undefined;
    const translated = key ? target[key] : undefined;
    return Promise.resolve(
      this.result(input, translated ?? input.text, !translated),
    );
  }

  translateBatch(inputs: Parameters<TranslationProvider["translate"]>[0][]) {
    return Promise.all(inputs.map((input) => this.translate(input)));
  }

  supportedLanguages() {
    return ["en", "hi"] as const;
  }

  private result(
    input: Parameters<TranslationProvider["translate"]>[0],
    translatedText: string,
    fallbackUsed: boolean,
  ): TranslationDto {
    const { text, ...languages } = input;
    return {
      ...languages,
      sourceText: text,
      translatedText,
      provider: this.id,
      fallbackUsed,
    };
  }
}

export interface TTSProvider {
  readonly id: string;
  supportedLanguages(): readonly LanguageCode[];
  speak(text: string, language: LanguageCode): Promise<Buffer>;
}
