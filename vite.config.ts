import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig({
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  server: {
    allowedHosts: true, // Allow all hosts (ngrok, cloudflare, etc.)
    host: true, // Listen on all addresses (0.0.0.0)
    cors: true, // Enable CORS
    // Trust the X-Forwarded headers from ngrok/cloudflare
    proxy: {},
  },
})
