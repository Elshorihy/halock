const scanButton = document.getElementById("scan");
const statusNode = document.getElementById("status");
const devicesNode = document.getElementById("devices");

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#fca5a5" : "#c4b5fd";
}

function renderDevices(devices) {
  devicesNode.replaceChildren();
  for (const device of devices) {
    const card = document.createElement("section");
    card.className = "device";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = device.label || "جهاز بدون اسم";

    const mac = document.createElement("code");
    mac.textContent = device.mac;

    const copy = document.createElement("button");
    copy.className = "copy";
    copy.textContent = "نسخ MAC";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(device.mac);
        copy.textContent = "تم النسخ";
      } catch {
        showStatus("تعذر النسخ من المتصفح. يمكنك تحديد عنوان MAC ونسخه يدويًا.", true);
      }
    });

    card.append(label, mac, copy);
    devicesNode.append(card);
  }
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  devicesNode.replaceChildren();
  showStatus("جارٍ قراءة صفحة الراوتر...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("افتح تبويب الراوتر أولًا.");

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "HALOCK_DISCOVER_DEVICES",
    });

    showStatus(result.message, !result.ok);
    renderDevices(result.devices || []);
  } catch {
    showStatus(
      "لم أستطع الوصول للصفحة. افتح https://192.168.1.1 ثم Parental Control، وبعدها افتح الإضافة.",
      true
    );
  } finally {
    scanButton.disabled = false;
  }
});
