# HALOCK Huawei Local Bridge — 0.2.0

A **read-only** Chrome/Chromium extension for the Huawei DN8245V-56 WE router. It reads device labels and MAC addresses from the Parental Control device selector, including selectors inside same-origin nested frames.

## Privacy and safety

- No router forms are submitted and no router CGI endpoints are called.
- No Website Filter settings, URL rules, schedules, or device associations are changed.
- Router passwords, cookies, and session tokens are not read, stored, or transmitted.
- No request is sent to HALOCK's Worker or any external server.
- Cross-origin frames are ignored.

## Install

1. Extract or clone the HALOCK repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `tools/huawei-local-bridge`.
4. Sign in to `https://192.168.1.1` yourself and open Parental Control / Website Filter.
5. Open the extension and select **قراءة الأجهزة المتصلة**.
6. Match the exact MAC address to the intended physical device. Similar device names are not sufficient.

If the browser displays a certificate warning for the router's local HTTPS certificate, handle it in the browser yourself. The extension does not bypass certificate checks.

## Scope

This release improves local device discovery only. It does not control Website Filter. Automatic writes remain disabled until the router's saved device-to-template associations can be safely inspected, the target template is proven exclusive, existing settings can be backed up, and rollback/read-back can be tested on the local network.
