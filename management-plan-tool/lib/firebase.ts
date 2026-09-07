import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
export const firebaseConfigured = [config.apiKey, config.authDomain, config.projectId, config.appId].every(Boolean) && !(emulator && process.env.NODE_ENV === 'production');
export let auth: Auth | null = null;
if (firebaseConfigured) { const app = getApps().length ? getApp() : initializeApp(config); auth = getAuth(app); if (emulator && typeof window !== 'undefined' && !(auth as Auth & { emulatorConfig?: unknown }).emulatorConfig) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); }
