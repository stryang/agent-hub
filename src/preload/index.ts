import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("agentHub", {
  version: "0.1.0",
});
