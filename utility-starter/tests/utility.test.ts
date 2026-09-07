import { describe, expect, it } from "vitest";
import { transformItems } from "@/lib/utility";

describe("transformItems", () => {
  it("trims blank lines, filters, deduplicates case-insensitively, and sorts", () => {
    const result = transformItems("Beta\n alpha \nALPHA\n\nGamma", {
      filter: "a",
      dedupe: true,
      sort: true,
    });

    expect(result.inputCount).toBe(4);
    expect(result.items).toEqual(["alpha", "Beta", "Gamma"]);
    expect(result.outputCount).toBe(3);
  });

  it("preserves duplicates and order when those options are disabled", () => {
    const result = transformItems("B\nA\nA", {
      filter: "",
      dedupe: false,
      sort: false,
    });

    expect(result.items).toEqual(["B", "A", "A"]);
  });
});
