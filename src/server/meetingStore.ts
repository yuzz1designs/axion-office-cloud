import type { SupabaseClient } from "@supabase/supabase-js";
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
  const invites: MeetingInviteNotification[] = visibleRows.filter((row: any) => row.created_by !== userId && row.status === "scheduled").map((row: any) => {
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
    priority: "medium", completed: false, created_by: userId,
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
  const { data: existingTasks, error: tasksReadError } = await client.from("tasks").select("id,assignee_user_id").eq("meeting_id", meetingId);
  if (tasksReadError) throw new Error(`MEETING_TASKS_FAILED:${tasksReadError.message}`);
  const removedTaskIds = (existingTasks || []).filter((task: any) => !participantIds.includes(task.assignee_user_id)).map((task: any) => task.id);
  if (removedTaskIds.length) {
    const { error: deleteError } = await client.from("tasks").delete().in("id", removedTaskIds);
    if (deleteError) throw new Error(`MEETING_TASKS_FAILED:${deleteError.message}`);
  }
  const taskInputs = participantIds.map((assigneeId) => ({ workspace_id: workspaceId, assignee_user_id: assigneeId, meeting_id: meetingId,
    title: `Reunião: ${input.title}`, notes: input.description || `Participar na reunião ${input.title}`,
    due_date: input.date, due_time: input.startTime, estimated_minutes: input.durationMinutes,
    priority: "medium", created_by: userId, updated_at: new Date().toISOString() }));
  const { data: tasks, error: taskError } = await client.from("tasks").upsert(taskInputs, { onConflict: "meeting_id,assignee_user_id" }).select("*,calendar_events(title,category)");
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
