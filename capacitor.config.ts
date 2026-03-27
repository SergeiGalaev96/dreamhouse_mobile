import { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === "development";

const config: CapacitorConfig = {
  appId: 'com.dreamhouse.app',
  appName: 'DreamHouse',
  webDir: 'dist',

  server: {
    androidScheme: "http",
    ...(isDev && {
      url: "http://192.168.2.112:3300",
      cleartext: true
    })
  }
};

export default config;