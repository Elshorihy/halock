const scanButton = document.getElementById("scan");
const applyButton = document.getElementById("apply");
const statusNode = document.getElementById("status");
const selectedNode = document.getElementById("selected");
const devicesNode = document.getElementById("devices");
const targetNode = document.getElementById("target");
const domainNode = document.getElementById("domain");
let controlsReady = false;

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#fca5a5" : "#c4b5fd";
}
function validDomain(value) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.trim());
}
function renderDevices(devices, selectedDevice) {
  devicesNode.replaceChildren();
  targetNode.replaceChildren();
  targetNode.add(new Option("اختر الجهاز المستهدف", ""));
  for (const device of devices) {
    const option = new Option(`${device.label || "جهاز بدون اسم"} — ${device.mac}`, device.mac);
    targetNode.add(option);
    const card = document.createElement("section");
    card.className = "device";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = device.label || "جهاز بدون اسم";
    const mac = document.createElement("code");
    mac.textContent = device.mac;
    const state = document.createElement("div");
    state.className = "state";
    state.textContent = device.selected ? "محدد حاليًا في صفحة الراوتر" : "غير محدد";
    card.append(label, mac, state);
    devicesNode.append(card);
  }
  if (selectedDevice) {
    targetNode.value = selectedDevice.mac;
    selectedNode.textContent = `الجهاز المحدد حاليًا في الراوتر: ${selectedDevice.label || selectedDevice.mac} — ${selectedDevice.mac}`;
    selectedNode.hidden = false;
  } else {
    selectedNode.textContent = "لم يتم تحديد جهاز حاليًا في صفحة الراوتر. اختر MAC بنفسك.";
    selectedNode.hidden = false;
  }
  targetNode.disabled = devices.length === 0 || !controlsReady;
  updateApplyState();
}
async function injectRouterAdapter(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["router-main.js"], world: "MAIN" });
}
function updateApplyState() {
  applyButton.disabled = !controlsReady || !targetNode.value || !validDomain(domainNode.value);
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  applyButton.disabled = true;
  controlsReady = false;
  showStatus("جارٍ قراءة قائمة الأجهزة وفحص واجهة الراوتر...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("لا يوجد تبويب نشط.");
    const current = new URL(tab.url);
    if (!["http:", "https:"].includes(current.protocol) || current.hostname !== "192.168.1.1") {
      throw new Error("افتح صفحة الراوتر 192.168.1.1 أولًا.");
    }
    await injectRouterAdapter(tab.id);
    const [devices, inspect] = await Promise.all([
      chrome.tabs.sendMessage(tab.id, { type: "HALOCK_DISCOVER_DEVICES" }),
      chrome.tabs.sendMessage(tab.id, { type: "HALOCK_ROUTER_INSPECT" })
    ]);
    renderDevices(devices.devices || [], devices.selectedDevice || null);
    controlsReady = Boolean(inspect.ok && inspect.ready);
    if (controlsReady) showStatus(`تم العثور على ${(devices.devices || []).length} جهاز، وعناصر Website Filter المطلوبة موجودة. اختر MAC والنطاق للتجربة.`);
    else showStatus("قراءة الأجهزة نجحت، لكن عناصر التحكم المتوقعة غير مكتملة. لم يتم تفعيل زر الحجب. " + JSON.stringify(inspect.controls || {}), true);
    targetNode.disabled = !controlsReady || !devices.devices?.length;
    updateApplyState();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "تعذر الاتصال بصفحة الراوتر.", true);
  } finally {
    scanButton.disabled = false;
  }
});
targetNode.addEventListener("change", updateApplyState);
domainNode.addEventListener("input", updateApplyState);

applyButton.addEventListener("click", async () => {
  const mac = targetNode.value;
  const domain = domainNode.value.trim().toLowerCase();
  if (!mac || !validDomain(domain)) return;
  if (!confirm(`تأكيد التجربة على الجهاز ذي MAC: ${mac}\nسيتم ضبط Blacklist وتفعيل Website Filter وإضافة ${domain}. قد يؤثر ذلك على أجهزة أخرى مرتبطة بنفس القالب.`)) return;
  applyButton.disabled = true;
  scanButton.disabled = true;
  showStatus("جارٍ استدعاء وظائف صفحة الراوتر...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await injectRouterAdapter(tab.id);
    const result = await chrome.tabs.sendMessage(tab.id, { type: "HALOCK_ROUTER_APPLY", mac, domain });
    showStatus(result.message || "انتهت العملية دون رسالة واضحة.", !result.ok);
  } catch {
    showStatus("انقطع الاتصال بصفحة الراوتر. افحص إعدادات الراوتر يدويًا قبل إعادة المحاولة.", true);
  } finally {
    scanButton.disabled = false;
    updateApplyState();
  }
});
