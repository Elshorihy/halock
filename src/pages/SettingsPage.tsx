/**
 * HALOCK — Settings: language, theme, sound, timer defaults, account,
 * data export, and the danger zone. Everything here really works.
 */

import { useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Clock,
  Database,
  Download,
  Globe,
  LogOut,
  Mail,
  Palette,
  PlayCircle,
  ShieldAlert,
  Trash2,
  User as UserIcon,
  Volume2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { BlockingMode, Lang } from "@shared/types";
import { PRESET_DURATIONS_MINUTES } from "@shared/timer";
import { Badge, Button, Card, Input, Select, Toggle } from "@/components/ui";
import { playChime, unlockAudio } from "@/lib/sound";

export function SettingsPage() {
  const {
    dict,
    lang,
    setLang,
    settings,
    updateSettings,
    user,
    isLocalMode,
    authLogin,
    authRegister,
    authLogout,
    authDeleteAccount,
    exportData,
    clearLocalData,
    toast,
  } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  async function handleAuth(mode: "login" | "register") {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result =
        mode === "login"
          ? await authLogin(email, password)
          : await authRegister(displayName || "مستخدم HALOCK", email, password);
      if (!result.ok) {
        setAuthError(result.error ?? dict.settings.authFailed);
      } else {
        toast(dict.toasts.saved, "success");
        setEmail("");
        setPassword("");
        setDisplayName("");
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleNotifications(enabled: boolean) {
    if (enabled && typeof Notification !== "undefined") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast("لم يتم منح إذن الإشعارات", "error");
        return;
      }
      new Notification("HALOCK", { body: dict.app.slogan });
    }
    await updateSettings({ showDesktopNotifications: enabled });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{dict.settings.title}</h1>
      </div>

      {/* Language & theme */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Globe size={16} /> {dict.settings.language} & {dict.settings.theme}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={dict.settings.language}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="ar">العربية (RTL)</option>
            <option value="en">English (LTR)</option>
          </Select>
          <div>
            <span className="halock-label">{dict.settings.theme}</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  document.documentElement.classList.remove("light");
                  await updateSettings({ theme: "dark" });
                  toast(dict.settings.saved, "success");
                }}
                className={`min-h-[48px] rounded-xl border text-sm font-semibold transition focus-visible-ring ${
                  settings.theme === "dark"
                    ? "border-violet-glow/70 bg-violet-glow/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300"
                }`}
              >
                {dict.settings.dark}
              </button>
              <button
                onClick={async () => {
                  document.documentElement.classList.add("light");
                  await updateSettings({ theme: "light" });
                  toast(dict.settings.saved, "success");
                }}
                className={`min-h-[48px] rounded-xl border text-sm font-semibold transition focus-visible-ring ${
                  settings.theme === "light"
                    ? "border-violet-glow/70 bg-violet-glow/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300"
                }`}
              >
                {dict.settings.light}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Sound */}
      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Volume2 size={16} /> {dict.settings.sound}
        </h2>
        <Toggle
          checked={settings.soundEnabled}
          onChange={(v) => void updateSettings({ soundEnabled: v })}
          label={dict.settings.soundEnabled}
        />
        <div className="mt-3">
          <label className="halock-label">{dict.settings.volume}</label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.soundVolume * 100)}
            onChange={(e) => void updateSettings({ soundVolume: Number(e.target.value) / 100 })}
            className="h-10 w-full accent-violet-glow"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => {
            unlockAudio();
            playChime(settings.soundVolume);
          }}
        >
          <PlayCircle size={16} /> {dict.settings.testSound}
        </Button>
      </Card>

      {/* Timer settings */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Clock size={16} /> {dict.settings.timerSettings}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={dict.settings.defaultDuration}
            value={settings.defaultDurationMinutes}
            onChange={(e) => void updateSettings({ defaultDurationMinutes: Number(e.target.value) })}
          >
            {PRESET_DURATIONS_MINUTES.map((m) => (
              <option key={m} value={m}>
                {m} {dict.common.minutes}
              </option>
            ))}
          </Select>
          <Select
            label={dict.settings.defaultMode}
            value={settings.defaultBlockingMode}
            onChange={(e) => void updateSettings({ defaultBlockingMode: e.target.value as BlockingMode })}
          >
            <option value="blacklist">{dict.focus.blacklist}</option>
            <option value="whitelist">{dict.focus.whitelist}</option>
          </Select>
        </div>
        <div className="mt-3">
          <Toggle
            checked={settings.confirmBeforeStart}
            onChange={(v) => void updateSettings({ confirmBeforeStart: v })}
            label={dict.settings.confirmBeforeStart}
          />
        </div>
        <div className="mt-2">
          <Toggle
            checked={settings.showDesktopNotifications}
            onChange={(v) => void handleNotifications(v)}
            label={dict.settings.notifications}
          />
        </div>
      </Card>

      {/* Account */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <UserIcon size={16} /> {dict.settings.account}
        </h2>

        {isLocalMode ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <Badge tone="info">{dict.settings.accountLocal}</Badge>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{dict.settings.accountLocalDesc}</p>
          </div>
        ) : user ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-glow/20">
                <UserIcon size={20} className="text-violet-glow" />
              </div>
              <div>
                <div className="font-semibold">{user.displayName}</div>
                <div className="text-xs text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <Button variant="secondary" onClick={() => void authLogout()}>
              <LogOut size={16} /> {dict.settings.logout}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              label={dict.settings.displayName}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              label={dict.settings.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={dict.settings.password}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {authError && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-200">
                {authError}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void handleAuth("login")} disabled={authBusy} className="flex-1">
                <Mail size={16} /> {dict.settings.login}
              </Button>
              <Button variant="secondary" onClick={() => void handleAuth("register")} disabled={authBusy} className="flex-1">
                {dict.settings.register}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Data export */}
      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Database size={16} /> {dict.settings.dataExport}
        </h2>
        <p className="text-xs text-slate-400">{dict.settings.dataExportDesc}</p>
        <Button variant="secondary" className="mt-3" onClick={handleExport}>
          <Download size={16} /> {dict.settings.dataExport}
        </Button>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/20">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-300">
          <ShieldAlert size={16} /> {dict.settings.dangerZone}
        </h2>

        {deleteConfirm ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-200">
              <AlertTriangle size={24} className="shrink-0" />
              <span>{isLocalMode ? dict.settings.clearLocalConfirm : dict.settings.deleteAccountDesc}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={async () => {
                  if (isLocalMode) {
                    await clearLocalData();
                  } else {
                    await authDeleteAccount();
                  }
                  setDeleteConfirm(false);
                  toast(dict.toasts.deleted, "success");
                }}
              >
                <Trash2 size={16} /> {dict.settings.deleteAccountConfirm}
              </Button>
              <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                {dict.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
            <Trash2 size={16} /> {isLocalMode ? dict.settings.clearLocalData : dict.settings.deleteAccount}
          </Button>
        )}
      </Card>
    </div>
  );
}
