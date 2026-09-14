import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppRegistry } from "../../companion/appRegistry";

test("descobre aplicações instaladas e persiste autorização por bundle ID", { skip: process.platform !== "darwin" }, async () => {
  const base = await mkdtemp(path.join(tmpdir(), "axion-app-registry-"));
  const applications = path.join(base, "Applications");
  const app = path.join(applications, "Example.app", "Contents");
  await mkdir(app, { recursive: true });
  await writeFile(path.join(app, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict><key>CFBundleIdentifier</key><string>pt.axion.example</string><key>CFBundleName</key><string>Example</string></dict></plist>`);
  try {
    const registry = new AppRegistry(base, [applications]);
    assert.equal((await registry.list())[0]?.authorized, false);
    await registry.authorize("pt.axion.example", true);
    assert.equal((await new AppRegistry(base, [applications]).list())[0]?.authorized, true);
    await registry.authorize("pt.axion.example", false);
    assert.equal((await registry.list())[0]?.authorized, false);
  } finally { await rm(base, { recursive: true, force: true }); }
});
