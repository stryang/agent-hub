export type CommandSource = "builtin" | "command" | "skill";

export type AgentCommand = {
  name: string;
  description: string;
  argumentHint?: string;
  source: CommandSource;
};
