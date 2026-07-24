/**
 * Single source of truth for the app's version string.
 *
 * Reads `expo.version` from app.json via expo-constants — nothing else in
 * the codebase should hardcode a version. The `'0.0.0'` fallback is a
 * last-resort sentinel so the App-Version header is always well-formed.
 */
import Constants from 'expo-constants';

export const APP_VERSION: string =
  Constants.expoConfig?.version ??
  (Constants.manifest as any)?.version ??
  '0.0.0';
