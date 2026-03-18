import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  deriveKey,
  encryptString,
  decryptString,
  isEncrypted,
  generateSalt,
  exportKeyToSession,
  importKeyFromSession,
  clearKeyFromSession,
  createVerifier,
  verifyKey,
} from '../services/crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VaultStatus = 'loading' | 'no-vault' | 'locked' | 'unlocked';

interface VaultContextType {
  vaultStatus: VaultStatus;
  setupVault: (passphrase: string) => Promise<void>;
  unlockVault: (passphrase: string) => Promise<boolean>;
  lockVault: () => void;
  /** 이 세션에서 설정 건너뛰기 — 데이터는 암호화되지 않음 */
  skipVault: () => void;
  encrypt: (plaintext: string) => Promise<string>;
  decrypt: (value: string) => Promise<string>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// Vault 키 없이 암호화된 값을 읽으려 할 때 표시되는 플레이스홀더
const ENCRYPTED_PLACEHOLDER = '[잠긴 내용]';

// ── Provider ──────────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('loading');
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  // Firestore에서 읽은 salt·verifier를 메모리에 보관 (unlock 시 재사용)
  const [saltB64, setSaltB64] = useState('');
  const [verifierStr, setVerifierStr] = useState('');

  // ── 사용자 변경 시 Vault 상태 초기화 ────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setVaultStatus('loading');
      setVaultKey(null);
      setSaltB64('');
      setVerifierStr('');
      return;
    }

    const init = async () => {
      setVaultStatus('loading');
      try {
        const snap = await getDoc(doc(db, 'vault_meta', user.uid));
        const data = snap.data() ?? {};
        const salt = data.vaultSalt as string | undefined;
        const verifier = data.vaultVerifier as string | undefined;

        if (!salt || !verifier) {
          // Vault 미설정
          setVaultStatus('no-vault');
          return;
        }

        setSaltB64(salt);
        setVerifierStr(verifier);

        // sessionStorage에 캐시된 키가 있으면 복원
        const cached = await importKeyFromSession();
        if (cached && await verifyKey(cached, verifier)) {
          setVaultKey(cached);
          setVaultStatus('unlocked');
        } else {
          clearKeyFromSession();
          setVaultStatus('locked');
        }
      } catch (err) {
        console.error('[Vault] 초기화 실패:', err);
        setVaultStatus('no-vault');
      }
    };

    init();
  }, [user]);

  // ── Setup (최초 설정) ────────────────────────────────────────────────────────

  const setupVault = useCallback(async (passphrase: string) => {
    if (!user) return;
    const salt = generateSalt();
    const key = await deriveKey(passphrase, salt);
    const verifier = await createVerifier(key);

    // salt와 verifier를 vault_meta/{uid}에 저장 (민감 정보 아님)
    await setDoc(doc(db, 'vault_meta', user.uid), { vaultSalt: salt, vaultVerifier: verifier });

    setSaltB64(salt);
    setVerifierStr(verifier);
    await exportKeyToSession(key);
    setVaultKey(key);
    setVaultStatus('unlocked');
  }, [user]);

  // ── Unlock ────────────────────────────────────────────────────────────────────

  const unlockVault = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!saltB64 || !verifierStr) return false;
    try {
      const key = await deriveKey(passphrase, saltB64);
      if (!await verifyKey(key, verifierStr)) return false;
      await exportKeyToSession(key);
      setVaultKey(key);
      setVaultStatus('unlocked');
      return true;
    } catch {
      return false;
    }
  }, [saltB64, verifierStr]);

  // ── Lock ──────────────────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    clearKeyFromSession();
    setVaultKey(null);
    setVaultStatus('locked');
  }, []);

  // ── Skip (이번 세션에서 설정 건너뜀) ─────────────────────────────────────────

  const skipVault = useCallback(() => {
    // 건너뛰면 vaultKey가 null인 채로 'unlocked'으로 전환
    // → encrypt()는 평문을 그대로 저장, decrypt()는 플레이스홀더 없이 그대로 반환
    setVaultStatus('unlocked');
  }, []);

  // ── encrypt / decrypt helpers ────────────────────────────────────────────────

  const encrypt = useCallback(async (plaintext: string): Promise<string> => {
    if (!vaultKey || !plaintext) return plaintext;
    return encryptString(plaintext, vaultKey);
  }, [vaultKey]);

  const decrypt = useCallback(async (value: string): Promise<string> => {
    if (!value) return value;
    if (!isEncrypted(value)) return value; // 기존 평문 데이터 — 그대로 반환
    if (!vaultKey) return ENCRYPTED_PLACEHOLDER;
    try {
      return await decryptString(value, vaultKey);
    } catch {
      return ENCRYPTED_PLACEHOLDER;
    }
  }, [vaultKey]);

  return (
    <VaultContext.Provider value={{ vaultStatus, setupVault, unlockVault, lockVault, skipVault, encrypt, decrypt }}>
      {children}
    </VaultContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
