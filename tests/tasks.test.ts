/**
 * Tests — Task CRUD + user data isolation (spec §16: "Task CRUD", "User data isolation").
 */
import { describe, expect, it, beforeEach } from "vitest";
import { FakeD1, ALL_TABLES } from "./fake-d1";
import {
  createUser,
  insertTask,
  listTasks,
  updateTaskRow,
  deleteTaskRow,
  insertFocusSession,
  listFocusSessions,
  completeFocusSession,
  getActiveFocusSession,
} from "../worker/lib/repo";
import type { Task, FocusSession } from "../shared/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2, 10)}`,
    userId: "user_a",
    title: "دراسة الرياضيات",
    category: "رياضيات",
    priority: "high",
    completed: false,
    dueDate: "2026-12-01",
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("task CRUD (repository)", () => {
  let db: FakeD1;

  beforeEach(async () => {
    db = new FakeD1(ALL_TABLES);
    await createUser(db, { id: "user_a", email: "a@x.com", displayName: "A", passwordHash: "h" });
    await createUser(db, { id: "user_b", email: "b@x.com", displayName: "B", passwordHash: "h" });
  });

  it("creates and lists tasks", async () => {
    await insertTask(db, makeTask({ id: "t1", title: "واحدة" }));
    await insertTask(db, makeTask({ id: "t2", title: "اثنتان" }));
    const tasks = await listTasks(db, "user_a");
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title).sort()).toEqual(["اثنتان", "واحدة"]);
  });

  it("updates a task (title, priority, completion)", async () => {
    await insertTask(db, makeTask({ id: "t1" }));
    const updated = await updateTaskRow(db, "user_a", "t1", {
      title: "عنوان جديد",
      priority: "low",
      completed: true,
      completedAt: new Date().toISOString(),
    });
    expect(updated?.title).toBe("عنوان جديد");
    expect(updated?.priority).toBe("low");
    expect(updated?.completed).toBe(true);

    const tasks = await listTasks(db, "user_a");
    expect(tasks[0].title).toBe("عنوان جديد");
  });

  it("deletes a task", async () => {
    await insertTask(db, makeTask({ id: "t1" }));
    expect(await deleteTaskRow(db, "user_a", "t1")).toBe(true);
    expect(await listTasks(db, "user_a")).toHaveLength(0);
    // Second delete is a no-op.
    expect(await deleteTaskRow(db, "user_a", "t1")).toBe(false);
  });
});

describe("user data isolation", () => {
  let db: FakeD1;

  beforeEach(async () => {
    db = new FakeD1(ALL_TABLES);
    await createUser(db, { id: "user_a", email: "a@x.com", displayName: "A", passwordHash: "h" });
    await createUser(db, { id: "user_b", email: "b@x.com", displayName: "B", passwordHash: "h" });
  });

  it("user B cannot see user A's tasks", async () => {
    await insertTask(db, makeTask({ id: "t1", userId: "user_a" }));
    expect(await listTasks(db, "user_b")).toHaveLength(0);
    expect(await listTasks(db, "user_a")).toHaveLength(1);
  });

  it("user B cannot update or delete user A's tasks", async () => {
    await insertTask(db, makeTask({ id: "t1", userId: "user_a" }));
    const updated = await updateTaskRow(db, "user_b", "t1", { title: "stolen" });
    expect(updated).toBeNull();
    expect(await deleteTaskRow(db, "user_b", "t1")).toBe(false);
    const tasks = await listTasks(db, "user_a");
    expect(tasks[0].title).not.toBe("stolen");
  });

  it("user B cannot see user A's sessions", async () => {
    const session: FocusSession = {
      id: "s1",
      userId: "user_a",
      taskId: null,
      taskTitle: null,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: 1500,
      status: "active",
      blockedDomains: [],
      blockingMode: "blacklist",
      blockingStatus: "not-configured",
      routerMode: "none",
    };
    await insertFocusSession(db, session);
    expect(await listFocusSessions(db, "user_b")).toHaveLength(0);
    expect(await getActiveFocusSession(db, "user_b")).toBeNull();
    expect((await getActiveFocusSession(db, "user_a"))?.id).toBe("s1");
  });

  it("user B cannot complete user A's session", async () => {
    const session: FocusSession = {
      id: "s1",
      userId: "user_a",
      taskId: null,
      taskTitle: null,
      startTime: new Date(Date.now() - 3600_000).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: 1500,
      status: "active",
      blockedDomains: [],
      blockingMode: "blacklist",
      blockingStatus: "not-configured",
      routerMode: "none",
    };
    await insertFocusSession(db, session);
    const result = await completeFocusSession(db, "user_b", "s1", new Date().toISOString());
    expect(result.changed).toBe(false);
    // Still active for the real owner.
    expect((await getActiveFocusSession(db, "user_a"))?.status).toBe("active");
  });
});

describe("session completion idempotence at the data layer", () => {
  it("second completion changes 0 rows", async () => {
    const db = new FakeD1(ALL_TABLES);
    await createUser(db, { id: "user_a", email: "a@x.com", displayName: "A", passwordHash: "h" });
    const session: FocusSession = {
      id: "s1",
      userId: "user_a",
      taskId: null,
      taskTitle: null,
      startTime: new Date(Date.now() - 3600_000).toISOString(),
      endTime: new Date(Date.now() - 60_000).toISOString(),
      durationSeconds: 1500,
      status: "active",
      blockedDomains: [],
      blockingMode: "blacklist",
      blockingStatus: "not-configured",
      routerMode: "none",
    };
    await insertFocusSession(db, session);

    const first = await completeFocusSession(db, "user_a", "s1", new Date().toISOString());
    expect(first.changed).toBe(true);
    expect(first.session?.status).toBe("completed");

    const second = await completeFocusSession(db, "user_a", "s1", new Date().toISOString());
    expect(second.changed).toBe(false);
  });
});
