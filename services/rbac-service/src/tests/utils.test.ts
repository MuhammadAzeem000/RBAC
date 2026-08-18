import "../utils/bigint";
import { parseBigIntId } from "../utils";

describe("parseBigIntId", () => {
  it("parses a valid numeric string", () => {
    expect(parseBigIntId("123")).toBe(123n);
  });

  it("rejects non-numeric strings", () => {
    expect(parseBigIntId("abc")).toBeNull();
  });

  it("rejects negative numbers and decimals", () => {
    expect(parseBigIntId("-1")).toBeNull();
    expect(parseBigIntId("1.5")).toBeNull();
  });
});

describe("BigInt JSON serialization", () => {
  it("serializes BigInt values as strings", () => {
    const payload = { id: 42n };
    expect(JSON.stringify(payload)).toBe('{"id":"42"}');
  });
});
