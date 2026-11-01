/**
 * HALOCK — Website blocking management.
 * Add / edit / delete / enable-disable rules, categories, search,
 * JSON import/export, blacklist & whitelist modes with a clear warning.
 */

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { parseDomainInput, parseImportedDomains, DOMAIN_CATEGORIES } from "@shared/domains";
import type { BlockedDomain, BlockingMode, DomainCategory } from "@shared/types";
import { Badge, Button, Card, Input, Modal, Select, Toggle, EmptyState } from "@/components/ui";

export function WebsitesPage() {
  const {
    dict,
    domains,
    settings,
    addDomain,
    updateDomain,
    deleteDomain,
    importDomains,
    updateSettings,
    toast,
  } = useApp();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DomainCategory | "all">("all");
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState<DomainCategory>("social");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlockedDomain | null>(null);
  const [deleting, setDeleting] = useState<BlockedDomain | null>(null);
  const [whitelistConfirm, setWhitelistConfirm] = useState(false);
  const [importReport, setImportReport] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const blockingMode: BlockingMode = settings.defaultBlockingMode;

  const filtered = useMemo(() => {
    return domains.filter((d) => {
      const matchesSearch = d.domain.includes(search.trim().toLowerCase());
      const matchesCategory = categoryFilter === "all" || d.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [domains, search, categoryFilter]);

  const categoryLabel = (c: DomainCategory) =>
    c === "social"
      ? dict.websites.categories.social
      : c === "video"
        ? dict.websites.categories.video
        : c === "gaming"
          ? dict.websites.categories.gaming
          : dict.websites.categories.other;

  async function handleAdd() {
    setAddError(null);
    const parsed = parseDomainInput(newDomain);
    if (!parsed.ok || !parsed.domain) {
      setAddError(parsed.message ?? dict.websites.invalidDomain);
      return;
    }
    try {
      const result = await addDomain({ domain: parsed.domain, category: newCategory });
      if (!result.ok) {
        setAddError(result.message === "duplicate" ? dict.websites.duplicate : result.message);
        return;
      }
      setNewDomain("");
      toast(dict.websites.added, "success");
    } catch (error) {
      setAddError((error as Error).message || dict.toasts.error);
    }
  }

  function handleExport() {
    const payload = JSON.stringify(
      domains.map((d) => ({ domain: d.domain, category: d.category, enabled: d.enabled })),
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halock-domains-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const result = parseImportedDomains(text);
      if (!result.ok && result.entries.length === 0) {
        setImportReport({ added: 0, skipped: 0, errors: result.errors });
        return;
      }
      const report = await importDomains(result.entries);
      setImportReport({ ...report, errors: result.errors });
      toast(dict.toasts.imported, "success");
    } catch {
      toast(dict.toasts.error, "error");
    }
  }

  async function setMode(mode: BlockingMode) {
    if (mode === "whitelist") {
      setWhitelistConfirm(true);
      return;
    }
    await updateSettings({ defaultBlockingMode: "blacklist" });
    toast(dict.websites.updated, "success");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{dict.websites.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{dict.websites.desc}</p>
      </div>

      {/* Mode switch */}
      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-300">{dict.websites.modeTitle}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setMode("blacklist")}
              className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition focus-visible-ring ${
                blockingMode === "blacklist"
                  ? "border-violet-glow/70 bg-violet-glow/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              {dict.focus.blacklist}
            </button>
            <button
              onClick={() => setMode("whitelist")}
              className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition focus-visible-ring ${
                blockingMode === "whitelist"
                  ? "border-amber-500/70 bg-amber-500/15 text-amber-200"
                  : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              {dict.focus.whitelist}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {blockingMode === "blacklist" ? dict.websites.blacklistDesc : dict.websites.whitelistDesc}
          </p>
          {blockingMode === "whitelist" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-950/30 p-3 text-xs text-amber-200">
              <AlertTriangle size={28} className="shrink-0" />
              <span>{dict.websites.whitelistWarn}</span>
            </div>
          )}
          <p className="text-xs text-slate-500">{dict.websites.defaultsNote}</p>
        </div>
      </Card>

      {/* Add */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Plus size={16} /> {dict.websites.addWebsite}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={dict.websites.title}
              placeholder={dict.websites.domainPlaceholder}
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
            />
          </div>
          <div className="sm:w-48">
            <Select
              label={dict.websites.category}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as DomainCategory)}
            >
              {DOMAIN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleAdd} className="sm:mb-0.5">
            <Plus size={18} /> {dict.common.add}
          </Button>
        </div>
        {addError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-200">
            <AlertTriangle size={16} /> {addError}
          </div>
        )}
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="halock-input pe-11"
            placeholder={dict.websites.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DomainCategory | "all")}
            className="w-40"
          >
            <option value="all">{dict.common.all}</option>
            {DOMAIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={16} /> {dict.websites.exportJson}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {dict.websites.importJson}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="text-sm text-slate-400">
        {domains.length} {dict.websites.count}
      </div>

      {/* Import report */}
      {importReport && (
        <Card className="border-sky-500/25">
          <div className="text-sm text-slate-200">
            {dict.websites.importResult}: {importReport.added} — {dict.common.disabled}: {importReport.skipped}
          </div>
          {importReport.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-300">
              {importReport.errors.slice(0, 8).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <button className="mt-2 text-xs text-slate-400 underline" onClick={() => setImportReport(null)}>
            {dict.common.close}
          </button>
        </Card>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Globe size={40} />}
          title={dict.websites.empty}
          desc={dict.websites.emptyDesc}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((d) => (
            <div
              key={d.id}
              className={`glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                d.enabled ? "" : "opacity-55"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                  <Globe size={18} className="text-violet-glow" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{d.domain}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge>{categoryLabel(d.category)}</Badge>
                    <span className="text-xs text-slate-500">
                      {d.enabled ? dict.common.enabled : dict.common.disabled}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={dict.common.edit}
                  onClick={() => setEditing(d)}
                  className="rounded-xl p-3 text-slate-300 hover:bg-white/[0.07] focus-visible-ring"
                >
                  <Pencil size={18} />
                </button>
                <button
                  aria-label={dict.common.delete}
                  onClick={() => setDeleting(d)}
                  className="rounded-xl p-3 text-red-300 hover:bg-red-500/10 focus-visible-ring"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  role="switch"
                  aria-checked={d.enabled}
                  aria-label={d.enabled ? dict.websites.disableRule : dict.websites.enableRule}
                  onClick={() => void updateDomain(d.id, { enabled: !d.enabled })}
                  className={`relative ms-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible-ring ${
                    d.enabled ? "bg-violet-glow" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      d.enabled ? "start-[calc(100%-1.5rem)]" : "start-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={dict.common.edit}
        footer={
          <>
            <Button
              onClick={async () => {
                if (!editing) return;
                const parsed = parseDomainInput(editing.domain);
                if (!parsed.ok || !parsed.domain) {
                  toast(dict.websites.invalidDomain, "error");
                  return;
                }
                try {
                  await updateDomain(editing.id, { domain: parsed.domain, category: editing.category });
                  setEditing(null);
                  toast(dict.websites.updated, "success");
                } catch (error) {
                  toast((error as Error).message || dict.toasts.error, "error");
                }
              }}
            >
              {dict.common.save}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {dict.common.cancel}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <Input
              label="Domain"
              value={editing.domain}
              onChange={(e) => setEditing({ ...editing, domain: e.target.value })}
            />
            <Select
              label={dict.websites.category}
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value as DomainCategory })}
            >
              {DOMAIN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </Select>
            <Toggle
              checked={editing.enabled}
              onChange={(v) => setEditing({ ...editing, enabled: v })}
              label={editing.enabled ? dict.websites.enableRule : dict.websites.disableRule}
            />
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={dict.common.delete}
        footer={
          <>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteDomain(deleting.id);
                  setDeleting(null);
                  toast(dict.websites.deleted, "success");
                } catch (error) {
                  toast((error as Error).message || dict.toasts.error, "error");
                }
              }}
            >
              {dict.common.delete}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {dict.common.cancel}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {dict.websites.deleteConfirm} <span className="font-semibold">{deleting?.domain}</span>
        </p>
      </Modal>

      {/* Whitelist confirm */}
      <Modal
        open={whitelistConfirm}
        onClose={() => setWhitelistConfirm(false)}
        title={dict.focus.whitelistWarningTitle}
        footer={
          <>
            <Button
              variant="danger"
              onClick={async () => {
                await updateSettings({ defaultBlockingMode: "whitelist" });
                setWhitelistConfirm(false);
                toast(dict.websites.updated, "success");
              }}
            >
              {dict.focus.whitelistAck}
            </Button>
            <Button variant="ghost" onClick={() => setWhitelistConfirm(false)}>
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
