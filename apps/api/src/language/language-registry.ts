import {
  languageRegistry,
  type LanguageCode,
  type RegistryLanguageProfile,
} from "@helios/shared";
import { AppError } from "../utils/app-error.js";

export class LanguageRegistry {
  list(): RegistryLanguageProfile[] {
    return languageRegistry.map((profile) => ({ ...profile }));
  }

  get(code: string) {
    const profile = languageRegistry.find((item) => item.code === code);
    if (!profile)
      throw new AppError("Language not found", 404, "LANGUAGE_NOT_FOUND");
    return { ...profile };
  }

  active(code: string): LanguageCode {
    const profile = this.get(code);
    if (profile.status !== "SUPPORTED")
      throw new AppError(
        "That language is not available yet",
        400,
        "LANGUAGE_UNSUPPORTED",
      );
    return profile.code as LanguageCode;
  }
}
