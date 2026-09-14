export function normalizeWakeTranscript(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt").replace(/[^a-z0-9]+/g, " ").trim();
}

export function containsAivaWakeWord(value: string) {
  return /(?:^|\s)ola\s+aiva(?:\s|$)/.test(normalizeWakeTranscript(value));
}

export function isHandsFreeStopPhrase(value: string) {
  return /^(?:aiva\s+)?e\s+tudo(?:\s+aiva)?$/.test(normalizeWakeTranscript(value));
}
