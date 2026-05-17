/**
 * Sandbox token for bundled plugin previews served from `/api/plugins/:id/preview`.
 *
 * **`allow-scripts` alone uses an opaque document origin.** Subresource loads can then
 * surface Chromium warnings such as “Unsafe attempt to load URL … from frame … —
 * domains, protocols and ports must match”.
 *
 * Granting **`allow-same-origin`** restores the iframe’s tuple origin while the daemon still
 * applies the §9.2 preview CSP boundary. Combining `allow-scripts` + `allow-same-origin` on a
 * same-origin document can theoretically allow escaping the iframe sandbox; OD plugin previews
 * are first-party bundles with strict CSP, so we accept that trade-off for workable HTML decks.
 *
 * **`allow-popups`** lets authored links that use `target="_blank"` behave like normal tabs.
 *
 * @see `apps/web/src/runtime/srcdoc.ts` — srcDoc-hosted previews omit `allow-same-origin`
 * deliberately for untrusted artifact HTML.
 */
export const PLUGIN_PREVIEW_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-popups' as const;
