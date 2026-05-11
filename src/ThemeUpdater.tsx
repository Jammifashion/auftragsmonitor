import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useTheme } from 'next-themes';

const COLOR_MAP = {
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
  }
};

export function ThemeUpdater() {
  const { user, loading } = useAuth();
  const { setTheme, theme: currentTheme } = useTheme();

  useEffect(() => {
    if (!user) {
        // Apply default
        applyColorMap(COLOR_MAP.emerald);
        return;
    }
    
    let unsubscribe: () => void;
    
    import('firebase/firestore').then(({ onSnapshot }) => {
      unsubscribe = onSnapshot(doc(db, "settings", user.uid), (docSnap) => {
        const accent = docSnap.exists() ? (docSnap.data().accent || 'emerald') : 'emerald';
        const colors = (COLOR_MAP as any)[accent] || COLOR_MAP.emerald;
        applyColorMap(colors);

        const newTheme = docSnap.exists() ? (docSnap.data().theme || 'system') : 'system';
        if (currentTheme !== newTheme) {
            setTheme(newTheme);
        }
      }, (err) => {
        console.error("Theme set error:", err);
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]); // We intentionally do not react to currentTheme changes to avoid ping-pong.

  const applyColorMap = (colors: any) => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([weight, hex]) => {
      root.style.setProperty(`--accent-${weight}`, hex as string);
    });
  };

  return null;
}
