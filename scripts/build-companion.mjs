import { mkdir, stat, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
if (process.platform !== "darwin") throw new Error("Requer macOS.");
const app = "companion/bin/AXIONControl.app";
const executable = `${app}/Contents/MacOS/AXIONControl`;
if (process.argv.includes("--if-needed")) {
  const binary = await stat(executable).catch(() => null);
  const sources = await Promise.all(["companion/AXIONControl.m", "companion/Info.plist", "scripts/build-companion.mjs"].map(file => stat(file)));
  if (binary && sources.every(source => binary.mtimeMs >= source.mtimeMs)) process.exit(0);
}
await mkdir(`${app}/Contents/MacOS`, { recursive: true });
await copyFile("companion/Info.plist", `${app}/Contents/Info.plist`);
execFileSync("/usr/bin/clang", ["-arch", "arm64", "-arch", "x86_64", "-mmacosx-version-min=12.0", "-fobjc-arc", "-fblocks", "companion/AXIONControl.m", "-o", executable, "-framework", "AppKit", "-framework", "ApplicationServices", "-framework", "ScreenCaptureKit"], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", "--identifier", "com.axion.office.control", app], { stdio: "inherit" });
console.log("AXIONControl universal (Apple Silicon + Intel) compilado. Ativa as permissões em AIVA → macOS quando associares o Companion.");
