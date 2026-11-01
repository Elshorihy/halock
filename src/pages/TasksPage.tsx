/**
 * HALOCK — Tasks: simple and fast. Add / edit / delete / complete,
 * category, priority, optional due date, linked focus sessions count.
 */

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Circle, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import type { Task, TaskPriority } from "@shared/types";
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from "@/components/ui";

export function TasksPage() {
  const { dict, tasks, sessions, createTask, updateTask, deleteTask, toast } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const visible = showDone ? done : remaining;

  const linkedSessionsCount = (taskId: string) =>
    sessions.filter((s) => s.taskId === taskId).length;

  function openCreate() {
    setEditing(null);
    setTitle("");
    setCategory("");
    setPriority("medium");
    setDueDate("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setTitle(task.title);
    setCategory(task.category);
    setPriority(task.priority);
    setDueDate(task.dueDate ?? "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setError(null);
    const clean = title.trim();
    if (clean.length < 1) {
      setError("عنوان المهمة مطلوب");
      return;
    }
    if (clean.length > 160) {
      setError("عنوان المهمة طويل جدًا");
      return;
    }
    try {
      if (editing) {
        await updateTask(editing.id, {
          title: clean,
          category: category.trim() || "عام",
          priority,
          dueDate: dueDate || null,
        });
        toast(dict.toasts.saved, "success");
      } else {
        await createTask({
          title: clean,
          category: category.trim() || "عام",
          priority,
          dueDate: dueDate || null,
        });
        toast(dict.toasts.saved, "success");
      }
      setModalOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const priorityLabel = (p: TaskPriority) =>
    p === "high" ? dict.tasks.priorities.high : p === "low" ? dict.tasks.priorities.low : dict.tasks.priorities.medium;

  const isOverdue = (t: Task) =>
    !!t.dueDate && !t.completed && new Date(t.dueDate + "T23:59:59").getTime() < Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{dict.tasks.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {dict.tasks.remaining}: {remaining.length} — {dict.tasks.done}: {done.length}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> {dict.tasks.addTask}
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowDone(false)}
          className={`min-h-[44px] rounded-xl px-5 text-sm font-semibold transition focus-visible-ring ${
            !showDone ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.05]"
          }`}
        >
          {dict.tasks.pending} ({remaining.length})
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={`min-h-[44px] rounded-xl px-5 text-sm font-semibold transition focus-visible-ring ${
            showDone ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.05]"
          }`}
        >
          {dict.tasks.done} ({done.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ListTodo size={40} />}
          title={dict.tasks.empty}
          desc={dict.tasks.emptyDesc}
          action={
            <Button onClick={openCreate}>
              <Plus size={18} /> {dict.tasks.addTask}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((t) => (
            <Card key={t.id} className={`flex items-center justify-between gap-3 ${t.completed ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label={t.completed ? dict.tasks.markPending : dict.tasks.markDone}
                  onClick={() =>
                    void updateTask(t.id, { completed: !t.completed }).then(() =>
                      toast(t.completed ? dict.tasks.markPending : dict.tasks.markDone, "success"),
                    )
                  }
                  className="shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-white/[0.07] focus-visible-ring"
                >
                  {t.completed ? (
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  ) : (
                    <Circle size={24} className="text-slate-500" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className={`truncate font-semibold ${t.completed ? "line-through" : ""}`}>{t.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge>{t.category}</Badge>
                    <Badge tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "default"}>
                      {priorityLabel(t.priority)}
                    </Badge>
                    {t.dueDate && (
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          isOverdue(t) ? "text-red-400" : "text-slate-400"
                        }`}
                      >
                        <CalendarDays size={13} />
                        {t.dueDate}
                        {isOverdue(t) ? ` — ${dict.tasks.overdue}` : ""}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {dict.tasks.linkedSessions}: {linkedSessionsCount(t.id)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  aria-label={dict.common.edit}
                  onClick={() => openEdit(t)}
                  className="rounded-xl p-3 text-slate-300 hover:bg-white/[0.07] focus-visible-ring"
                >
                  <Pencil size={18} />
                </button>
                <button
                  aria-label={dict.common.delete}
                  onClick={() => setDeleting(t)}
                  className="rounded-xl p-3 text-red-300 hover:bg-red-500/10 focus-visible-ring"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? dict.tasks.editTask : dict.tasks.addTask}
        footer={
          <>
            <Button onClick={handleSave}>{dict.common.save}</Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {dict.common.cancel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label={dict.tasks.taskTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            autoFocus
          />
          <Input
            label={dict.tasks.categoryLabel}
            placeholder={dict.tasks.categoryPlaceholder}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={60}
          />
          <Select
            label={dict.tasks.priority}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">{dict.tasks.priorities.low}</option>
            <option value="medium">{dict.tasks.priorities.medium}</option>
            <option value="high">{dict.tasks.priorities.high}</option>
          </Select>
          <Input
            label={`${dict.tasks.dueDate} (${dict.common.optional})`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
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
                await deleteTask(deleting.id);
                setDeleting(null);
                toast(dict.toasts.deleted, "success");
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
          {dict.tasks.deleteConfirm} <span className="font-semibold">{deleting?.title}</span>
        </p>
      </Modal>
    </div>
  );
}
