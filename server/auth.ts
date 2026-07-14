import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scryptSync, randomBytes } from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Hash password with scrypt
function hashPassword(password: string, salt?: Buffer): string {
  if (!salt) {
    salt = randomBytes(16);
  }
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Verify password
function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, hashHex] = hash.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const computedHash = scryptSync(password, salt, 32).toString("hex");
  return computedHash === hashHex;
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

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export { passport, hashPassword, verifyPassword };
