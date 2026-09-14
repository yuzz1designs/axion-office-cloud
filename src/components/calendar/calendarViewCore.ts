export interface CalendarGridTask {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  completed: boolean;
}

export function groupTasksByDate(tasks: CalendarGridTask[]): Map<string, CalendarGridTask[]> {
  const grouped = new Map<string, CalendarGridTask[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    grouped.set(task.dueDate, [...(grouped.get(task.dueDate) || []), task]);
  }
  return grouped;
}

export function replaceTaskCompletion<T extends CalendarGridTask>(
  tasks: T[],
  taskId: string,
  completed: boolean,
): T[] {
  return tasks.map((task) => task.id === taskId ? { ...task, completed } : task);
}
