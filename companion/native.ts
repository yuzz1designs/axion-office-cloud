import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
const execute = promisify(execFile);
export const nativeBinary = process.env.AXION_NATIVE_BINARY || fileURLToPath(new URL("./bin/AXIONControl.app/Contents/MacOS/AXIONControl", import.meta.url));
export async function nativeStatus(): Promise<{ accessibility: boolean; screenRecording: boolean }> {
  try { await access(nativeBinary); return await nativeCommand("permissions", {}); }
  catch { return { accessibility: false, screenRecording: false }; }
}
export async function nativeCommand(command: string, args: Record<string, unknown>): Promise<any> {
  const result = await execute(nativeBinary, [command, JSON.stringify(args)], { timeout: 10000, maxBuffer: 6000000, shell: false });
  const data = JSON.parse(result.stdout);
  if (data.error) throw new Error(data.error);
  return data;
}
