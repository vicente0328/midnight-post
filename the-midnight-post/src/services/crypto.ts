// ── Client-side AES-GCM encryption with PBKDF2 key derivation ────────────────
// 관리자가 Firestore를 직접 열람해도 평문을 볼 수 없도록 보호합니다.

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'SHA-256';
const IV_LENGTH = 12;  // bytes (96-bit)
const SALT_LENGTH = 16; // bytes (128-bit)

const SESSION_STORAGE_KEY = 'vault_key_b64';
const VERIFIER_PLAINTEXT = 'midnight-post-vault-v1';

// ── Binary ↔ Base64 helpers ──────────────────────────────────────────────────

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ── Salt generation ──────────────────────────────────────────────────────────

export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
}

// ── Key derivation (PBKDF2 → AES-GCM) ───────────────────────────────────────

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable — needed for sessionStorage caching
    ['encrypt', 'decrypt'],
  );
}

// ── Encrypt / Decrypt ────────────────────────────────────────────────────────

export interface EncryptedBlob {
  v: 1;
  iv: string; // base64
  ct: string; // base64 ciphertext
}

export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const blob: EncryptedBlob = { v: 1, iv: toBase64(iv), ct: toBase64(ciphertext) };
  return JSON.stringify(blob);
}

export async function decryptString(value: string, key: CryptoKey): Promise<string> {
  const { iv: ivB64, ct: ctB64 } = JSON.parse(value) as EncryptedBlob;
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(ivB64) },
    key,
    fromBase64(ctB64),
  );
  return new TextDecoder().decode(plaintext);
}

// ── Encrypted-value detection ────────────────────────────────────────────────

export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return parsed.v === 1 && typeof parsed.iv === 'string' && typeof parsed.ct === 'string';
  } catch {
    return false;
  }
}

// ── Key verifier (detects wrong password without exposing plaintext) ──────────

export async function createVerifier(key: CryptoKey): Promise<string> {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

export async function verifyKey(key: CryptoKey, verifier: string): Promise<boolean> {
  try {
    const result = await decryptString(verifier, key);
    return result === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

// ── SessionStorage key cache ─────────────────────────────────────────────────
// 탭 닫힘 / 브라우저 종료 시 자동으로 사라집니다.

export async function exportKeyToSession(key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem(SESSION_STORAGE_KEY, toBase64(raw));
}

export async function importKeyFromSession(): Promise<CryptoKey | null> {
  const b64 = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!b64) return null;
  try {
    const raw = fromBase64(b64);
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearKeyFromSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
