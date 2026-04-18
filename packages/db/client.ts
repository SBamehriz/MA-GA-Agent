import { randomUUID } from "node:crypto";

import type { LocalDbState, TableName, TableRecordMap } from "./schema";

export interface LocalDbClient {
  kind: "local-memory";
  createId(prefix?: string): string;
  get<K extends TableName>(table: K, id: string): TableRecordMap[K] | null;
  insert<K extends TableName>(table: K, row: TableRecordMap[K]): TableRecordMap[K];
  list<K extends TableName>(
    table: K,
    predicate?: (row: TableRecordMap[K]) => boolean
  ): TableRecordMap[K][];
  now(): string;
  reset(): void;
  state: LocalDbState;
  update<K extends TableName>(
    table: K,
    id: string,
    updater: (row: TableRecordMap[K]) => TableRecordMap[K]
  ): TableRecordMap[K];
}

function createEmptyState(): LocalDbState {
  return {
    application: new Map(),
    applicationArtifact: new Map(),
    approvalRequest: new Map(),
    department: new Map(),
    evidence: new Map(),
    fundingOpportunity: new Map(),
    graduateProgram: new Map(),
    onboardingAnswer: new Map(),
    person: new Map(),
    personRole: new Map(),
    professionalProfile: new Map(),
    profileField: new Map(),
    researchCycle: new Map(),
    sourceDocument: new Map(),
    story: new Map(),
    university: new Map(),
    user: new Map(),
    userProfileRevision: new Map(),
    voiceAnchor: new Map()
  };
}

export function createLocalDbClient(initialState?: Partial<LocalDbState>): LocalDbClient {
  const state = createEmptyState();
  let counter = 0;

  const seedTable = <K extends TableName>(table: K, rows: LocalDbState[K]) => {
    state[table] = new Map(rows) as LocalDbState[K];
  };

  if (initialState) {
    for (const table of Object.keys(state) as TableName[]) {
      const seededTable = initialState[table];

      if (!seededTable) {
        continue;
      }

      seedTable(table, seededTable);
    }
  }

  return {
    kind: "local-memory",
    createId(prefix = "row") {
      counter += 1;
      return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${randomUUID().slice(0, 8)}`;
    },
    get(table, id) {
      return state[table].get(id) ?? null;
    },
    insert(table, row) {
      state[table].set(row.id, row);
      return row;
    },
    list(table, predicate) {
      const rows = [...state[table].values()];
      return predicate ? rows.filter(predicate) : rows;
    },
    now() {
      return new Date().toISOString();
    },
    reset() {
      for (const table of Object.keys(state) as TableName[]) {
        state[table].clear();
      }
      counter = 0;
    },
    state,
    update(table, id, updater) {
      const current = state[table].get(id);

      if (!current) {
        throw new Error(`Missing ${table} row: ${id}`);
      }

      const next = updater(current);
      state[table].set(id, next);
      return next;
    }
  };
}

export const dbClient = createLocalDbClient();
