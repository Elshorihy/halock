import { beforeEach, describe, expect, it } from "vitest";

declare global {
  var HALOCKDeviceParser: {
    parseDeviceOptions(options: Array<{ value?: string; textContent?: string; selected?: boolean }>): Array<{ mac: string; label: string; selected: boolean }>;
  };
}

describe("HALOCK local bridge device parser", () => {
  beforeEach(async () => {
    // @ts-expect-error The extension parser is a classic script, not a TypeScript module.
    await import("../tools/huawei-local-bridge/device-parser.js");
  });

  it("extracts exact MAC addresses, normalizes case, and records selection", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4:2e", textContent: "Redmi 10", selected: true },
      { value: "not-a-mac", textContent: "Unknown" },
      { value: "AA:BB:CC:DD:EE:FF", textContent: "Tablet" },
    ]);
    expect(result).toEqual([
      { mac: "f0:6c:5d:32:d4:2e", label: "Redmi 10", selected: true },
      { mac: "aa:bb:cc:dd:ee:ff", label: "Tablet", selected: false },
    ]);
  });

  it("deduplicates repeated MACs and keeps a useful label and selected state", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4:2e", textContent: "", selected: false },
      { value: "F0:6C:5D:32:D4:2E", textContent: "Redmi 10", selected: true },
    ]);
    expect(result).toEqual([{ mac: "f0:6c:5d:32:d4:2e", label: "Redmi 10", selected: true }]);
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
