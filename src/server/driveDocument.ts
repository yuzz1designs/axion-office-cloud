export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  description?: string;
  owners?: Array<{ displayName?: string }>;
}

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  size: number | null;
  sizeLabel: string;
  modifiedTime: string;
  createdTime: string;
  webViewLink: string;
  description: string;
  owner: string;
  isFolder: boolean;
}

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const MAX_DRIVE_UPLOAD_BYTES = 50 * 1024 * 1024;

export function validateDriveUpload({ fileName, byteLength }: { fileName: string; byteLength: number }) {
  if (!fileName.trim()) throw new Error("O nome do ficheiro é obrigatório.");
  if (byteLength <= 0) throw new Error("O ficheiro está vazio.");
  if (byteLength > MAX_DRIVE_UPLOAD_BYTES) throw new Error("O ficheiro excede o limite de 50 MB.");
}

export function decodeUploadFileName(value: string | undefined): string {
  if (!value) throw new Error("O nome do ficheiro é obrigatório.");
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded) throw new Error("EMPTY_FILE_NAME");
    return decoded;
  } catch {
    throw new Error("O nome do ficheiro é inválido.");
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

export function mapDriveFile(file: DriveFile): DriveDocument {
  const isFolder = file.mimeType === FOLDER_MIME_TYPE;
  const numericSize = file.size === undefined ? null : Number(file.size);
  const extension = isFolder
    ? "PASTA"
    : file.name.includes(".")
      ? file.name.split(".").pop()!.toUpperCase()
      : file.mimeType.startsWith("application/vnd.google-apps.")
        ? file.mimeType.replace("application/vnd.google-apps.", "").toUpperCase()
        : "FICHEIRO";

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    extension,
    size: numericSize,
    sizeLabel: numericSize === null ? "—" : formatFileSize(numericSize),
    modifiedTime: file.modifiedTime || "",
    createdTime: file.createdTime || "",
    webViewLink: file.webViewLink || "",
    description: file.description || "",
    owner: file.owners?.[0]?.displayName || "Google Drive",
    isFolder,
  };
}
