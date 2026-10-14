import { useCallback, useContext } from "react"
import { StoreApi, useStore } from "zustand"
import en from "../../../i18n/en/editor.json"
import lb from "../../../i18n/lb/editor.json"
import de from "../../../i18n/de/editor.json"
import fr from "../../../i18n/fr/editor.json"
import es from "../../../i18n/es/editor.json"
import ca from "../../../i18n/ca/editor.json"
import { MetadataStoreContext } from "@/store/context"
import { Locale } from "@/typings"

/**
 * Editor-chrome translations (palette, inspectors, popovers, toolbars).
 *
 * The strings live in `packages/i18n/<locale>/editor.json`, shared with the
 * webapp's translation tooling (`npm run i18n:check`). Keys are dotted paths
 * into that bundle, e.g. `packages.AgentDiagram.AgentState`.
 *
 * Lookup order: active locale → English → the caller's fallback → the key.
 */

type Bundle = Record<string, unknown>

const dictionary: Record<Locale, Bundle> = {
  [Locale.en]: en,
  [Locale.lb]: lb,
  [Locale.de]: de,
  [Locale.fr]: fr,
  [Locale.es]: es,
  [Locale.ca]: ca,
}

export type TranslationParams = Record<string, string | number>

/**
 * Walk a dotted key into a bundle. Every kind of miss returns `undefined`
 * (missing segment, a segment that is an object rather than a leaf), so a
 * key that exists in `en` but not yet in a locale falls through to English.
 */
const resolve = (key: string, bundle: Bundle | undefined): string | undefined => {
  let current: unknown = bundle
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === "string" ? current : undefined
}

/**
 * Replaces `{{name}}` placeholders (the i18next syntax the bundles use) and
 * the single-brace `{name}` form some older editor strings use (e.g.
 * `popup.nn.row.dim` = "Dim {n}:"). Only placeholders with a matching
 * param are replaced, so literal braces in a string (e.g. a hint that
 * shows `{user_message}` to the user) survive untouched.
 */
const interpolate = (text: string, params?: TranslationParams): string =>
  params
    ? text.replace(
        /\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g,
        (match, doubleName: string | undefined, singleName: string | undefined) => {
          const name = (doubleName ?? singleName) as string
          return Object.prototype.hasOwnProperty.call(params, name)
            ? String(params[name])
            : match
        }
      )
    : text

export const translate = (
  key: string,
  fallback?: string,
  locale: Locale = Locale.en,
  params?: TranslationParams
): string => {
  const text =
    resolve(key, dictionary[locale]) ??
    resolve(key, dictionary[Locale.en]) ??
    fallback ??
    key
  return interpolate(text, params)
}

/** True when the key resolves in English (useful for optional labels). */
export const hasTranslation = (key: string): boolean =>
  resolve(key, dictionary[Locale.en]) !== undefined

export type Translate = (
  key: string,
  fallback?: string,
  params?: TranslationParams
) => string

// Outside an editor (e.g. a palette preview rendered on its own) there is no
// metadata store; those renders use English.
const englishState = { locale: Locale.en }
const noStore = {
  getState: () => englishState,
  getInitialState: () => englishState,
  subscribe: () => () => {},
  setState: () => {},
}

/**
 * Translation hook for library components. Re-renders when the editor's
 * locale changes (`editor.locale = …` / `setLocale`).
 */
export const useTranslation = (): { t: Translate; locale: Locale } => {
  const store = useContext(MetadataStoreContext)
  const locale = useStore(
    (store ?? noStore) as unknown as StoreApi<{ locale: Locale }>,
    (state) => state.locale
  )
  // Stable per locale, so `t` is safe in memo/effect dependency lists.
  const t: Translate = useCallback(
    (key, fallback, params) => translate(key, fallback, locale, params),
    [locale]
  )
  return { t, locale }
}
