import type { CalendarEvent, IntegratedTask } from "../../data/calendarMockData";

export function selectTodayTasks(tasks: IntegratedTask[], date: string): IntegratedTask[] {
  return tasks
    .filter((task) => task.dueDate === date)
    .sort((left, right) => (left.dueTime || "23:59").localeCompare(right.dueTime || "23:59"));
}

export function selectNextMeeting(events: CalendarEvent[], date: string, time: string): CalendarEvent | null {
  const now = `${date}T${time}`;
  return events
    .filter((event) => event.status === "scheduled" && `${event.date}T${event.startTime}` >= now)
    .sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`))[0] || null;
}
