import type { MacTool } from "./aivaCapabilities";
export type AivaComputerCapability = MacTool;

export interface AivaComputerCommand {
  capability: AivaComputerCapability;
  target: string;
}

export interface AivaComputerBridge {
  available: boolean;
  execute(command: AivaComputerCommand): Promise<{ ok: true }>;
}

export function createUnavailableComputerBridge(): AivaComputerBridge {
  return {
    available: false,
    async execute() {
      throw new Error("AIVA_DESKTOP_COMPANION_REQUIRED");
    },
  };
}
