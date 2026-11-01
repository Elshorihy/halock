/**
 * Tests — In-memory fake of the D1 prepared-statement surface used by repo.ts.
 * Supports the exact SQL statements issued by worker/lib/repo.ts (incl. the
 * WHERE user_id = ? scoping that enforces data isolation).
 */
import type { D1Like, D1PreparedStatementLike } from "../worker/lib/repo";

type Row = Record<string, unknown>;

class FakeDb {
  tables = new Map<string, Row[]>();

  constructor(tableNames: string[]) {
    for (const name of tableNames) this.tables.set(name, []);
  }

  table(name: string): Row[] {
    return this.tables.get(name) ?? [];
  }
}

function parseValue(token: string): { param: boolean; literal: unknown } {
  const rhs = token.split("=").slice(1).join("=").trim();
  if (rhs.includes("?")) return { param: true, literal: undefined };
  if (/^'.*'$/s.test(rhs)) return { param: false, literal: rhs.slice(1, -1) };
  if (rhs === "NULL") return { param: false, literal: null };
  return { param: false, literal: rhs };
}

function matchRow(
  row: Row,
  where: { col: string; param: boolean; literal: unknown }[],
  values: unknown[],
  offset: number,
): boolean {
  let valueIndex = offset;
  for (const clause of where) {
    const expected = clause.param ? values[valueIndex++] : clause.literal;
    const actual = row[clause.col];
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
    } else if (String(actual) !== String(expected)) {
      return false;
    }
  }
  return true;
}

function parseWhere(sql: string): {
  clauses: { col: string; param: boolean; literal: unknown }[];
  limit: number | null;
} {
  const whereMatch = /WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/is.exec(sql);
  const limitMatch = /LIMIT\s+(\d+)/i.exec(sql);
  const limit = limitMatch ? Number(limitMatch[1]) : null;
  if (!whereMatch) return { clauses: [], limit };
  const raw = whereMatch[1]
    .split(/AND/i)
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    clauses: raw.map((clause) => ({
      col: clause.split("=")[0].trim(),
      ...parseValue(clause),
    })),
    limit,
  };
}

/** Count bound-parameter placeholders in a SQL fragment. */
function countParams(fragment: string): number {
  return (fragment.match(/\?/g) ?? []).length;
}

class FakeStatement implements D1PreparedStatementLike {
  constructor(
    private db: FakeDb,
    private sql: string,
    private values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new FakeStatement(this.db, this.sql, values);
  }

  private tableName(): string {
    const m = /(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i.exec(this.sql);
    if (!m) throw new Error(`FakeD1: cannot parse table from: ${this.sql}`);
    return m[1];
  }

  async first<T>(): Promise<T | null> {
    const rows = this.selectRows();
    return (rows[0] as T) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.selectRows() as T[] };
  }

  private selectRows(): Row[] {
    const sql = this.sql.trim();
    if (!/^SELECT/i.test(sql)) throw new Error(`FakeD1: not a SELECT: ${sql}`);
    const table = this.tableName();
    const { clauses, limit } = parseWhere(sql);
    let rows = this.db.table(table).slice();
    if (clauses.length > 0) {
      rows = rows.filter((row) => matchRow(row, clauses, this.values, 0));
    }
    // ORDER BY created_at DESC / start_time DESC support
    const orderMatch = /ORDER BY\s+(\w+)\s+(DESC|ASC)/i.exec(sql);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = orderMatch[2].toUpperCase() === "DESC" ? -1 : 1;
      rows.sort((a, b) => (String(a[col]) > String(b[col]) ? dir : -dir));
    }
    if (limit !== null) rows = rows.slice(0, limit);
    return rows;
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const sql = this.sql.trim();
    const table = this.tableName();

    if (/^INSERT/i.test(sql)) {
      const colsMatch = /\(([^)]+)\)\s*VALUES/i.exec(sql);
      if (!colsMatch) throw new Error(`FakeD1: cannot parse INSERT: ${sql}`);
      const cols = colsMatch[1].split(",").map((c) => c.trim());
      const row: Row = {};
      cols.forEach((col, i) => {
        row[col] = this.values[i] ?? null;
      });
      this.db.table(table).push(row);
      return { success: true, meta: { changes: 1 } };
    }

    if (/^UPDATE/i.test(sql)) {
      const setMatch = /SET\s+(.+?)\s+WHERE/is.exec(sql);
      if (!setMatch) throw new Error(`FakeD1: cannot parse UPDATE: ${sql}`);
      const setClauses = setMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((clause) => ({
          col: clause.split("=")[0].trim(),
          ...parseValue(clause),
        }));
      const setParamCount = countParams(setMatch[1]);
      const { clauses } = parseWhere(sql);
      const rows = this.db.table(table);
      let changes = 0;
      for (const row of rows) {
        if (clauses.length === 0 || matchRow(row, clauses, this.values, setParamCount)) {
          let valueIndex = 0;
          for (const set of setClauses) {
            row[set.col] = set.param ? this.values[valueIndex++] : set.literal;
          }
          changes += 1;
        }
      }
      return { success: true, meta: { changes } };
    }

    if (/^DELETE/i.test(sql)) {
      const { clauses } = parseWhere(sql);
      const rows = this.db.table(table);
      const keep: Row[] = [];
      let changes = 0;
      for (const row of rows) {
        if (clauses.length > 0 && matchRow(row, clauses, this.values, 0)) {
          changes += 1;
        } else {
          keep.push(row);
        }
      }
      this.db.tables.set(table, keep);
      return { success: true, meta: { changes } };
    }

    throw new Error(`FakeD1: unsupported SQL: ${sql}`);
  }
}

export class FakeD1 implements D1Like {
  db: FakeDb;

  constructor(tableNames: string[]) {
    this.db = new FakeDb(tableNames);
  }

  prepare(sql: string): D1PreparedStatementLike {
    return new FakeStatement(this.db, sql);
  }
}

export const ALL_TABLES = [
  "users",
  "auth_sessions",
  "focus_sessions",
  "tasks",
  "blocked_domains",
  "user_settings",
  "router_settings",
  "router_logs",
];
