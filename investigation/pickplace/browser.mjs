import { chromium } from 'playwright';
export async function launch() {
  // Installed Edge: ordinary browser security, no CORS bypass or request interception.
  return chromium.launch({channel:'msedge',headless:true});
}
