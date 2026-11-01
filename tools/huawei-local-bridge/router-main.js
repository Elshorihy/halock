(() => {
  "use strict";
  const EVENT = "HALOCK_ROUTER_LOCAL_ACTION";
  const RESPONSE = "HALOCK_ROUTER_LOCAL_RESULT";
  if (window.__HALOCK_ROUTER_ADAPTER_INSTALLED) return;
  window.__HALOCK_ROUTER_ADAPTER_INSTALLED = true;

  function documents() {
    const out = [document];
    for (let i = 0; i < out.length; i++) {
      const doc = out[i];
      for (const frame of doc.querySelectorAll("iframe,frame")) {
        try { if (frame.contentDocument && !out.includes(frame.contentDocument)) out.push(frame.contentDocument); } catch {}
      }
    }
    return out;
  }
  function findControl(docs, selector) {
    for (const doc of docs) {
      const node = doc.querySelector(selector);
      if (node) return node;
    }
    return null;
  }
  function callPageFunction(docs, name) {
    for (const doc of docs) {
      try {
        const fn = doc.defaultView && doc.defaultView[name];
        if (typeof fn === "function") { fn.call(doc.defaultView); return true; }
      } catch {}
    }
    return false;
  }
  function setValue(node, value) {
    if (!node) return false;
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.channel !== EVENT) return;
    const { action, mac, domain } = event.data;
    const docs = documents();
    const deviceSelect = findControl(docs, 'select#ChildrenList,select[name="ChildrenList"],select[id*="ChildrenList"]');
    const scope = findControl(docs, '[name="VarFilterApplyRange"],#VarFilterApplyRange');
    const mode = findControl(docs, '[name="FilterMode"],#FilterMode');
    const enabled = findControl(docs, '[name="UrlEnable"],#UrlEnable');
    const urlInput = findControl(docs, '#UrlAddress,input[name="UrlAddress"],input[id*="UrlAddress"],input[name*="Url"][type="text"],input[id*="Url"][type="text"]');
    const addHandler = docs.some((doc) => typeof doc.defaultView?.OnBtAddUrlClick === "function");
    const applyHandler = docs.some((doc) => typeof doc.defaultView?.OnApply === "function");

    if (action === "inspect") {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: true, ready: Boolean(deviceSelect && scope && mode && enabled && urlInput && addHandler && applyHandler), controls: { device: !!deviceSelect, scope: !!scope, mode: !!mode, enabled: !!enabled, urlInput: !!urlInput, addHandler, applyHandler }, devices: deviceSelect ? Array.from(deviceSelect.options).map(o => ({ label: (o.textContent || "").trim(), value: o.value })) : [] }, "*");
      return;
    }
    if (action !== "apply") return;
    const validMac = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(String(mac || ""));
    const validDomain = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(String(domain || ""));
    if (!validMac || !validDomain || !deviceSelect || !scope || !mode || !enabled || !urlInput || !addHandler || !applyHandler) {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "الراوتر لا يعرض كل عناصر التحكم المتوقعة؛ لم يتم إرسال أي تغيير." }, "*");
      return;
    }
    const option = Array.from(deviceSelect.options).find(o => String(o.value).toLowerCase().includes(mac.toLowerCase()));
    if (!option || /ff:ff:ff:ff:ff:ff/i.test(option.value)) {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "لم أجد MAC مطابقًا حرفيًا في قائمة الأجهزة؛ لم يتم التغيير." }, "*");
      return;
    }
    if (scope.tagName === "SELECT") {
      if (!Array.from(scope.options).some(o => o.value === "SPECIFIEDDEVICE")) {
        window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "وضع الجهاز المحدد غير موجود؛ تم إيقاف العملية." }, "*");
        return;
      }
      setValue(scope, "SPECIFIEDDEVICE");
    } else {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "عنصر نطاق الأجهزة ليس قائمة اختيار معروفة؛ تم إيقاف العملية." }, "*");
      return;
    }
    setValue(deviceSelect, option.value);
    if (mode.tagName === "SELECT" && Array.from(mode.options).some(o => o.value === "0")) setValue(mode, "0");
    else {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "تعذر تحديد وضع Blacklist؛ لم يتم الحفظ." }, "*");
      return;
    }
    if (enabled.type === "checkbox") {
      enabled.checked = true;
      enabled.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (enabled.type === "hidden" || enabled.tagName === "INPUT") {
      setValue(enabled, "on");
    } else {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "عنصر التفعيل غير معروف؛ تم إيقاف العملية." }, "*");
      return;
    }
    setValue(urlInput, domain);
    try {
      if (!callPageFunction(docs, "OnApply")) throw new Error("OnApply unavailable");
      if (!callPageFunction(docs, "OnBtAddUrlClick")) throw new Error("OnBtAddUrlClick unavailable");
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: true, message: "تم استدعاء وظائف صفحة الراوتر لإرسال الإعداد. يلزم التحقق من جدول URL ومن الجهاز المستهدف؛ هذه الرسالة ليست تأكيدًا من الراوتر." }, "*");
    } catch {
      window.postMessage({ channel: RESPONSE, requestId: event.data.requestId, ok: false, message: "تعذر استدعاء وظائف صفحة الراوتر. افحص الإعدادات يدويًا قبل إعادة المحاولة." }, "*");
    }
  });
})();