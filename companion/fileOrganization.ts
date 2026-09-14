import * as fs from "node:fs/promises";
import path from "node:path";

const categories: Record<string, string> = { pdf: "Documentos", doc: "Documentos", docx: "Documentos", txt: "Documentos", md: "Documentos", xls: "Folhas de cálculo", xlsx: "Folhas de cálculo", csv: "Folhas de cálculo", png: "Imagens", jpg: "Imagens", jpeg: "Imagens", webp: "Imagens", heic: "Imagens", svg: "Imagens", mp4: "Vídeos", mov: "Vídeos", mkv: "Vídeos", mp3: "Áudio", wav: "Áudio", m4a: "Áudio", zip: "Arquivos", rar: "Arquivos", gz: "Arquivos", dmg: "Instaladores" };
export async function organizeDirectory(directory: string, strategy: "type" | "month", preview: boolean) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && !entry.name.startsWith("."));
  if (files.length > 500) throw new Error("Esta pasta tem mais de 500 ficheiros. Escolhe uma pasta mais específica.");
  const plan: Array<{ source: string; destination: string; status: string }> = [];
  for (const file of files) {
    const source = path.join(directory, file.name);
    const group = strategy === "month" ? (await fs.stat(source)).mtime.toISOString().slice(0, 7) : categories[path.extname(file.name).slice(1).toLowerCase()] || "Outros";
    const destination = path.join(directory, group, file.name);
    const folder = await fs.lstat(path.dirname(destination)).catch(() => null);
    if (folder?.isSymbolicLink() || (folder && !folder.isDirectory())) { plan.push({ source, destination, status: "ignored_unsafe_folder" }); continue; }
    const exists = await fs.lstat(destination).then(() => true, () => false);
    if (exists) { plan.push({ source, destination, status: "ignored_existing" }); continue; }
    if (preview) { plan.push({ source, destination, status: "planned" }); continue; }
    try {
      if (!(await fs.lstat(source)).isFile()) throw new Error("O ficheiro foi alterado.");
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const resolved = await fs.realpath(path.dirname(destination));
      if (resolved !== path.join(await fs.realpath(directory), group)) throw new Error("Pasta de destino não autorizada.");
      // Same filesystem: hard-link reserves destination atomically without overwrite.
      await fs.link(source, destination);
      await fs.unlink(source);
      plan.push({ source, destination, status: "moved" });
    } catch { plan.push({ source, destination, status: "failed" }); }
  }
  return { preview, plan, moved: plan.filter(item => item.status === "moved").length };
}
