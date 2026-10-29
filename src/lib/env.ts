// Vite inlines import.meta.env in the browser; on the server (api/mcp.ts) it is undefined, so read process.env.
export const env: Record<string, string | undefined> =
  import.meta.env ?? (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
