(() => {
  "use strict";

  const MAC_PATTERN = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

  function documentsForTab() {
    const documents = [document];
    for (const frame of document.querySelectorAll("iframe")) {
      try {
        if (frame.contentDocument) documents.push(frame.contentDocument);
      } catch {
        // Cross-origin frames are intentionally ignored.
      }
    }
    return documents;
  }

  function discoverDevices() {
    const found = new Map();
    for (const doc of documentsForTab()) {
      const select = doc.querySelector(
        'select#ChildrenList, select[name="ChildrenList"], select[id*="ChildrenList"]'
      );
      if (!select) continue;

      for (const option of Array.from(select.options)) {
        const raw = String(option.value || "").trim();
        const match = raw.match(/(?:[0-9a-f]{2}:){5}[0-9a-f]{2}/i);
        if (!match || !MAC_PATTERN.test(match[0])) continue;
        const mac = match[0].toLowerCase();
        const label = String(option.textContent || "").trim();
        if (!found.has(mac)) found.set(mac, { mac, label });
      }
    }
    return Array.from(found.values());
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "HALOCK_DISCOVER_DEVICES") return false;

    const devices = discoverDevices();
    sendResponse({
      ok: devices.length > 0,
      devices,
      message: devices.length
        ? "تمت قراءة قائمة الأجهزة من صفحة الراوتر (قراءة فقط)."
        : "لم أجد قائمة ChildrenList. افتح صفحة Parental Control داخل الراوتر وسجّل الدخول.",
    });
    return false;
  });
})();
