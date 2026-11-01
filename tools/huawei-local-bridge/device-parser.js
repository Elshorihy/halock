(() => {
  "use strict";

  const MAC_PATTERN = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

  function parseDeviceOptions(options) {
    const found = new Map();
    for (const option of Array.from(options || [])) {
      const raw = String(option && option.value || "").trim();
      const match = raw.match(/(?:[0-9a-f]{2}:){5}[0-9a-f]{2}/i);
      if (!match || !MAC_PATTERN.test(match[0])) continue;
      const mac = match[0].toLowerCase();
      const label = String(option && option.textContent || "").trim();
      const selected = Boolean(option && option.selected);
      const current = found.get(mac);
      if (!current || (!current.label && label)) {
        found.set(mac, { mac, label, selected: selected || Boolean(current && current.selected) });
      } else if (selected && !current.selected) {
        found.set(mac, { ...current, selected: true });
      }
    }
    return Array.from(found.values()).sort((a, b) =>
      (a.label || a.mac).localeCompare(b.label || b.mac, undefined, { sensitivity: "base" })
    );
  }

  globalThis.HALOCKDeviceParser = Object.freeze({ parseDeviceOptions });
})();
