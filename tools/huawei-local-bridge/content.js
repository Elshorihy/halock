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
        try {
          if (frame.contentDocument) queue.push(frame.contentDocument);
        } catch {
          // Cross-origin frames are intentionally ignored.
        }
      }
    }
    return documents;
  }

  function discoverDevices() {
    const parser = globalThis.HALOCKDeviceParser;
    if (!parser) throw new Error("Device parser unavailable");

    const found = new Map();
    for (const doc of collectDocuments(document)) {
      const selectors = doc.querySelectorAll(
        'select#ChildrenList, select[name="ChildrenList"], select[id*="ChildrenList"]'
      );
      for (const select of selectors) {
        for (const device of parser.parseDeviceOptions(select.options)) {
          const existing = found.get(device.mac);
          if (!existing || (!existing.label && device.label)) found.set(device.mac, device);
        }
      }
    }
    return Array.from(found.values()).sort((a, b) =>
      (a.label || a.mac).localeCompare(b.label || b.mac, undefined, { sensitivity: "base" })
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "HALOCK_DISCOVER_DEVICES") return false;

    try {
      const devices = discoverDevices();
      sendResponse({
        ok: devices.length > 0,
        devices,
        message: devices.length
          ? `تم العثور على ${devices.length} جهاز من صفحة الراوتر (قراءة فقط).`
          : "لم أجد قائمة الأجهزة. افتح صفحة Parental Control داخل الراوتر وسجّل الدخول.",
      });
    } catch {
      sendResponse({
        ok: false,
        devices: [],
        message: "تعذر قراءة قائمة الأجهزة من الصفحة الحالية.",
      });
    }
    return false;
  });
})();
