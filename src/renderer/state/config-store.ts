import { create } from "zustand";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../../shared/types/claude-config";
import type {
  CodexConfig,
  CodexValidationResult,
} from "../../shared/types/codex-config";
import { getAgentHubApi } from "./agent-hub-api";

type ConfigStore = {
  config: ClaudeConfig | null;
  validation: ClaudeValidationResult | null;
  codexConfig: CodexConfig | null;
  codexValidation: CodexValidationResult | null;
  loading: boolean;
  loadConfig: () => Promise<void>;
  validate: (commandPath: string) => Promise<ClaudeValidationResult>;
  save: (config: ClaudeConfig) => Promise<ClaudeConfig>;
  loadCodexConfig: () => Promise<void>;
  validateCodex: (commandPath: string) => Promise<CodexValidationResult>;
  saveCodex: (config: CodexConfig) => Promise<CodexConfig>;
};

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  validation: null,
  codexConfig: null,
  codexValidation: null,
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

  async loadCodexConfig() {
    const codexConfig = await getAgentHubApi().getCodexConfig();
    set({ codexConfig });
  },

  async validateCodex(commandPath) {
    const codexValidation = await getAgentHubApi().validateCodex(commandPath);
    set({ codexValidation });
    return codexValidation;
  },

  async saveCodex(config) {
    const savedConfig = await getAgentHubApi().saveCodexConfig(config);
    set({ codexConfig: savedConfig });
    return savedConfig;
  },
}));
