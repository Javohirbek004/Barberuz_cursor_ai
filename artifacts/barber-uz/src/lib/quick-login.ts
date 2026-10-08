const PIN_KEY = "barber_quick_pin";
const CRED_KEY = "barber_quick_cred";
const UNLOCK_KEY = "barber_quick_unlocked";

export async function hashPin(pin: string): Promise<string> {
  const material = new TextEncoder().encode(`barberuz-pin-v1:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", material);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hasQuickPin(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}

export function hasFingerprint(): boolean {
  return !!localStorage.getItem(CRED_KEY);
}

export async function saveQuickPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export async function pinMatches(pin: string): Promise<boolean> {
  const saved = localStorage.getItem(PIN_KEY);
  if (!saved) return false;
  return (await hashPin(pin)) === saved;
}

export function clearQuickPin(): void {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(CRED_KEY);
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function quickLocked(): boolean {
  return !!localStorage.getItem(PIN_KEY) && sessionStorage.getItem(UNLOCK_KEY) !== "1";
}

export function markQuickUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

function bytesToB64(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text);
}

function b64ToBytes(value: string): Uint8Array {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}

export async function registerFingerprint(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return false;
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Barber.uz" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "barber",
          displayName: "Barber",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60_000,
      },
    });
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, bytesToB64(new Uint8Array(cred.rawId)));
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithFingerprint(): Promise<boolean> {
  const saved = localStorage.getItem(CRED_KEY);
  if (!saved) return false;
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: b64ToBytes(saved) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!cred;
  } catch {
    return false;
  }
}
