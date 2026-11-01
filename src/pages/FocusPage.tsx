/**
 * HALOCK — Focus session page.
 *
 * Flow: Setup → Confirm → Running (no pause / no early stop) → Finished → Saved.
 * Recovery: a persisted session survives reload/close; if its time elapsed while
 * the app was closed, the Recovered screen offers to save it exactly once.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Info,
  ListTodo,
  Lock,
  Play,
  Router as RouterIcon,
  ShieldAlert,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  buildSnapshot,
  formatClock,
  formatDurationLabel,
  isValidDurationMinutes,
  PRESET_DURATIONS_MINUTES,
  progressRatio,
  remainingSeconds,
} from "@shared/timer";
import { planBlocking, checkSessionPlan, canStartSession } from "@shared/session-logic";
import { Badge, Button, Card, Input, Modal, ProgressRing, Select } from "@/components/ui";
import { unlockAudio, playChime } from "@/lib/sound";
import type { BlockingMode, FocusSession } from "@shared/types";
import type { RouteName } from "@/components/layout/AppShell";

type Phase = "setup" | "confirm" | "running" | "finished" | "saved" | "recovered";

export function FocusPage({ navigate }: { navigate: (r: RouteName) => void }) {
  const {
    dict,
    domains,
    tasks,
    activeSession,
    settings,
    routerConfig,
    startSession,
    saveCompletedSession,
    addRouterLog,
    toast,
    discardActiveSession,
  } = useApp();
  const reduce = useReducedMotion();

  // ---- setup state ----
  const [durationMinutes, setDurationMinutes] = useState(settings.defaultDurationMinutes);
  const [customMinutes, setCustomMinutes] = useState(String(settings.defaultDurationMinutes));
  const [taskId, setTaskId] = useState<string>("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>(() =>
    domains.filter((d) => d.enabled).map((d) => d.domain),
  );
  const [blockingMode, setBlockingMode] = useState<BlockingMode>(settings.defaultBlockingMode);
  const [whitelistAck, setWhitelistAck] = useState(false);
  const [whitelistModal, setWhitelistModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [startWithoutBlocking, setStartWithoutBlocking] = useState(false);

  // ---- running / finished state ----
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<Phase>(() => (activeSession ? "running" : "setup"));
  const [saving, setSaving] = useState(false);
  const [recoveredShown, setRecoveredShown] = useState(false);
  const chimePlayed = useRef(false);

  const active = activeSession;

  // Decide the phase from the persisted session (handles reload + reopen).
  useEffect(() => {
    if (!active) {
      if (phase !== "saved") setPhase("setup");
      return;
    }
    const endMs = new Date(active.endTime).getTime();
    if (Date.now() >= endMs) {
      setPhase("recovered");
    } else {
      setPhase("running");
      chimePlayed.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Live tick while running.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  // Transition to finished when the counter reaches zero.
  useEffect(() => {
    if (phase !== "running" || !active) return;
    const endMs = new Date(active.endTime).getTime();
    if (Date.now() >= endMs) {
      setPhase("finished");
      if (!chimePlayed.current && settings.soundEnabled) {
        playChime(settings.soundVolume);
        chimePlayed.current = true;
      }
    }
  }, [phase, active, now, settings.soundEnabled, settings.soundVolume]);

  // Preselect domains when the list changes and nothing was selected yet.
  useEffect(() => {
    if (selectedDomains.length === 0 && domains.length > 0 && phase === "setup") {
      setSelectedDomains(domains.filter((d) => d.enabled).map((d) => d.domain));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains.length]);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const enabledDomainList = useMemo(() => domains.filter((d) => d.enabled), [domains]);

  const plan = useMemo(() => {
    if (!active) return null;
    return buildSnapshot(new Date(active.startTime).getTime(), active.durationSeconds);
  }, [active]);

  const openConfirm = useCallback(() => {
    setSessionError(null);
    setStartWithoutBlocking(false);

    if (activeSession) {
      setSessionError(dict.focus.sessionActive);
      return;
    }
    const durationCheck = isValidDurationMinutes(durationMinutes);
    if (!durationCheck) {
      setSessionError("المدة يجب أن تكون بين 1 و180 دقيقة");
      return;
    }
    const startCheck = canStartSession(activeSession ? [activeSession] : []);
    if (!startCheck.ok) {
      setSessionError(startCheck.message ?? "");
      return;
    }
    // Whitelist with zero allowed sites would block everything — hard requirement.
    const planCheck = checkSessionPlan({
      durationMinutes,
      blockedDomains: selectedDomains,
      blockingMode,
      routerMode: routerConfig.integrationMode,
      automaticBlockingAvailable: false,
    });
    if (!planCheck.ok && planCheck.reason === "no-domains-in-whitelist") {
      setSessionError(planCheck.message ?? "");
      return;
    }
    if (!settings.confirmBeforeStart) {
      void handleStart();
      return;
    }
    setConfirmOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, durationMinutes, selectedDomains, blockingMode, routerConfig, settings, dict]);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setSessionError(null);
    try {
      unlockAudio();
      const useBlocking = selectedDomains.length > 0 && !startWithoutBlocking;
      const blocking = planBlocking({
        durationMinutes,
        blockedDomains: useBlocking ? selectedDomains : [],
        blockingMode,
        routerMode: useBlocking ? routerConfig.integrationMode : "none",
        automaticBlockingAvailable: false,
      });

      const task = tasks.find((t) => t.id === taskId) ?? null;

      // Log the session-start router action honestly (manual mode delegates).
      if (useBlocking && routerConfig.integrationMode !== "none") {
        await addRouterLog({
          action: "session-start",
          result: routerConfig.integrationMode === "manual" ? "manual-delegated" : "not-supported",
          message:
            routerConfig.integrationMode === "manual"
              ? `جلسة جديدة — تُطبق القواعد يدويًا على ${blocking.domains.length} موقع (${blockingMode})`
              : "جلسة جديدة — التكامل التلقائي غير مدعوم، لم يُطبَّق حجب",
          device: routerConfig.targetDevice,
        });
      }

      await startSession({
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? null,
        durationSeconds: durationMinutes * 60,
        blockedDomains: blocking.domains,
        blockingMode,
        routerMode: useBlocking ? routerConfig.integrationMode : "none",
        blockingStatus: blocking.blockingStatus,
        note: blocking.note,
      });

      setConfirmOpen(false);
      chimePlayed.current = false;
      setPhase("running");
      setNow(Date.now());
    } catch (e) {
      const message = (e as Error).message || dict.toasts.error;
      setSessionError(message);
      toast(message, "error");
    } finally {
      setStarting(false);
    }
  }, [
    starting, selectedDomains, startWithoutBlocking, durationMinutes, blockingMode,
    routerConfig, tasks, taskId, startSession, addRouterLog, toast, dict,
  ]);

  const handleSave = useCallback(async () => {
    if (!active || saving) return;
    setSaving(true);
    try {
      await saveCompletedSession(active.id);
      await addRouterLog({
        action: "session-end",
        result: active.routerMode === "manual" ? "manual-delegated" : "skipped",
        message:
          active.routerMode === "manual"
            ? "انتهت الجلسة — استعد إعدادات الراوتر يدويًا إن لزم (راجع الدليل)"
            : "انتهت الجلسة — لا يوجد تكامل راوتر مفعّل",
        device: routerConfig.targetDevice,
      });
      setPhase("saved");
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("بالفعل") || message.toLowerCase().includes("already")) {
        setPhase("saved");
        toast(dict.focus.duplicateAttempt, "info");
      } else {
        toast(message, "error");
      }
    } finally {
      setSaving(false);
    }
  }, [active, saving, saveCompletedSession, addRouterLog, routerConfig, toast, dict]);

  const runningPhase = phase === "running" && active && plan;
  const finishedPhase = (phase === "finished" || phase === "recovered") && active && plan;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{dict.focus.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{dict.focus.setupTitle}</p>
      </div>

      <AnimatePresence mode="wait">
        {/* ---------------- SETUP ---------------- */}
        {phase === "setup" && (
          <motion.div
            key="setup"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            className="flex flex-col gap-5"
          >
            {/* Duration */}
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Clock size={16} /> {dict.focus.duration}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PRESET_DURATIONS_MINUTES.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setDurationMinutes(m);
                      setCustomMinutes(String(m));
                    }}
                    className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.97] focus-visible-ring ${
                      durationMinutes === m && customMinutes === String(m)
                        ? "border-violet-glow/70 bg-violet-glow/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                    }`}
                  >
                    {m} {dict.common.minutes}
                  </button>
                ))}
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label={dict.focus.customDuration}
                    type="number"
                    min={1}
                    max={180}
                    inputMode="numeric"
                    value={customMinutes}
                    onChange={(e) => {
                      setCustomMinutes(e.target.value);
                      const v = Number(e.target.value);
                      if (isValidDurationMinutes(v)) setDurationMinutes(v);
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* Task */}
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <ListTodo size={16} /> {dict.focus.task}
              </h2>
              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">{dict.focus.noTask} ({dict.focus.taskOptional})</option>
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Card>

            {/* Websites + mode */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Globe size={16} /> {dict.focus.blockedWebsites}
                </h2>
                <span className="text-xs text-slate-500">
                  {selectedDomains.length} / {enabledDomainList.length}
                </span>
              </div>

              {enabledDomainList.length === 0 ? (
                <p className="rounded-xl bg-white/[0.03] p-4 text-sm text-slate-400">
                  {dict.focus.noDomains} —{" "}
                  <button className="text-focus underline" onClick={() => navigate("websites")}>
                    {dict.dashboard.quick.websites}
                  </button>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {enabledDomainList.map((d) => {
                    const selected = selectedDomains.includes(d.domain);
                    return (
                      <button
                        key={d.id}
                        onClick={() =>
                          setSelectedDomains((prev) =>
                            selected ? prev.filter((x) => x !== d.domain) : [...prev, d.domain],
                          )
                        }
                        className={`min-h-[44px] rounded-full border px-4 text-sm transition active:scale-95 focus-visible-ring ${
                          selected
                            ? "border-focus/60 bg-focus/15 text-focus"
                            : "border-white/10 bg-white/[0.03] text-slate-400"
                        }`}
                      >
                        {selected ? "✓ " : ""}
                        {d.domain}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">{dict.focus.blockingMode}</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setBlockingMode("blacklist")}
                    className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition focus-visible-ring ${
                      blockingMode === "blacklist"
                        ? "border-violet-glow/70 bg-violet-glow/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                    }`}
                  >
                    {dict.focus.blacklist}
                  </button>
                  <button
                    onClick={() => {
                      if (!whitelistAck) {
                        setWhitelistModal(true);
                      } else {
                        setBlockingMode("whitelist");
                      }
                    }}
                    className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition focus-visible-ring ${
                      blockingMode === "whitelist"
                        ? "border-amber-500/70 bg-amber-500/15 text-amber-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                    }`}
                  >
                    {dict.focus.whitelist}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {blockingMode === "blacklist" ? dict.focus.modeBlacklistDesc : dict.focus.modeWhitelistDesc}
                </p>
              </div>
            </Card>

            {sessionError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                {sessionError}
              </div>
            )}

            <Button size="lg" onClick={openConfirm}>
              <Play size={20} /> {dict.focus.start}
            </Button>
          </motion.div>
        )}

        {/* ---------------- RUNNING ---------------- */}
        {runningPhase && (
          <motion.div
            key="running"
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <Badge tone="info">{dict.focus.sessionActive}</Badge>

            <ProgressRing
              ratio={progressRatio(plan, now)}
              size={280}
              stroke={14}
            >
              <div className="text-5xl font-extrabold tnum text-white">
                {formatClock(remainingSeconds(plan, now))}
              </div>
              <div className="mt-2 text-sm text-slate-400">{dict.focus.secondFocus}</div>
            </ProgressRing>

            {active.taskTitle && (
              <div className="flex items-center gap-2 rounded-full bg-violet-glow/15 px-4 py-2 text-sm text-violet-200">
                <ListTodo size={16} /> {active.taskTitle}
              </div>
            )}

            <Card className="w-full max-w-md">
              <div className="flex items-start gap-3">
                <Lock size={20} className="mt-0.5 shrink-0 text-focus" />
                <div>
                  <div className="text-sm font-semibold">{dict.focus.cannotPause}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{dict.focus.cannotPauseDesc}</p>
                </div>
              </div>
              {active.blockedDomains.length > 0 && (
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <div className="mb-2 text-xs text-slate-400">{dict.focus.blockedWebsites}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {active.blockedDomains.map((d) => (
                      <span key={d} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3">
                    <BlockingStatusLine status={active.blockingStatus} note={active.note ?? ""} />
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* ---------------- FINISHED / RECOVERED / SAVED ---------------- */}
        {finishedPhase && (
          <motion.div
            key="finished"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5"
          >
            <motion.div
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15"
            >
              <CheckCircle2 size={52} className="text-emerald-400" />
            </motion.div>

            <div className="text-center">
              <h2 className="text-2xl font-extrabold">
                {phase === "recovered" ? dict.focus.recovered : dict.focus.finished}
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                {phase === "recovered" ? dict.focus.recoveredDesc : dict.focus.finishedDesc}
              </p>
            </div>

            <Card className="w-full max-w-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{dict.focus.confirmDuration}</span>
                <span className="font-semibold tnum">
                  {formatDurationLabel(active.durationSeconds, {
                    minute: dict.common.minutes,
                    hour: dict.common.hours,
                  })}
                </span>
              </div>
              {active.taskTitle && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{dict.focus.confirmTask}</span>
                  <span className="font-semibold">{active.taskTitle}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">{dict.focus.confirmBlocked}</span>
                <span className="font-semibold">{active.blockedDomains.length} {dict.websites.count}</span>
              </div>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <BlockingStatusLine status={active.blockingStatus} note={active.note ?? ""} />
              </div>
            </Card>

            <Button size="lg" variant="success" onClick={handleSave} disabled={saving} className="w-full max-w-md">
              {saving ? dict.focus.saving : <><Check size={20} /> {dict.focus.saveSession}</>}
            </Button>
          </motion.div>
        )}

        {phase === "saved" && (
          <motion.div
            key="saved"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 py-8"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 size={52} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-extrabold">{dict.focus.sessionSaved}</h2>
              <p className="mt-2 text-sm text-slate-400">{dict.focus.sessionSavedDesc}</p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2.5">
              <Button size="lg" onClick={() => navigate("focus")}>
                <Play size={20} /> {dict.dashboard.startSession}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate("dashboard")}>
                {dict.focus.backToDashboard}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- CONFIRM MODAL ---------------- */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={dict.focus.confirmTitle}
        footer={
          <>
            <Button onClick={handleStart} disabled={starting}>
              <Play size={18} /> {selectedDomains.length === 0 || startWithoutBlocking ? dict.focus.startAnyway : dict.focus.start}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {dict.common.cancel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <Row label={dict.focus.confirmDuration} value={formatDurationLabel(durationMinutes * 60, { minute: dict.common.minutes, hour: dict.common.hours })} />
          <Row
            label={dict.focus.confirmTask}
            value={tasks.find((t) => t.id === taskId)?.title ?? dict.focus.noTask}
          />
          <Row
            label={dict.focus.confirmBlocked}
            value={
              selectedDomains.length > 0
                ? selectedDomains.join("، ")
                : dict.focus.noDomains
            }
          />
          <Row
            label={dict.focus.confirmMethod}
            value={blockingMode === "blacklist" ? dict.focus.blacklist : dict.focus.whitelist}
          />
          <Row
            label={dict.focus.confirmRouter}
            value={
              routerConfig.integrationMode === "manual"
                ? dict.dashboard.routerManual
                : routerConfig.integrationMode === "automatic"
                  ? dict.dashboard.routerConnected
                  : dict.dashboard.routerNone
            }
          />

          <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-950/30 p-3.5 text-xs leading-relaxed text-sky-200">
            <Info size={30} className="shrink-0" />
            <p>{dict.focus.blockingHonestNote}</p>
          </div>

          {routerConfig.integrationMode !== "none" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-950/30 p-3.5 text-xs leading-relaxed text-amber-200">
              <ShieldAlert size={30} className="shrink-0" />
              <p>{dict.router.sessionRules}</p>
            </div>
          )}

          {selectedDomains.length === 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-slate-300">
              <AlertTriangle size={30} className="shrink-0" />
              <p>{dict.focus.startAnyway} — {dict.focus.noDomains}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------- WHITELIST WARNING MODAL ---------------- */}
      <Modal
        open={whitelistModal}
        onClose={() => setWhitelistModal(false)}
        title={dict.focus.whitelistWarningTitle}
        footer={
          <>
            <Button
              variant="danger"
              onClick={() => {
                setWhitelistAck(true);
                setBlockingMode("whitelist");
                setWhitelistModal(false);
              }}
            >
              <AlertTriangle size={18} /> {dict.focus.whitelistAck}
            </Button>
            <Button variant="ghost" onClick={() => setWhitelistModal(false)}>
              {dict.common.cancel}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-300">{dict.focus.whitelistWarning}</p>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-end font-medium text-slate-200">{value}</span>
    </div>
  );
}

function BlockingStatusLine({
  status,
  note,
}: {
  status: FocusSession["blockingStatus"];
  note: string;
}) {
  const map: Record<FocusSession["blockingStatus"], { text: string; tone: "success" | "warning" | "danger" | "info" | "default" }> = {
    "not-configured": { text: "بدون حجب — المؤقت فقط", tone: "default" },
    "manual-required": { text: "الحجب يدوي عبر الراوتر — لم يُنفَّذ تلقائيًا", tone: "warning" },
    applied: { text: "تم تطبيق الحجب والتحقق منه", tone: "success" },
    "not-applied": { text: "فشل تطبيق الحجب", tone: "danger" },
    unverified: { text: "تعذر التحقق من حالة الحجب", tone: "warning" },
  };
  const entry = map[status] ?? map.unverified;
  return (
    <div>
      <Badge tone={entry.tone}>{entry.text}</Badge>
      {note && <p className="mt-2 text-xs leading-relaxed text-slate-400">{note}</p>}
    </div>
  );
}
