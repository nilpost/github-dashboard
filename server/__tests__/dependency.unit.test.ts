import { describe, it, expect } from "vitest";
import {
  compareVersions,
  parseVersionRange,
} from "../services/dependency.service";

describe("parseVersionRange", () => {
  it("strips common range operators to a base version", () => {
    expect(parseVersionRange("^1.2.3")).toBe("1.2.3");
    expect(parseVersionRange("~2.1.0")).toBe("2.1.0");
    expect(parseVersionRange(">=3.0.0")).toBe("3.0.0");
    expect(parseVersionRange("1.2.3")).toBe("1.2.3");
  });

  it("extracts the version embedded in a prerelease string", () => {
    expect(parseVersionRange("2.0.0-beta.1")).toBe("2.0.0");
  });

  it("returns the input unchanged when there is no semver to extract", () => {
    expect(parseVersionRange("workspace:*")).toBe("workspace:*");
    expect(parseVersionRange("file:../local")).toBe("file:../local");
  });
});

describe("compareVersions", () => {
  it("flags a lower current version as outdated", () => {
    expect(compareVersions("1.2.3", "1.2.4")).toBe(true);
    expect(compareVersions("1.2.3", "1.3.0")).toBe(true);
    expect(compareVersions("1.2.3", "2.0.0")).toBe(true);
  });

  it("does not flag equal or newer current versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(false);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(false);
  });

  it("compares numerically, not lexically (10 > 9)", () => {
    // A string comparison would wrongly rank "1.9.0" above "1.10.0".
    expect(compareVersions("1.9.0", "1.10.0")).toBe(true);
    expect(compareVersions("1.10.0", "1.9.0")).toBe(false);
  });

  it("honors range operators on either side", () => {
    expect(compareVersions("^1.2.3", "1.2.4")).toBe(true);
    expect(compareVersions("~1.2.3", "1.2.3")).toBe(false);
  });

  it("treats uncomparable range strings as not outdated", () => {
    // No extractable version → NaN parts → deterministic false, never a
    // misleading "outdated" result.
    expect(compareVersions("workspace:*", "1.2.3")).toBe(false);
    expect(compareVersions("file:../x", "9.9.9")).toBe(false);
  });
});
