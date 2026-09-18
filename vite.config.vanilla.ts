import { defineConfig } from "vite";
import path from "path";

// Build/dev config for the framework-free rebuild (vanilla.html + src/vanilla).
// The live site still uses vite.config.ts until the rebuild reaches parity.
const OWNER_SUPABASE = {
  VITE_SUPABASE_URL: "https://rdmrxeplasttewtlfetc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA",
  VITE_SUPABASE_PROJECT_ID: "rdmrxeplasttewtlfetc",
};

export default defineConfig({
  define: Object.fromEntries(
    Object.entries(OWNER_SUPABASE).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  ),
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 8081,
    host: "::",
  },
  plugins: [
    {
      name: "vanilla-history-fallback",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url || "/";
          const isAsset = url.includes(".") || url.startsWith("/@") || url.startsWith("/node_modules");
          if (!isAsset) req.url = "/vanilla.html";
          next();
        });
      },
    },
  ],
  build: {
    outDir: "dist-vanilla",
    rollupOptions: { input: path.resolve(__dirname, "vanilla.html") },
  },
});
