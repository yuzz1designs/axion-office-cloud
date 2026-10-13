export type PushDeviceState = "unsupported" | "blocked" | "active" | "incomplete" | "inactive";

export function getPushDeviceState(input: { supported: boolean; permission: NotificationPermission; browserSubscribed: boolean; serverSubscribed: boolean }): PushDeviceState {
  if (!input.supported) return "unsupported";
  if (input.permission === "denied") return "blocked";
  if (input.permission === "granted" && input.browserSubscribed && input.serverSubscribed) return "active";
  if (input.browserSubscribed || input.serverSubscribed) return "incomplete";
  return "inactive";
}

export function requiresAppleHomeScreen(appleMobile: boolean, standalone: boolean) {
  return appleMobile && !standalone;
}
