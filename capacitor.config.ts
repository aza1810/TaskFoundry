import type { CapacitorConfig } from '@capacitor/cli'
import pkg from './package.json' with { type: 'json' }

const config: CapacitorConfig = {
  appId: 'online.azztech.taskfoundry',
  appName: 'Task Foundry',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      // Native HTTP for cloud save API (WebView fetch to azztech is unreliable).
      enabled: true,
    },
    CapacitorUpdater: {
      // Manual OTA from src/native/ota.ts (fetches latest.json on azztech).
      // autoUpdate stays false so we don't depend on Capgo cloud or PHP.
      autoUpdate: false,
      statsUrl: '',
      appReadyTimeout: 15000,
      keepUrlPathAfterReload: true,
      version: pkg.version,
    },
  },
}

export default config
