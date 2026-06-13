export type RuntimeStatus = {
  cwd: string;
  modelName?: string;
  git: {
    available: boolean;
    branch?: string;
    newFiles?: number;
    modifiedFiles?: number;
    deletedFiles?: number;
  };
};
