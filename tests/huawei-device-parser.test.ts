import { beforeEach, describe, expect, it } from "vitest";

declare global {
  // Exposed by the extension's classic-script parser in the isolated world.
  var HALOCKDeviceParser: {
    parseDeviceOptions(options: Array<{ value?: string; textContent?: string }>): Array<{ mac: string; label: string }>;
  };
}

describe("HALOCK local bridge device parser", () => {
  beforeEach(async () => {
    // @ts-expect-error The extension parser is a classic script, not a TypeScript module.
    await import("../tools/huawei-local-bridge/device-parser.js");
  });

  it("extracts exact MAC addresses and normalizes case", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4:2e", textContent: "Redmi 10" },
      { value: "not-a-mac", textContent: "Unknown" },
      { value: "AA:BB:CC:DD:EE:FF", textContent: "Tablet" },
    ]);
    expect(result).toEqual([
      { mac: "f0:6c:5d:32:d4:2e", label: "Redmi 10" },
      { mac: "aa:bb:cc:dd:ee:ff", label: "Tablet" },
    ]);
  });

  it("deduplicates repeated MACs and keeps a useful label", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4:2e", textContent: "" },
      { value: "F0:6C:5D:32:D4:2E", textContent: "Redmi 10" },
    ]);
    expect(result).toEqual([{ mac: "f0:6c:5d:32:d4:2e", label: "Redmi 10" }]);
  });

  it("ignores malformed and partial MAC addresses", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4", textContent: "Partial" },
      { value: "gg:6c:5d:32:d4:2e", textContent: "Invalid" },
      { value: "", textContent: "Empty" },
    ]);
    expect(result).toEqual([]);
  });
});
