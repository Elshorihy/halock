# HALOCK Huawei Local Bridge — 0.3.0 experimental

A local Chrome/Chromium extension for the Huawei DN8245V-56 WE router. It discovers connected devices and offers an experimental single-device Website Filter action by invoking the router page's own JavaScript handlers.

## Install

1. Extract or clone the HALOCK repository.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `tools/huawei-local-bridge`.
3. Sign in to `http://192.168.1.1` or `https://192.168.1.1` yourself and open Parental Control / Website Filter.
4. Open the extension and choose **قراءة الأجهزة وفحص عناصر الراوتر**.
5. Select the exact device by MAC address, enter one domain, then press **تجربة إضافة النطاق للجهاز المحدد** and confirm.

## What the experimental action does

- Requires an exact MAC match in the router's connected-device selector. It refuses the broadcast MAC.
- Requires the router page to expose the expected device selector, specified-device scope, Blacklist selector, URL enable control, URL input, and the page's existing `OnApply` and `OnBtAddUrlClick` handlers.
- Sets specified-device scope, selects the exact MAC, selects Blacklist, enables URL filtering, enters one domain, then calls the router page's existing handlers.
- It does not send router credentials, cookies, or session tokens to HALOCK or any external server.

## Important test warning

This is an **experimental, unverified write path** for the exact observed firmware family. A successful message only means the page handlers were invoked; it is not proof that the router saved the policy or that only one device is affected.

The observed firmware handler uses Template 1 for URL rules. If other saved devices share Template 1, they may receive the same URL rules. The extension cannot currently prove template exclusivity, snapshot the complete prior policy, or automatically roll it back. Check the router's saved device associations and existing URL table before testing. After applying, verify the URL entry and test both the selected device and a second device. Restore the previous settings manually if the result is wrong.

If the expected controls are missing, the extension fails closed and does not attempt the write. Do not paste router passwords, cookies, or session tokens into ChatGPT or HALOCK.
