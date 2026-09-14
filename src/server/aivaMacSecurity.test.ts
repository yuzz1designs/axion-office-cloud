import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { permittedPath, executeMacCapability } from "../../companion/macCapabilities";

test("file permissions reject traversal, symlinks outside roots and unauthorized creation", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "aiva-path-test-"));
  const root = path.join(base, "allowed"); const outside = path.join(base, "private");
  await mkdir(root); await mkdir(outside); await symlink(outside, path.join(root, "link"));
  try {
    await assert.rejects(permittedPath(path.join(root, "../private"), [root]));
    await assert.rejects(permittedPath(path.join(root, "link/file.txt"), [root], true));
    await assert.rejects(permittedPath(path.join(outside, "new.txt"), [root], true));
    const permitted = await permittedPath(path.join(root, "new.txt"), [root], true);
    assert.equal(path.basename(permitted), "new.txt");
    await assert.rejects(executeMacCapability("run_shell", { text: "whoami" }, [root]));
    const shell = await executeMacCapability("run_shell_command", { command: "pwd", cwd: root }, [root]);
    assert.equal(shell.stdout.trim(), await realpath(root));
    await assert.rejects(executeMacCapability("run_shell_command", { command: "sudo whoami", cwd: root }, [root]));
    await assert.rejects(executeMacCapability("set_system_volume", { percent: "20; anything" }, [root]));
  } finally { await rm(base, { recursive: true, force: true }); }
});
