import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("Companion rejects browser origins, unauthenticated calls, wrong users and arbitrary control; revocation removes access", { skip: process.platform !== "darwin", timeout: 20000 }, async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "companion/server.ts", "--no-files"], { cwd: process.cwd(), env: { ...process.env, AXION_COMPANION_PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const output = await new Promise<string>((resolve, reject) => {
      let value = "";
      child.stdout.on("data", chunk => { value += chunk.toString(); if (value.includes("Pastas autorizadas:")) resolve(value); });
      child.once("error", reject); child.once("exit", () => reject(new Error("Companion terminou antes de arrancar.")));
    });
    const port = output.match(/Porta: (\d+)/)![1];
    const code = output.match(/única?\)?[^\n]*: ([a-f0-9]{32})/)?.[1] || output.match(/uso único\): ([a-f0-9]{32})/)![1];
    const url = `http://127.0.0.1:${port}`;
    const userId = "00000000-0000-0000-0000-000000000001";
    assert.equal((await fetch(`${url}/status`)).status, 401);
    assert.equal((await fetch(`${url}/pair`, { method: "POST", headers: { Origin: "https://example.com" }, body: JSON.stringify({ code, userId }) })).status, 403);
    const pair = await fetch(`${url}/pair`, { method: "POST", body: JSON.stringify({ code, userId }) });
    assert.equal(pair.status, 200);
    const data = await pair.json();
    const headers = { Authorization: `Bearer ${data.token}`, "X-Axion-User": userId, "Content-Type": "application/json" };
    assert.equal((await fetch(`${url}/status`, { headers: { ...headers, "X-Axion-User": "wrong-user" } })).status, 401);
    const status = await (await fetch(`${url}/status`, { headers })).json();
    assert.equal(status.connected, true); assert.equal(status.shell, true); assert.equal(status.arbitraryAppControl, status.capabilities.includes("computer_click"));
    assert.equal(status.capabilities.includes("read_file"), false);
    assert.equal(status.capabilities.includes("open_finder"), true);
    assert.equal((await fetch(`${url}/execute`, { method: "POST", headers, body: JSON.stringify({ name: "run_shell", arguments: { text: "whoami" } }) })).status, 403);
    assert.equal((await fetch(`${url}/revoke`, { method: "POST", headers, body: "{}" })).status, 200);
    assert.equal((await fetch(`${url}/status`, { headers })).status, 401);
  } finally { child.kill("SIGTERM"); await once(child, "exit"); }
});
