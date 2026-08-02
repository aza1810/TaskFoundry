import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'online.azztech.taskfoundry',
  appName: 'Task Foundry',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Health permissions are requested at runtime via @capgo/capacitor-health
  },
}

export default config
