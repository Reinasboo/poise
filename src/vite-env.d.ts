/// <reference types="vite/client" />

interface Window {
  poiseStorage?: {
    readSessionDatabase(): Promise<Uint8Array | null>;
    writeSessionDatabase(data: Uint8Array): Promise<void>;
    deleteSessionDatabase(): Promise<void>;
  };
}
