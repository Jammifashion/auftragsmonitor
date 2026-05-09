import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(sessionStorage.getItem('google_access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const whitelist = ['gbr@jammifashion.de', 'jammitoo@gmail.com'];
        if (!whitelist.includes(user.email)) {
          await signOut(auth);
          setUser(null);
          setGoogleToken(null);
          sessionStorage.removeItem('google_access_token');
          alert('Zugriff verweigert: Deine E-Mail-Adresse ist nicht autorisiert.');
        } else {
          setUser(user);
        }
      } else {
        setUser(user);
        if (!user) {
          setGoogleToken(null);
          sessionStorage.removeItem('google_access_token');
        }
      }
      setLoading(false);
    });
  }, []);

  const login = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGoogleToken(credential.accessToken);
      sessionStorage.setItem('google_access_token', credential.accessToken);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGoogleToken(null);
    sessionStorage.removeItem('google_access_token');
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
