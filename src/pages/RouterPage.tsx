/**
 * HALOCK — Router integration (Huawei DN8245V).
 *
 * Manual mode: a complete, interactive 10-step setup wizard + blocking test +
 * logs + recovery guide. Works without any API.
 *
 * Automatic mode: honestly disabled with the six proof requirements listed.
 * No fake API, no invented parameters, no unproven claims.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Gauge,
  Info,
  Lock,
  RefreshCw,
  Router as RouterIcon,
  Save,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  AutomaticRouterProvider,
  ManualRouterProvider,
  PROOF_REQUIREMENTS,
} from "@/lib/router-provider";
import type { RouterDiagnostics } from "@shared/types";
import { Badge, Button, Card, Input, Select } from "@/components/ui";

export function RouterPage() {
  const {
    dict,
    dataSource,
    routerConfig,
    routerLogs,
    saveRouterConfig,
    domains,
    toast,
  } = useApp();

  const [targetDevice, setTargetDevice] = useState(routerConfig.targetDevice ?? "");
  const [routerUrl, setRouterUrl] = useState(routerConfig.routerUrl ?? "");
  const [mode, setMode] = useState<"manual" | "automatic">(
    routerConfig.integrationMode === "automatic" ? "automatic" : "manual",
  );
  const [steps, setSteps] = useState<Record<string, boolean>>(routerConfig.manualSteps ?? {});
  const [testDomain, setTestDomain] = useState(domains.find((d) => d.enabled)?.domain ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<RouterDiagnostics | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetDevice(routerConfig.targetDevice ?? "");
    setRouterUrl(routerConfig.routerUrl ?? "");
    setSteps(routerConfig.manualSteps ?? {});
    setMode(routerConfig.integrationMode === "automatic" ? "automatic" : "manual");
  }, [routerConfig]);

  const manual = useMemo(() => new ManualRouterProvider(dataSource), [dataSource]);
  const automatic = useMemo(() => new AutomaticRouterProvider(dataSource), [dataSource]);

  const completedSteps = Object.values(steps).filter(Boolean).length;
  const allStepsDone = completedSteps >= 10;

  const statusLabel = allStepsDone ? dict.router.statusComplete : dict.router.statusIncomplete;

  async function handleSave() {
    setSaving(true);
    try {
      await saveRouterConfig({
        provider: mode,
        integrationMode: mode,
        targetDevice: targetDevice.trim() || null,
        routerUrl: routerUrl.trim() || null,
        manualSteps: steps,
        status: mode === "manual" ? (allStepsDone ? "manual-configured" : "manual-incomplete") : "disconnected",
      });
      toast(dict.router.saved, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const domain = testDomain.trim();
    if (!domain) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = mode === "automatic"
        ? await automatic.verifyBlocking(domain)
        : await manual.verifyBlocking(domain);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        ok: false,
        operation: "verify",
        result: "error",
        message: (e as Error).message,
        messageEn: (e as Error).message,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  }

  async function runAutoProbe() {
    // Demonstrates honestly that automatic mode does nothing.
    const result = await automatic.applyBlocking({
      domains: [],
      mode: "blacklist",
      targetDevice: targetDevice.trim() || null,
    });
    setTestResult(result);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <RouterIcon size={26} className="text-violet-glow" /> {dict.router.title}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{dict.router.desc}</p>
      </div>

      {/* Honest note */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/25 bg-sky-950/25 p-4 text-xs leading-relaxed text-sky-200">
        <Info size={32} className="shrink-0" />
        <p>{dict.router.honestNote}</p>
      </div>

      {/* Mode selection */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Gauge size={16} /> {dict.router.mode}
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => setMode("manual")}
            className={`rounded-2xl border p-4 text-start transition focus-visible-ring ${
              mode === "manual"
                ? "border-violet-glow/70 bg-violet-glow/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{dict.router.manualMode}</span>
              {mode === "manual" && <CheckCircle2 size={18} className="text-violet-glow" />}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{dict.router.sessionRules}</p>
          </button>

          <button
            onClick={() => setMode("automatic")}
            className={`rounded-2xl border p-4 text-start transition focus-visible-ring ${
              mode === "automatic"
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{dict.router.autoMode}</span>
              <Badge tone="danger">{dict.common.notAvailable}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-amber-300/90">{dict.router.autoUnsupported}</p>
          </button>
        </div>

        {mode === "automatic" && (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-950/25 p-4">
            <div className="flex items-start gap-2.5">
              <FileWarning size={32} className="shrink-0 text-amber-300" />
              <div>
                <div className="text-sm font-semibold text-amber-200">{dict.router.autoUnsupported}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-200/85">
                  {dict.router.autoUnsupportedDesc}
                </p>
              </div>
            </div>

            <h3 className="mt-4 mb-2 text-xs font-semibold text-amber-200">{dict.router.proofTitle}</h3>
            <ul className="flex flex-col gap-1.5">
              {PROOF_REQUIREMENTS.map((req) => (
                <li key={req.id} className="flex items-center gap-2 text-xs text-amber-100/90">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/40 text-[10px]">
                    ✕
                  </span>
                  {req.title}
                </li>
              ))}
            </ul>

            <Button variant="secondary" size="sm" className="mt-4" onClick={runAutoProbe}>
              <TerminalSquare size={16} /> {dict.router.testRun} ({dict.router.autoMode})
            </Button>
          </div>
        )}
      </Card>

      {/* Configuration */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{dict.router.integrationLayer}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={dict.router.device}
            placeholder={dict.router.devicePlaceholder}
            value={targetDevice}
            onChange={(e) => setTargetDevice(e.target.value)}
          />
          <Input
            label={dict.router.routerUrl}
            placeholder={dict.router.routerUrlPlaceholder}
            value={routerUrl}
            onChange={(e) => setRouterUrl(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <Lock size={24} className="shrink-0" />
          {dict.router.securityNoteDesc}
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          <Save size={18} /> {saving ? dict.common.loading : dict.router.saveConfig}
        </Button>
      </Card>

      {/* Manual checklist */}
      {mode === "manual" && (
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <ClipboardList size={16} /> {dict.router.checklistTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{dict.router.checklistDesc}</p>
            </div>
            <Badge tone={allStepsDone ? "success" : "warning"}>
              {statusLabel} — {completedSteps}/10
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-l from-focus to-violet-glow transition-all duration-500"
              style={{ width: `${(completedSteps / 10) * 100}%` }}
            />
          </div>

          <ol className="flex flex-col gap-2">
            {[
              { id: "s1", text: dict.router.steps.s1 },
              { id: "s2", text: dict.router.steps.s2 },
              { id: "s3", text: dict.router.steps.s3 },
              { id: "s4", text: dict.router.steps.s4 },
              { id: "s5", text: dict.router.steps.s5 },
              { id: "s6", text: dict.router.steps.s6 },
              { id: "s7", text: dict.router.steps.s7 },
              { id: "s8", text: dict.router.steps.s8 },
              { id: "s9", text: dict.router.steps.s9 },
              { id: "s10", text: dict.router.steps.s10 },
            ].map((step, index) => {
              const checked = !!steps[step.id];
              return (
                <li key={step.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                      checked
                        ? "border-emerald-500/30 bg-emerald-950/25"
                        : "border-white/[0.07] bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = { ...steps, [step.id]: e.target.checked };
                        setSteps(next);
                      }}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-violet-glow"
                    />
                    <span className="flex-1 text-sm leading-relaxed text-slate-200">
                      <span className="me-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] text-xs font-bold text-slate-300">
                        {index + 1}
                      </span>
                      {step.text}
                    </span>
                    {checked && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />}
                  </label>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="text-xs font-semibold text-slate-300">{dict.router.restoreGuideTitle}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{dict.router.restoreGuide}</p>
          </div>
        </Card>
      )}

      {/* Blocking test */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <RefreshCw size={16} /> {dict.router.testTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{dict.router.testDesc}</p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={dict.router.testDomain}
              value={testDomain}
              onChange={(e) => setTestDomain(e.target.value)}
              placeholder="youtube.com"
            />
          </div>
          <Button onClick={handleTest} disabled={testing} className="sm:mb-0.5">
            {testing ? dict.router.testing : dict.router.testRun}
          </Button>
        </div>

        {testResult && (
          <div
            className={`mt-4 rounded-xl border p-3.5 text-sm ${
              testResult.result === "likely-blocked"
                ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
                : testResult.result === "likely-reachable"
                  ? "border-amber-500/30 bg-amber-950/30 text-amber-200"
                  : "border-white/10 bg-white/[0.03] text-slate-200"
            }`}
          >
            {testResult.message}
            {testResult.result === "unverified" && (
              <div className="mt-1 text-xs opacity-80">{dict.router.testDesc}</div>
            )}
          </div>
        )}

        {allStepsDone && (
          <div className="mt-4">
            <Badge tone="success">
              <CheckCircle2 size={12} /> {dict.router.statusComplete}
            </Badge>
          </div>
        )}
      </Card>

      {/* Session rules */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <ShieldCheck size={16} /> {dict.router.sessionRulesTitle}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{dict.router.sessionRules}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200">
          <AlertTriangle size={24} className="shrink-0" />
          <span>{dict.router.recoverySteps}</span>
        </div>
      </Card>

      {/* Logs */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <TerminalSquare size={16} /> {dict.router.logsTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{dict.router.logsDesc}</p>

        {routerLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{dict.router.noLogs}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-slate-400">
                  <th className="p-2 text-start font-medium">{dict.router.logTime}</th>
                  <th className="p-2 text-start font-medium">{dict.router.logAction}</th>
                  <th className="p-2 text-start font-medium">{dict.router.logResult}</th>
                  <th className="p-2 text-start font-medium">{dict.router.logMessage}</th>
                  <th className="p-2 text-start font-medium">{dict.router.logDevice}</th>
                </tr>
              </thead>
              <tbody>
                {routerLogs.slice(0, 25).map((log) => (
                  <tr key={log.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="p-2 whitespace-nowrap tnum text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2 whitespace-nowrap">{log.action}</td>
                    <td className="p-2 whitespace-nowrap">
                      <Badge
                        tone={
                          log.result.includes("manual") || log.result === "skipped"
                            ? "info"
                            : log.result === "not-supported" || log.result === "error"
                              ? "danger"
                              : log.result.includes("likely-blocked")
                                ? "success"
                                : "warning"
                        }
                      >
                        {log.result}
                      </Badge>
                    </td>
                    <td className="p-2 min-w-[180px]">{log.message}</td>
                    <td className="p-2 whitespace-nowrap text-slate-500">{log.device ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recovery & security */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <RefreshCw size={16} /> {dict.router.recoveryTitle}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{dict.router.recoveryDesc}</p>
        <p className="mt-2 rounded-xl bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
          {dict.router.recoverySteps}
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs leading-relaxed text-emerald-200">
          <Lock size={24} className="shrink-0" />
          <span>
            <b>{dict.router.securityNote}:</b> {dict.router.securityNoteDesc}
          </span>
        </div>
      </Card>
    </div>
  );
}

/** Small helper so provider construction stays inside React scope. */
function useAppDataSource() {
  const { dataSource } = useApp();
  return dataSource;
}
