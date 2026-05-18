import { createContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { initUserData } from '../lib/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseReady] = useState(() => isFirebaseConfigured());
  const [loading, setLoading] = useState(() => firebaseReady && !!auth);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Initialize user data in Firestore on first login
        try {
          await initUserData(firebaseUser.uid, {
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
          });
        } catch (error) {
          console.error('Error initializing user data:', error);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseReady]);

  const signIn = async () => {
    if (!firebaseReady || !auth) {
      throw new Error('Firebase is not configured. Please set up your .env file.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, firebaseReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
