import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/parse-json";

describe("extractJson", () => {
  it("parses a direct JSON array", () => {
    const result = extractJson('[{"a":1}]');
    expect(result).toEqual([{ a: 1 }]);
  });

  it("parses a direct JSON object", () => {
    const result = extractJson('{"key":"val"}');
    expect(result).toEqual({ key: "val" });
  });

  it("strips ```json fences", () => {
    const result = extractJson('```json\n[{"x":2}]\n```');
    expect(result).toEqual([{ x: 2 }]);
  });

  it("strips plain ``` fences without language tag", () => {
    const result = extractJson("```\n{}\n```");
    expect(result).toEqual({});
  });

  it("finds JSON array after leading prose", () => {
    const result = extractJson("Here is the result:\n[1,2,3]");
    expect(result).toEqual([1, 2, 3]);
  });

  it("finds JSON object after leading prose", () => {
    const result = extractJson('Output: {"x":1}');
    expect(result).toEqual({ x: 1 });
  });

  it("throws on completely unparseable input", () => {
    expect(() => extractJson("no json here")).toThrow("Could not parse JSON");
  });

  it("throws on empty string", () => {
    expect(() => extractJson("")).toThrow();
  });
});
