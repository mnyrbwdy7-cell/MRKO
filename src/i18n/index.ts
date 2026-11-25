import { dictionaries, type Locale } from "./translations";

export type { Locale };

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const parts = key.split(".");
  let node: unknown = dictionaries[locale];
  for (const part of parts) {
    if (!node || typeof node !== "object") {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "string") {
    // English is the safety net; Arabic is complete and should never need it.
    if (locale !== "en") return translate("en", key, params);
    return key;
  }
  let text = node;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}
