import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ["demo-lata.onrender.com", "demo-lata-1.onrender.com"]
  }
});
