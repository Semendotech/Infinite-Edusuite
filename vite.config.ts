import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  ssr: { noExternal: true },
  plugins: [
    tanstackStart({
      server: { entry: "server", platform: "node" },
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
});
