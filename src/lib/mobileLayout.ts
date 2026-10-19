import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const PHONE_QUERY = "(pointer: coarse) and (max-device-width: 767px)";

function readMobileLayout() {
  return window.matchMedia(MOBILE_QUERY).matches || window.matchMedia(PHONE_QUERY).matches;
}

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(MOBILE_QUERY), window.matchMedia(PHONE_QUERY)];
  queries.forEach((query) => query.addEventListener("change", onChange));
  window.addEventListener("pageshow", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    queries.forEach((query) => query.removeEventListener("change", onChange));
    window.removeEventListener("pageshow", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function useMobileLayout() {
  return useSyncExternalStore(subscribe, readMobileLayout, () => false);
}
