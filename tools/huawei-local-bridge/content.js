(() => {
  "use strict";
  function collectDocuments(rootDocument) {
    const documents = [];
    const seen = new Set();
    const queue = [rootDocument];
    while (queue.length) {
      const doc = queue.shift();
      if (!doc || seen.has(doc)) continue;
      seen.add(doc);
      documents.push(doc);
      for (const frame of doc.querySelectorAll("iframe, frame")) {
        try { if (frame.contentDocument) queue.push(frame.contentDocument); } catch {}
      }
    }
    return documents;
  }
  function discoverDevices() {
    const parser = globalThis.HALOCKDeviceParser;
    if (!parser) throw new Error("Device parser unavailable");
    const found = new Map();
    for (const doc of collectDocuments(document)) {
      const selectors = doc.querySelectorAll('select#ChildrenList, select[name="ChildrenList"], select[id*="ChildrenList"]');
      for (const select of selectors) {
        for (const device of parser.parseDeviceOptions(select.options)) {
          const current = found.get(device.mac);
          if (!current || (!current.label && device.label)) found.set(device.mac, device);
          else if (device.selected && !current.selected) found.set(device.mac, { ...current, selected: true });
        }
      }
    }
    const devices = Array.from(found.values()).sort((a, b) => (a.label || a.mac).localeCompare(b.label || b.mac, undefined, { sensitivity: "base" }));
    return { devices, selectedDevice: devices.find((device) => device.selected) || null };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "HALOCK_DISCOVER_DEVICES") return false;
    try {
      const result = discoverDevices();
      sendResponse({
        ok: result.devices.length > 0,
        ...result,
        message: result.devices.length ? `تم العثور على ${result.devices.length} جهاز من صفحة الراوتر (قراءة فقط).` : "لم أجد قائمة الأجهزة. افتح صفحة Parental Control داخل الراوتر وسجّل الدخول."
      });
    } catch {
      sendResponse({ ok: false, devices: [], selectedDevice: null, message: "تعذر قراءة قائمة الأجهزة من الصفحة الحالية." });
    }
    return false;
  });
})();
