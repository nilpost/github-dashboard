// Client-side helpers for the double-submit CSRF scheme. The server sets a
// JS-readable `csrfToken` cookie; we read it and echo it in the x-csrf-token
// header on every state-changing request.

export function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Return the current token, fetching the bootstrap endpoint if the cookie
// isn't present yet (e.g. a mutation fires before any page load set it).
export async function ensureCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;

  const res = await fetch("/api/csrf", { credentials: "include" });
  if (res.ok) {
    const body = await res.json().catch(() => ({} as { csrfToken?: string }));
    if (body?.csrfToken) return body.csrfToken as string;
  }
  return readCsrfCookie() ?? "";
}

// Headers to merge into a mutating fetch.
export async function csrfHeaders(): Promise<Record<string, string>> {
  const token = await ensureCsrfToken();
  return token ? { "x-csrf-token": token } : {};
}
