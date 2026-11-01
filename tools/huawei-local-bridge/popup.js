const scanButton = document.getElementById("scan");
const statusNode = document.getElementById("status");
const selectedNode = document.getElementById("selected");
const devicesNode = document.getElementById("devices");

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#fca5a5" : "#c4b5fd";
}

function renderDevices(devices, selectedDevice) {
  devicesNode.replaceChildren();
  selectedNode.textContent = selectedDevice
    ? `الجهاز المحدد حاليًا في صفحة الراوتر: ${selectedDevice.label || selectedDevice.mac} — ${selectedDevice.mac}`
    : "لم يتم تحديد جهاز حاليًا في قائمة الراوتر.";
  selectedNode.hidden = false;
  for (const device of devices) {
    const card = document.createElement("section");
    card.className = "device";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = device.label || "جهاز بدون اسم";
    const mac = document.createElement("code");
    mac.textContent = device.mac;
    const state = document.createElement("div");
    state.className = "state";
    state.textContent = device.selected ? "محدد حاليًا في الراوتر" : "غير محدد";
    const copy = document.createElement("button");
    copy.className = "copy";
    copy.textContent = "نسخ MAC";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(device.mac);
        copy.textContent = "تم النسخ";
      } catch {
        showStatus("تعذر النسخ تلقائيًا. حدّد عنوان MAC وانسخه يدويًا.", true);
      }
    });
    card.append(label, mac, state, copy);
    devicesNode.append(card);
  }
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  selectedNode.hidden = true;
  devicesNode.replaceChildren();
  showStatus("جارٍ قراءة صفحة الراوتر...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("لا يوجد تبويب نشط.");
    const current = new URL(tab.url);
    if (!["http:", "https:"].includes(current.protocol) || current.hostname !== "192.168.1.1") {
      throw new Error("افتح صفحة الراوتر 192.168.1.1 أولًا.");
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: "HALOCK_DISCOVER_DEVICES" });
    showStatus(result.message, !result.ok);
    renderDevices(result.devices || [], result.selectedDevice || null);
  } catch (error) {
    showStatus(error instanceof Error && error.message.includes("192.168.1.1")
      ? error.message
      : "تعذر الوصول. افتح 192.168.1.1 ثم صفحة Parental Control وسجّل الدخول.", true);
  } finally {
    scanButton.disabled = false;
  }
});
