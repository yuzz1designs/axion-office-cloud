import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FocusState, WorkspaceCalendarEvent, WorkspaceTask } from "./googleWorkspaceCore";

export interface WorkspaceGrant {
  refreshToken: string;
  email: string;
  scopes: string[];
  connectedAt: string;
}

export interface WorkspaceProfileState {
  grant: WorkspaceGrant;
  taskListId?: string;
  calendarSyncToken?: string;
  events: WorkspaceCalendarEvent[];
  tasks: WorkspaceTask[];
  focus: FocusState;
  lastCalendarSyncAt?: string;
  lastTasksSyncAt?: string;
  calendarError?: string;
  tasksError?: string;
}

type WorkspaceFile = Record<string, WorkspaceProfileState>;

export class GoogleWorkspaceStore {
  private readonly filePath: string;

  constructor(private readonly directory = path.resolve(process.env.AXION_DATA_DIR || path.join(process.cwd(), ".axion-local"))) {
    this.filePath = path.join(directory, "google-workspace.json");
  }

  private readAll(): WorkspaceFile {
    if (!existsSync(this.filePath)) return {};
    try {
      const value = JSON.parse(readFileSync(this.filePath, "utf8"));
      return value && typeof value === "object" ? value as WorkspaceFile : {};
    } catch {
      throw new Error("GOOGLE_WORKSPACE_STORE_INVALID");
    }
  }

  private writeAll(value: WorkspaceFile) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
    chmodSync(this.filePath, 0o600);
  }

  read(profileId: string): WorkspaceProfileState | null {
    const state = this.readAll()[profileId];
    if (!state?.grant?.refreshToken) return null;
    return {
      ...state,
      events: state.events ?? [],
      tasks: state.tasks ?? [],
      focus: state.focus ?? { totalMinutes: 0, completedTaskMinutes: {} },
    };
  }

  writeGrant(profileId: string, grant: WorkspaceGrant) {
    const all = this.readAll();
    const previous = all[profileId];
    all[profileId] = {
      grant,
      events: previous?.events ?? [],
      tasks: previous?.tasks ?? [],
      focus: previous?.focus ?? { totalMinutes: 0, completedTaskMinutes: {} },
      taskListId: previous?.taskListId,
      calendarSyncToken: previous?.calendarSyncToken,
    };
    this.writeAll(all);
  }

  update(profileId: string, patch: Partial<Omit<WorkspaceProfileState, "grant">>) {
    const all = this.readAll();
    const current = all[profileId];
    if (!current) throw new Error("GOOGLE_WORKSPACE_NOT_CONNECTED");
    all[profileId] = { ...current, ...patch };
    this.writeAll(all);
  }

  clear(profileId: string) {
    const all = this.readAll();
    delete all[profileId];
    this.writeAll(all);
  }
}
