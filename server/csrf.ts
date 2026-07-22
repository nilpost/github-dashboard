import { randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

export const CSRF_COOKIE = "csrfToken";
export const CSRF_HEADER = "x-csrf-token";

// Methods that don't mutate state don't need a token; they also serve as the
// bootstrap that hands the client its token cookie.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which itself leaks length; guard
  // first and compare in constant time only when lengths match.
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Double-submit-cookie CSRF protection.
 *
 * Every response carries a random, JS-readable `csrfToken` cookie. For any
 * state-changing request the client must echo that value in the
 * `x-csrf-token` header; a forged cross-site request can send the cookie
 * (browsers attach it automatically) but cannot read it to set the header,
 * so the two won't match. The token is exposed as `req.csrfToken` for a
 * bootstrap endpoint to return.
 */
export function csrfProtection(isProduction: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.[CSRF_COOKIE] as string | undefined;

    if (!token) {
      token = randomBytes(32).toString("hex");
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // the client must read it to echo it back in a header
        sameSite: "lax",
        secure: isProduction,
        path: "/",
      });
    }

    // Expose the current token so a bootstrap endpoint can return it.
    (req as Request & { csrfToken?: string }).csrfToken = token;

    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const header = req.get(CSRF_HEADER);
    if (!header || !safeEqual(header, token)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    next();
  };
}
