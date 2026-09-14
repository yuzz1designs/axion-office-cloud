export type AxionRuntime = "web" | "desktop";

export function detectAxionRuntime(location: Pick<Location, "search"> = window.location): AxionRuntime {
  return new URLSearchParams(location.search).get("axion-desktop") === "1" ? "desktop" : "web";
}

export function isDesktopRuntime(location?: Pick<Location, "search">) {
  return detectAxionRuntime(location) === "desktop";
}
