import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, sanitizeUser } from "../auth";

describe("password hashing", () => {
  it("produces a salt:hash string and verifies the correct password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(hash).toContain(":");
    const [salt, digest] = hash.split(":");
    expect(salt).toMatch(/^[0-9a-f]{32}$/); // 16 random bytes, hex
    expect(digest).toMatch(/^[0-9a-f]{64}$/); // 32-byte scrypt output, hex
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("s3cret-password");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different salt/hash each call for the same password", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
});

describe("sanitizeUser", () => {
  it("removes the password field and keeps the rest", () => {
    const safe = sanitizeUser({
      id: 1,
      username: "alice",
      email: "alice@example.com",
      password: "deadbeef:cafef00d",
    });
    expect(safe).toEqual({ id: 1, username: "alice", email: "alice@example.com" });
    expect("password" in safe).toBe(false);
  });
});
