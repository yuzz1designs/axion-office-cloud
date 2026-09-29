import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { CalendarEvent, IntegratedTask, MeetingInviteNotification } from "../data/calendarMockData";

export interface WorkspaceMeetingMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface CreateWorkspaceMeetingInput {
  title: string;
  clientName?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  locationUrl?: string;
  description?: string;
  invitedUserIds: string[];
}

export interface MeetingActionTaskInput {
  title: string;
  notes?: string;
  assigneeUserId: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: "high" | "medium" | "low";
  estimatedMinutes?: number;
}

function clockAfter(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function getWorkspaceId(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (error || !data) throw new Error("MEETING_WORKSPACE_NOT_FOUND");
  return String(data.workspace_id);
}

export async function listWorkspaceMeetingMembers(client: SupabaseClient, userId: string): Promise<WorkspaceMeetingMember[]> {
  const workspaceId = await getWorkspaceId(client, userId);
  const { data, error } = await client.from("profiles")
    .select("user_id,email,preferred_name,display_name,job_title,avatar_path")
    .eq("workspace_id", workspaceId).order("display_name");
  if (error) throw new Error(`MEETING_MEMBERS_FAILED:${error.message}`);
  return (data || []).map((row) => ({
    id: String(row.user_id), email: String(row.email),
    name: row.preferred_name || row.display_name || row.email,
    role: row.job_title || "Membro AXION", avatar: row.avatar_path || undefined,
  }));
}

function mapEvent(row: any, currentUserId?: string): CalendarEvent {
  const attendees = Array.isArray(row.attendees) ? row.attendees : [];
  const start = String(row.start_time).slice(0, 5);
  const end = String(row.end_time).slice(0, 5);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return {
    id: String(row.id), title: row.title, clientName: row.category === "internal" ? "AXION Core" : row.category,
    date: row.event_date, startTime: start, endTime: end,
    durationMinutes: Math.max(1, (eh * 60 + em) - (sh * 60 + sm)), locationType: "discord_stage",
    locationUrl: row.location_url, status: row.status, category: "internal", description: row.description,
    attendees: attendees.map((member: any) => ({ name: member.name, email: member.email, role: member.role || "Membro AXION", avatar: member.avatar, status: "accepted" })),
    tasksCount: attendees.length, completedTasksCount: Number(row.completed_tasks || 0), hasDiscordAta: false,
    discordChannelTarget: "atas-executivas", gcalSynced: false, gcalEventId: "", updatedAt: row.updated_at,
    editable: currentUserId ? row.created_by === currentUserId : true,
    meetingMinutes: row.meeting_minutes || "", meetingNotes: row.meeting_notes || "",
  };
}

function mapTask(row: any, name: string): IntegratedTask {
  return {
    id: String(row.id), title: row.title, eventId: row.meeting_id || undefined,
    eventTitle: row.calendar_events?.title || undefined, clientName: row.calendar_events?.category || "AXION Core",
    priority: row.priority, dueDate: row.due_date || "", dueTime: row.due_time ? String(row.due_time).slice(0, 5) : undefined,
    completed: Boolean(row.completed), assignee: { name }, estimatedTime: `${row.estimated_minutes}m`,
    estimatedMinutes: row.estimated_minutes, notes: row.notes, syncedWithGCal: false, fromDiscordAta: false,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspaceMeetings(client: SupabaseClient, userId: string) {
  const workspaceId = await getWorkspaceId(client, userId);
  const members = await listWorkspaceMeetingMembers(client, userId);
  const current = members.find((member) => member.id === userId);
  const [{ data: rows, error }, { data: taskRows, error: taskError }] = await Promise.all([
    client.from("calendar_events").select("*").eq("workspace_id", workspaceId).order("event_date").order("start_time"),
    client.from("tasks").select("*,calendar_events(title,category)").eq("workspace_id", workspaceId).eq("assignee_user_id", userId).not("meeting_id", "is", null).order("due_date"),
  ]);
  if (error || taskError) throw new Error(`MEETING_LIST_FAILED:${(error || taskError)?.message}`);
  const visibleRows = (rows || []).filter((row: any) => row.created_by === userId || (Array.isArray(row.attendees) && row.attendees.some((item: any) => item.userId === userId)));
  const events = visibleRows.map((row: any) => mapEvent(row, userId));
  const tasks = (taskRows || []).map((row: any) => mapTask(row, current?.name || "Membro AXION"));
  const creators = new Map(members.map((member) => [member.id, member]));
  const invites: MeetingInviteNotification[] = visibleRows.filter((row: any) => row.created_by !== userId && row.status !== "cancelled").map((row: any) => {
    const creator = creators.get(row.created_by);
    return { id: `meeting-${row.id}`, eventId: row.id, meetingTitle: row.title, clientName: row.category || "AXION Core",
      date: row.event_date, time: `${String(row.start_time).slice(0, 5)}`, createdBy: { name: creator?.name || "Membro AXION", role: creator?.role || "AXION", avatar: creator?.avatar || "" },
      invitedUsers: (row.attendees || []).map((item: any) => item.name), locationUrl: row.location_url, timestamp: row.created_at, status: "pending" };
  });
  return { members, events, tasks, invites };
}

export async function createWorkspaceMeeting(client: SupabaseClient, userId: string, input: CreateWorkspaceMeetingInput) {
  const workspaceId = await getWorkspaceId(client, userId);
  const members = await listWorkspaceMeetingMembers(client, userId);
  const memberMap = new Map(members.map((member) => [member.id, member]));
  if (!memberMap.has(userId)) throw new Error("MEETING_CREATOR_NOT_MEMBER");
  const participantIds = [...new Set([userId, ...input.invitedUserIds])];
  if (participantIds.some((id) => !memberMap.has(id))) throw new Error("MEETING_INVITEE_NOT_MEMBER");
  const attendees = participantIds.map((id) => ({ userId: id, ...memberMap.get(id)! }));
  const endTime = clockAfter(input.startTime, input.durationMinutes);
  const { data: event, error } = await client.from("calendar_events").insert({
    workspace_id: workspaceId, title: input.title, description: input.description || "",
    event_date: input.date, start_time: input.startTime, end_time: endTime,
    location_type: "discord_stage", location_url: input.locationUrl || "Discord", status: "scheduled",
    category: input.clientName || "internal", attendees, created_by: userId,
  }).select("*").single();
  if (error || !event) throw new Error(`MEETING_CREATE_FAILED:${error?.message}`);
  const taskInputs = participantIds.map((assigneeId) => ({
    workspace_id: workspaceId, assignee_user_id: assigneeId, meeting_id: event.id,
    title: `Reunião: ${input.title}`, notes: input.description || `Participar na reunião ${input.title}`,
    due_date: input.date, due_time: input.startTime, estimated_minutes: input.durationMinutes,
    priority: "medium", completed: false, created_by: userId, meeting_task_kind: "attendance",
  }));
  const { data: tasks, error: taskError } = await client.from("tasks").insert(taskInputs).select("*,calendar_events(title,category)");
  if (taskError) {
    await client.from("calendar_events").delete().eq("id", event.id);
    throw new Error(`MEETING_TASKS_FAILED:${taskError.message}`);
  }
  return { event: mapEvent(event, userId), tasks: (tasks || []).map((row: any) => mapTask(row, memberMap.get(row.assignee_user_id)?.name || "Membro AXION")), participantCount: participantIds.length };
}

export async function updateWorkspaceMeeting(client: SupabaseClient, userId: string, meetingId: string, input: CreateWorkspaceMeetingInput) {
  const workspaceId = await getWorkspaceId(client, userId);
  const members = await listWorkspaceMeetingMembers(client, userId);
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const { data: existing, error: existingError } = await client.from("calendar_events").select("id,created_by").eq("id", meetingId).eq("workspace_id", workspaceId).single();
  if (existingError || !existing) throw new Error("MEETING_NOT_FOUND");
  if (existing.created_by !== userId) throw new Error("MEETING_EDIT_FORBIDDEN");
  const participantIds = [...new Set([userId, ...input.invitedUserIds])];
  if (participantIds.some((id) => !memberMap.has(id))) throw new Error("MEETING_INVITEE_NOT_MEMBER");
  const attendees = participantIds.map((id) => ({ userId: id, ...memberMap.get(id)! }));
  const { data: event, error } = await client.from("calendar_events").update({
    title: input.title, description: input.description || "", event_date: input.date,
    start_time: input.startTime, end_time: clockAfter(input.startTime, input.durationMinutes),
    location_url: input.locationUrl || "Discord", category: input.clientName || "internal", attendees,
    updated_at: new Date().toISOString(),
  }).eq("id", meetingId).eq("created_by", userId).select("*").single();
  if (error || !event) throw new Error(`MEETING_UPDATE_FAILED:${error?.message}`);
  const { data: existingTasks, error: tasksReadError } = await client.from("tasks").select("id,assignee_user_id").eq("meeting_id", meetingId).eq("meeting_task_kind", "attendance");
  if (tasksReadError) throw new Error(`MEETING_TASKS_FAILED:${tasksReadError.message}`);
  const removedTaskIds = (existingTasks || []).filter((task: any) => !participantIds.includes(task.assignee_user_id)).map((task: any) => task.id);
  if (removedTaskIds.length) {
    const { error: deleteError } = await client.from("tasks").delete().in("id", removedTaskIds);
    if (deleteError) throw new Error(`MEETING_TASKS_FAILED:${deleteError.message}`);
  }
  const existingTaskIds = new Map((existingTasks || []).map((task: any) => [task.assignee_user_id, task.id]));
  const taskInputs = participantIds.map((assigneeId) => ({ id: existingTaskIds.get(assigneeId) || randomUUID(), workspace_id: workspaceId, assignee_user_id: assigneeId, meeting_id: meetingId,
    title: `Reunião: ${input.title}`, notes: input.description || `Participar na reunião ${input.title}`,
    due_date: input.date, due_time: input.startTime, estimated_minutes: input.durationMinutes,
    priority: "medium", created_by: userId, meeting_task_kind: "attendance", updated_at: new Date().toISOString() }));
  const { data: tasks, error: taskError } = await client.from("tasks").upsert(taskInputs, { onConflict: "id" }).select("*,calendar_events(title,category)");
  if (taskError) throw new Error(`MEETING_TASKS_FAILED:${taskError.message}`);
  return { event: mapEvent(event, userId), tasks: (tasks || []).map((row: any) => mapTask(row, memberMap.get(row.assignee_user_id)?.name || "Membro AXION")), participantCount: participantIds.length };
}

export async function updateWorkspaceMeetingTask(client: SupabaseClient, userId: string, taskId: string, completed: boolean) {
  const { data, error } = await client.from("tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", taskId).eq("assignee_user_id", userId).not("meeting_id", "is", null).select("*,calendar_events(title,category)").single();
  if (error || !data) throw new Error("MEETING_TASK_UPDATE_FAILED");
  const members = await listWorkspaceMeetingMembers(client, userId);
  return mapTask(data, members.find((member) => member.id === userId)?.name || "Membro AXION");
}

async function getAccessibleMeeting(client: SupabaseClient, userId: string, meetingId: string) {
  const workspaceId = await getWorkspaceId(client, userId);
  const { data, error } = await client.from("calendar_events").select("*").eq("id", meetingId).eq("workspace_id", workspaceId).single();
  if (error || !data) throw new Error("MEETING_NOT_FOUND");
  const attendees = Array.isArray(data.attendees) ? data.attendees : [];
  if (data.created_by !== userId && !attendees.some((attendee: any) => attendee.userId === userId)) throw new Error("MEETING_ACCESS_FORBIDDEN");
  return { workspaceId, event: data };
}

async function mapMeetingFile(client: SupabaseClient, row: any) {
  const { data } = await client.storage.from(row.container).createSignedUrl(row.object_id, 3600);
  return { id: String(row.id), name: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes || 0), createdAt: row.created_at, url: data?.signedUrl || "" };
}

export async function getWorkspaceMeetingRecord(client: SupabaseClient, userId: string, meetingId: string) {
  const { workspaceId, event } = await getAccessibleMeeting(client, userId, meetingId);
  const members = await listWorkspaceMeetingMembers(client, userId);
  const names = new Map(members.map((member) => [member.id, member.name]));
  const [{ data: taskRows, error: taskError }, { data: fileRows, error: fileError }] = await Promise.all([
    client.from("tasks").select("*").eq("workspace_id", workspaceId).eq("meeting_id", meetingId).eq("meeting_task_kind", "action").order("created_at"),
    client.from("file_assets").select("*").eq("workspace_id", workspaceId).eq("entity_type", "meeting").eq("entity_id", meetingId).order("created_at", { ascending: false }),
  ]);
  if (taskError || fileError) throw new Error(`MEETING_RECORD_READ_FAILED:${(taskError || fileError)?.message}`);
  return {
    event: mapEvent(event, userId), members,
    minutes: event.meeting_minutes || "", notes: event.meeting_notes || "",
    tasks: (taskRows || []).map((row: any) => mapTask(row, names.get(row.assignee_user_id) || "Membro AXION")),
    files: await Promise.all((fileRows || []).map((row: any) => mapMeetingFile(client, row))),
  };
}

export async function updateWorkspaceMeetingRecord(client: SupabaseClient, userId: string, meetingId: string, input: { minutes: string; notes: string }) {
  await getAccessibleMeeting(client, userId, meetingId);
  const { data, error } = await client.from("calendar_events").update({ meeting_minutes: input.minutes, meeting_notes: input.notes, updated_at: new Date().toISOString() }).eq("id", meetingId).select("*").single();
  if (error || !data) throw new Error(`MEETING_RECORD_UPDATE_FAILED:${error?.message}`);
  return mapEvent(data, userId);
}

export async function completeWorkspaceMeeting(client: SupabaseClient, userId: string, meetingId: string) {
  await getAccessibleMeeting(client, userId, meetingId);
  const now = new Date().toISOString();
  const { data, error } = await client.from("calendar_events").update({ status: "completed", updated_at: now }).eq("id", meetingId).select("*").single();
  if (error || !data) throw new Error(`MEETING_COMPLETE_FAILED:${error?.message}`);
  await client.from("tasks").update({ completed: true, completed_at: now, updated_at: now }).eq("meeting_id", meetingId).eq("meeting_task_kind", "attendance");
  return mapEvent(data, userId);
}

export async function createWorkspaceMeetingActionTask(client: SupabaseClient, userId: string, meetingId: string, input: MeetingActionTaskInput) {
  const { workspaceId } = await getAccessibleMeeting(client, userId, meetingId);
  const members = await listWorkspaceMeetingMembers(client, userId);
  const assignee = members.find((member) => member.id === input.assigneeUserId);
  if (!assignee) throw new Error("MEETING_TASK_ASSIGNEE_INVALID");
  const { data, error } = await client.from("tasks").insert({
    workspace_id: workspaceId, meeting_id: meetingId, meeting_task_kind: "action", assignee_user_id: assignee.id,
    title: input.title.trim(), notes: input.notes?.trim() || "", due_date: input.dueDate || null, due_time: input.dueTime || null,
    priority: input.priority || "medium", estimated_minutes: input.estimatedMinutes || 30, completed: false, created_by: userId,
  }).select("*,calendar_events(title,category)").single();
  if (error || !data) throw new Error(`MEETING_ACTION_TASK_FAILED:${error?.message}`);
  return mapTask(data, assignee.name);
}

export async function uploadWorkspaceMeetingFile(client: SupabaseClient, userId: string, meetingId: string, file: { name: string; type: string; bytes: Buffer }) {
  const { workspaceId } = await getAccessibleMeeting(client, userId, meetingId);
  const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160) || "anexo";
  const objectId = `${workspaceId}/meetings/${meetingId}/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from("attachments").upload(objectId, file.bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) throw new Error(`MEETING_FILE_UPLOAD_FAILED:${uploadError.message}`);
  const { data, error } = await client.from("file_assets").insert({ workspace_id: workspaceId, owner_user_id: userId, provider: "supabase", container: "attachments", object_id: objectId, file_name: safeName, mime_type: file.type || "application/octet-stream", size_bytes: file.bytes.length, entity_type: "meeting", entity_id: meetingId }).select("*").single();
  if (error || !data) {
    await client.storage.from("attachments").remove([objectId]);
    throw new Error(`MEETING_FILE_RECORD_FAILED:${error?.message}`);
  }
  return mapMeetingFile(client, data);
}
