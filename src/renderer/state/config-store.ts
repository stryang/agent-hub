import { create } from "zustand";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../../shared/types/claude-config";
import { getAgentHubApi } from "./agent-hub-api";

type ConfigStore = {
  config: ClaudeConfig | null;
  validation: ClaudeValidationResult | null;
  loading: boolean;
  loadConfig: () => Promise<void>;
  validate: (commandPath: string) => Promise<ClaudeValidationResult>;
  save: (config: ClaudeConfig) => Promise<ClaudeConfig>;
};

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  validation: null,
  loading: false,

  async loadConfig() {
    set({ loading: true });
    try {
      const config = await getAgentHubApi().getConfig();
      set({ config });
    } finally {
      set({ loading: false });
    }
  },

  async validate(commandPath) {
    const validation = await getAgentHubApi().validateClaude(commandPath);
    set({ validation });
    return validation;
  },

  async save(config) {
    const savedConfig = await getAgentHubApi().saveConfig(config);
    set({ config: savedConfig });
    return savedConfig;
  },
}));
