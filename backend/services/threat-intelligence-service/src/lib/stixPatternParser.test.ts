import { parseStixPattern } from "./stixPatternParser";

describe("parseStixPattern", () => {
  it("extracts ipv4-addr equality patterns", () => {
    expect(parseStixPattern("[ipv4-addr:value = '1.2.3.4']")).toEqual({
      iocType: "ipv4-addr:value",
      iocValue: "1.2.3.4",
    });
  });

  it("extracts domain-name equality patterns", () => {
    expect(parseStixPattern("[domain-name:value = 'evil.com']")).toEqual({
      iocType: "domain-name:value",
      iocValue: "evil.com",
    });
  });

  it("extracts file hash patterns with dotted property paths", () => {
    expect(parseStixPattern("[file:hashes.'SHA-256' = 'abcd1234']")).toEqual({
      iocType: "file:hashes.'SHA-256'",
      iocValue: "abcd1234",
    });
  });

  it("returns null for compound/boolean patterns", () => {
    expect(
      parseStixPattern("[ipv4-addr:value = '1.2.3.4' AND domain-name:value = 'evil.com']"),
    ).toBeNull();
  });

  it("returns null for missing/empty input", () => {
    expect(parseStixPattern(undefined)).toBeNull();
    expect(parseStixPattern(null)).toBeNull();
    expect(parseStixPattern("")).toBeNull();
  });
});
