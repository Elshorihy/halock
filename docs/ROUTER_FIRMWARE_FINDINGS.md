# Huawei DN8245V-56 WE — verified router findings

Status: **research only; automatic control remains disabled**.

This note records behavior observed on a locally administered DN8245V-56 WE router running firmware V500R022C10SPC205 WE. It deliberately excludes LAN MAC addresses, credentials, session cookies, and CSRF/ONT tokens.

## What was verified in the router UI

- The Parental Control page is served in an iframe at `/html/bbsp/parentalctrl/parentalctrlstatus_egypt.asp`.
- The device scope selector exposed a `SPECIFIEDDEVICE` mode. The UI also has an all-device mode; its save handler uses the broadcast MAC `FF:FF:FF:FF:FF:FF` in that mode. HALOCK must never select or submit that value for a single-device operation.
- The device selector is populated from the router's connected-device list and includes MAC values. A selected connected device is not necessarily already saved as a Parental Control entry.
- The saved Parental Control device entry observed during testing referenced `TemplateInst = 1`. The selected connected device had a different MAC from that saved entry. Therefore, selecting a device in the dropdown alone does **not** prove that the device is linked to the active policy.
- The Website Filter mode selector exposes `0 = Blacklist` and `1 = Whitelist`.
- The Website Filter enable control was checked during inspection.
- URL entries are stored under `InternetGatewayDevice.X_HW_Security.ParentalCtrl.Templates.1.UrlFilter`. The observed UI handler adds an entry through an internal `add.cgi` request and then reloads the page.
- The device save handler sets `x.TemplateInst` to `1` and writes the selected MAC when in specified-device mode.

## Critical safety implications

1. **Template 1 may be shared.** The observed URL list belongs to template 1, not directly to a MAC address. Editing that list can affect every device linked to template 1. Before any write, an implementation must enumerate all saved device entries and confirm that no other device references the target template, or create/use a dedicated template through a documented supported mechanism.
2. **Selected device and saved device must be compared.** The router's connected-device dropdown and its saved Parental Control device table are separate pieces of state. HALOCK must verify the saved entry's MAC and template association after applying a change.
3. **Never use all-device scope.** Reject `FF:FF:FF:FF:FF:FF`, `ALLDEVICE`, missing MACs, malformed MACs, and ambiguous device matches before sending any write.
4. **Preserve existing policy.** Read and snapshot the prior enable flag, mode, URL entries, device-to-template associations, and schedule before changing anything. Restore only the exact state HALOCK changed.
5. **No secrets in HALOCK cloud.** Router passwords, cookies, and per-session tokens must remain in a trusted local execution context and must never be sent to Cloudflare Workers, D1, analytics, logs, or telemetry.

## Why Automatic Mode is still not enabled

The observed `add.cgi` / `set.cgi` calls are private web-interface implementation details, not an official or documented router API. Browser inspection demonstrates how this firmware's own page behaves, but does not establish a stable supported interface, CSRF/session lifecycle, cross-origin access, or safe rollback semantics.

The deployed HALOCK PWA and Cloudflare Worker cannot freely control a router's private LAN page from a remote Worker. A future implementation would require a separately reviewed local companion/extension (or a vendor-documented interface), explicit local authorization, and end-to-end tests on the exact firmware.

## Required acceptance tests before enabling writes

- Discover connected devices and saved Parental Control entries independently.
- Resolve the intended device by exact MAC, never by a non-unique display name or changing IP.
- Prove the selected device is the only device linked to the policy/template being edited.
- Refuse writes if the policy is shared, the device is ambiguous, or the router reports all-device scope.
- Snapshot and restore the complete prior policy; verify restoration by reading it back.
- Verify the target device is blocked and a second, non-target device remains unaffected.
- Test session expiry, router reboot, network loss, and concurrent HALOCK sessions.
- Keep credentials and tokens local; redact them from logs and diagnostics.

Until these conditions are met, `AutomaticRouterProvider` must continue to return `not-supported` and the UI must not claim that rules were applied.
