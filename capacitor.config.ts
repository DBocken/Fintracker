import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.finanz.copilot",
  appName: "Ausgabentracker",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;