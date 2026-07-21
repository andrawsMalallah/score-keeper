/**
 * Stamps data-theme on <html> before the first paint.
 *
 * This has to run as a blocking inline script rather than in an effect: React
 * hydration happens after paint, so resolving the theme in a component would
 * show a flash of the wrong theme on every load. Reading localStorage here is
 * safe because the script only runs in the browser.
 *
 * Kept deliberately tiny and dependency-free — it is inlined into the HTML.
 */

/** Where the user's explicit choice lives. Shared with the theme store. */
export const THEME_STORAGE_KEY = 'score-keeper-theme'

const script = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // An explicit choice wins; otherwise follow the OS, defaulting to the
    // dark "nocturnal table" theme the design treats as primary.
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // Private browsing can throw on localStorage; the dark default still applies.
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export function ThemeScript() {
  return (
    <script
      // The content is a fixed string with no user input, so there is nothing
      // to inject here; this is the standard no-flash theme pattern.
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  )
}
