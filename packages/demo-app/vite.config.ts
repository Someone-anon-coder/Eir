import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vite only auto-exposes VITE_-prefixed vars that come from `.env` files
  // or `--mode`-loaded env, not arbitrary ambient shell/process env — and
  // the benchmark harness (packages/benchmark) sets this one as a plain
  // process env var before spawning `vite`, never via a `.env` file (a
  // seeded-per-run JSON blob has no business being written to disk as a
  // dotenv entry). Defining it explicitly from `process.env` here — which
  // runs in Node, where the real value exists — is what actually gets it
  // into `import.meta.env` for client code.
  define: {
    "import.meta.env.VITE_EIR_MUTATIONS": JSON.stringify(process.env["VITE_EIR_MUTATIONS"] ?? ""),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
