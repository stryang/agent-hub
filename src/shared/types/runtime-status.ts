export type RuntimeStatus = {
  cwd: string;
  modelName?: string;
  git: {
    available: boolean;
    branch?: string;
    addedFiles?: number;
    deletedFiles?: number;
  };
};
