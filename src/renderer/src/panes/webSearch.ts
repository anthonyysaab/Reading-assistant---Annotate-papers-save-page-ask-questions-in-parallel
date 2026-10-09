/** Turns an address-bar entry into a navigable URL: explicit URLs are kept, bare hosts get a
 *  scheme, and everything else becomes a DuckDuckGo query. */
export function toUrlOrSearch(input: string): string {
  const term = input.trim();
  if (!term) return "";
  if (/^https?:\/\//i.test(term)) return term;
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/\S*)?$/i.test(term)) return `http://${term}`;
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(term)) return `https://${term}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(term)}`;
}
