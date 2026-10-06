import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// Some build environments pass env values with surrounding quotes still attached
// (e.g. VITE_SUPABASE_URL='"https://..."'). Vite only strips quotes when reading
// .env files, not when the value comes from process.env, which produced an
// invalid "apikey" on requests. Normalize the values before they are inlined.
const stripQuotes = (value?: string) =>
  (value ?? "").trim().replace(/^['"]+/, "").replace(/['"]+$/, "");

// Owner-managed Supabase backend override: the app runs on the owner's own
// Supabase project (rdmrxeplasttewtlfetc) instead of the old hosted backend.
const OWNER_SUPABASE: Record<string, string> = {
  VITE_SUPABASE_URL: "https://rdmrxeplasttewtlfetc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA",
  VITE_SUPABASE_PROJECT_ID: "rdmrxeplasttewtlfetc",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sanitizedEnv = Object.fromEntries(
    ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID"]
      .map((key) => [
        `import.meta.env.${key}`,
        JSON.stringify(OWNER_SUPABASE[key] || stripQuotes(env[key] ?? process.env[key])),
      ])
      .filter(([, value]) => value !== '""'),
  );

  return {
  define: sanitizedEnv,

  server: {
    host: "::",
    port: 8080,
    fs: {
      // Never serve env files, keys or certs over the dev/preview server
      deny: [".env", ".env.*", "*.pem", "*.crt", "*.key"],
    },
  },
  build: {
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - rarely change, cache well
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    // PWA rebuild: the old Workbox worker precached index.html + hashed chunks, so every
    // deploy left installed copies pointing at files that no longer exist (page won't load).
    // It also fought with the push worker (/service-worker.js) for the same "/" scope.
    // selfDestroying emits a /sw.js that wipes all caches and unregisters itself on devices
    // that still have the old worker. The ONLY worker the app uses now is /service-worker.js
    // (push notifications, no page caching). The manifest is public/manifest.json.
    VitePWA({
      selfDestroying: true,
      injectRegister: false,
      manifest: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
  },
  };
});

