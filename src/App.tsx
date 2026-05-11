import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import AgentHome from "./pages/AgentHome";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";

import Settings from "./pages/Settings";
import { ThemeUpdater } from "./ThemeUpdater";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">Lade...</div>;
  if (!user) return <Navigate to="/login" />;
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 md:ml-20 flex flex-col overflow-hidden w-full">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ThemeUpdater />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><AgentHome /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" theme="system" />
      </AuthProvider>
    </ThemeProvider>
  );
}
