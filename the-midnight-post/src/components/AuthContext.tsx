import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  showGuideModal: boolean;
  setShowGuideModal: (v: boolean) => void;
  isNewUser: boolean;
  markOnboarded: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** @deprecated use setShowAuthModal(true) */
  signIn: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Returns true if this is a brand-new user that hasn't completed onboarding */
async function ensureUserDoc(currentUser: User, referralCode: string | null): Promise<boolean> {
  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    const userData: Record<string, unknown> = {
      uid: currentUser.uid,
      email: currentUser.email,
      createdAt: new Date(),
      onboarded: false,
    };
    if (currentUser.displayName) userData.displayName = currentUser.displayName;
    await setDoc(userRef, userData);

    // 유효한 추천인 코드가 있으면 레퍼럴 이벤트 기록 (self-referral 방지)
    if (referralCode && referralCode !== currentUser.uid) {
      try {
        await setDoc(doc(db, 'referral_events', currentUser.uid), {
          referrerId: referralCode,
          newUserId: currentUser.uid,
          createdAt: Timestamp.now(),
        });
      } catch {
        // non-fatal
      }
    }

    return true; // brand-new user
  }
  const data = userSnap.data();
  return data?.onboarded === false; // returning user who hasn't finished onboarding
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // URL ?ref= 파라미터를 localStorage에 저장 (페이지 진입 시 1회)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) localStorage.setItem('mp_ref', ref);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const referralCode = localStorage.getItem('mp_ref');
          const newUser = await ensureUserDoc(currentUser, referralCode);
          if (newUser) localStorage.removeItem('mp_ref');
          setIsNewUser(newUser);
        } catch (err) {
          console.warn('ensureUserDoc failed (non-fatal):', err);
        }
      } else {
        setIsNewUser(false);
      }
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const markOnboarded = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, { onboarded: true });
    } catch {
      // fallback: rewrite full doc if updateDoc fails (e.g. field didn't exist)
      await setDoc(userRef, { onboarded: true }, { merge: true });
    }
    setIsNewUser(false);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
    setShowAuthModal(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    setShowAuthModal(false);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    setShowAuthModal(false);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  // Legacy compat
  const signIn = async () => setShowAuthModal(true);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showAuthModal,
        setShowAuthModal,
        showGuideModal,
        setShowGuideModal,
        isNewUser,
        markOnboarded,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        signIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
