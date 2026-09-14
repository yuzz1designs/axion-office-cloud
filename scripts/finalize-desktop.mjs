import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";

const candidates = ["desktop-release/mac-universal", "desktop-release/mac-arm64", "desktop-release/mac"];
let finalized = 0;
for (const directory of candidates) {
  const app = `${directory}/AXION OFFICE.app`;
  const helper = `${app}/Contents/Resources/AXIONControl.app`;
  try { await access(helper); } catch { continue; }
  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", "--identifier", "com.axion.office.control", helper], { stdio: "inherit" });
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", helper], { stdio: "inherit" });
  finalized += 1;
}
if (!finalized) throw new Error("Não foi encontrado um pacote AXION OFFICE para finalizar.");
console.log(`Helper nativo finalizado em ${finalized} pacote(s).`);
