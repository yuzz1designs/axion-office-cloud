export interface DriveOAuthStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  connectedAt?: string;
  missingScopes: string[];
}

export type DriveUploadAction = "configure" | "connect" | "upload";

export function getDriveUploadAction(status: DriveOAuthStatus): DriveUploadAction {
  if (!status.configured) return "configure";
  if (!status.connected || status.missingScopes.length > 0) return "connect";
  return "upload";
}
