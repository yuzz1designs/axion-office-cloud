import { mapDriveFile, type DriveDocument, type DriveFile } from "./driveDocument";

interface DriveUploadInput {
  accessToken: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  file: Buffer;
  fetchImpl?: typeof fetch;
}

interface DriveDeleteInput {
  accessToken: string;
  documentId: string;
  fetchImpl?: typeof fetch;
}

export async function uploadDriveDocument({ accessToken, folderId, fileName, mimeType, file, fetchImpl = fetch }: DriveUploadInput): Promise<DriveDocument> {
  const boundary = `axion-office-${Date.now().toString(16)}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify({ name: fileName, parents: [folderId] })),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    file,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,name,mimeType,size,modifiedTime,createdTime,webViewLink,description,owners(displayName)",
  });
  const response = await fetchImpl(`https://www.googleapis.com/upload/drive/v3/files?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await response.json() as DriveFile & { error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error("GOOGLE_DRIVE_UPLOAD_FAILED");
  return mapDriveFile(result);
}

export async function deleteDriveDocument({ accessToken, documentId, fetchImpl = fetch }: DriveDeleteInput) {
  const response = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_DELETE_FAILED");
}
