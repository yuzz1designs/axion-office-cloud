/** Coalesce realtime bursts and never overlap refresh batches. */
export function createRefreshQueue(run: () => Promise<void>, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false, dirty = false, stopped = false;
  const flush = async () => {
    clearTimeout(timer); timer = undefined;
    if (stopped) return;
    if (running) { dirty = true; return; }
    running = true; dirty = false;
    try { await run(); } catch { /* Existing data stays visible until the next refresh. */ }
    finally { running = false; if (dirty && !stopped) schedule(); }
  };
  const schedule = () => {
    if (stopped) return;
    if (running) { dirty = true; return; }
    if (!timer) timer = setTimeout(() => { void flush(); }, delay);
  };
  return { schedule, flush, stop: () => { stopped = true; dirty = false; clearTimeout(timer); } };
}
