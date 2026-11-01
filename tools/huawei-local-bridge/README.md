# HALOCK Huawei Local Bridge — 0.1.0

This is a **read-only** browser extension for the Huawei DN8245V-56 WE router. It reads the connected-device options from the router's Parental Control page and displays their MAC addresses locally.

It does not:
- submit router forms or call router CGI endpoints;
- change Website Filter settings or URL rules;
- read, store, or transmit router passwords, cookies, or session tokens;
- contact HALOCK's Cloudflare Worker or any external server.

## Install in Chrome / Chromium

1. Extract or clone the HALOCK repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the folder `tools/huawei-local-bridge`.
6. Open `https://192.168.1.1`, sign in to the router yourself, and open Parental Control / Website Filter.
7. Click the HALOCK Huawei Local Bridge extension icon, then **قراءة الأجهزة المتصلة**.
8. The extension displays device labels and MAC addresses found in the router's `ChildrenList` selector. Use the MAC to identify the intended test device; do not assume a similar model name is the same device.

If Chrome shows a certificate warning for the router's local HTTPS certificate, handle that warning in the browser yourself. The extension does not bypass it.

## Current scope and next milestone

This version proves only that a local browser extension can read the router's device selector without sending credentials to HALOCK. It is not the automatic Website Filter controller yet.

Before enabling any write operation, HALOCK still needs to prove the selected MAC is the exact target, enumerate saved Parental Control entries and template associations, ensure the URL template is not shared with another device, snapshot the previous policy, and demonstrate rollback. Until then, all router writes remain disabled.
