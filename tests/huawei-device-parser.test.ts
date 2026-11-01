import { beforeEach, describe, expect, it } from "vitest";

describe("HALOCK local bridge device parser", () => {
  beforeEach(async () => {
    await import("../tools/huawei-local-bridge/device-parser.js");
  });

  it("extracts exact MAC addresses and normalizes case", () => {
    const result = globalThis.HALOCKDeviceParser.parseDeviceOptions([
      { value: "f0:6c:5d:32:d4:2e", textContent: "Redmi 10" },
      { value: "not-a-mac", textContent: "Unknown" },
      { value: "AA:BB:CC:DD:EE:FF", textContent: "Tablet" },
    ]);
    expect(result).toEqual([
      { mac: "aa:bb:cc:dd:ee:ff", label: "Tablet" },
      { mac: "f0:6c:5d:32:d4:2e", label: "Redmi 10" },
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
