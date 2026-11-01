(() => {
  "use strict";
  function collectDocuments(rootDocument) {
    const documents = [], seen = new Set(), queue = [rootDocument];
    while (queue.length) {
      const doc = queue.shift();
      if (!doc || seen.has(doc)) continue;
      seen.add(doc); documents.push(doc);
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
  function routerAction(action, data, sendResponse) {
    const requestId = String(Date.now()) + Math.random().toString(16).slice(2);
    let settled = false;\n    const listener = (event) => {\n      if (settled) return;\n      settled = true;
      if (event.source !== window || event.data?.channel !== "HALOCK_ROUTER_LOCAL_RESULT" || event.data.requestId !== requestId) return;
      window.removeEventListener("message", listener);
      sendResponse(event.data);
    };
    window.addEventListener("message", listener);
    window.postMessage({ channel: "HALOCK_ROUTER_LOCAL_ACTION", requestId, action, ...data }, "*");
    setTimeout(() => {
      window.removeEventListener("message", listener);
      sendResponse({ ok: false, message: "انتهت مهلة انتظار صفحة الراوتر." });
    }, 10000);
    return true;
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return false;
    if (message.type === "HALOCK_DISCOVER_DEVICES") {
      try {
        const result = discoverDevices();
        sendResponse({ ok: result.devices.length > 0, ...result, message: result.devices.length ? `تم العثور على ${result.devices.length} جهاز من صفحة الراوتر.` : "لم أجد قائمة الأجهزة. افتح صفحة Parental Control داخل الراوتر وسجّل الدخول." });
      } catch {
        sendResponse({ ok: false, devices: [], selectedDevice: null, message: "تعذر قراءة قائمة الأجهزة من الصفحة الحالية." });
      }
      return false;
    }
    if (message.type === "HALOCK_ROUTER_INSPECT") return routerAction("inspect", {}, sendResponse);
    if (message.type === "HALOCK_ROUTER_APPLY") return routerAction("apply", { mac: message.mac, domain: message.domain }, sendResponse);
    return false;
  });
})();