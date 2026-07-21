import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AuthUser } from "./types";
import "./types";

// Hash password with scrypt
function hashPassword(password: string, salt?: Buffer): string {
  if (!salt) {
    salt = randomBytes(16);
  }
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Verify password. Uses a constant-time comparison so an attacker cannot use
// response-timing differences to recover the stored hash byte by byte.
function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, hashHex] = hash.split(":");
  if (!saltHex || !hashHex) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const computed = scryptSync(password, salt, 32);
  const stored = Buffer.from(hashHex, "hex");
  // timingSafeEqual requires equal-length buffers; a length mismatch means the
  // stored hash is malformed, so treat it as a failed verification.
  if (computed.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(computed, stored);
}

// Passport LocalStrategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        return done(null, false, { message: "User not found" });
      }

      if (!verifyPassword(password, user.password)) {
        return done(null, false, { message: "Invalid password" });
      }

      return done(null, user as AuthUser);
    } catch (err) {
      return done(err);
    }
  })
);

// Serialize user for session
passport.serializeUser((user: AuthUser, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    done(null, user as AuthUser | undefined);
  } catch (err) {
    done(err);
  }
});

// Strip sensitive fields (password hash) before sending a user to the client.
function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, "password"> {
  const { password, ...safe } = user;
  return safe;
}

export { passport, hashPassword, verifyPassword, sanitizeUser };
