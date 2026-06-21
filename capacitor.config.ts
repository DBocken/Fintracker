import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.finanz.copilot",
  appName: "Ausgabentracker",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [],
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    loggingBehavior: "none",
  },
};

export default config;
