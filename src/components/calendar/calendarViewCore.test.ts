import assert from "node:assert/strict";
import test from "node:test";
import { groupTasksByDate, replaceTaskCompletion } from "./calendarViewCore";

test("inclui tarefas sincronizadas na data correspondente da grelha mensal", () => {
  const grouped = groupTasksByDate([
    { id: "task-1", title: "Preparar proposta", dueDate: "2026-09-03", completed: false },
  ]);

  assert.equal(grouped.get("2026-09-03")?.[0]?.title, "Preparar proposta");
});

test("aplica e reverte imediatamente o estado concluído de uma tarefa", () => {
  const tasks = [{ id: "task-1", title: "Preparar proposta", dueDate: "2026-09-03", completed: false }];
  const completed = replaceTaskCompletion(tasks, "task-1", true);
  assert.equal(completed[0].completed, true);
  assert.equal(replaceTaskCompletion(completed, "task-1", false)[0].completed, false);
});
