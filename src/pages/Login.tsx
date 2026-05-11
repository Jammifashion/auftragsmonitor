import { useAuth } from "../AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { LogIn } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();

  if (user) return <Navigate to="/" />;

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-[400px] bento-card border-none shadow-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center text-slate-950 font-bold text-3xl shadow-lg shadow-accent-500/20">
            A
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Willkommen zurück</h2>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
              Melde dich an, um Aufträge zu verwalten.
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <Button 
            className="w-full bg-slate-100 hover:bg-white text-slate-900 h-12 gap-3 font-bold rounded-xl transition-all" 
            onClick={login}
          >
            <LogIn className="w-5 h-5" />
            Mit Google anmelden
          </Button>
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600 font-bold tracking-widest uppercase">
            <span className="h-px bg-white dark:bg-slate-800 flex-1"></span>
            <span>Secure Access</span>
            <span className="h-px bg-white dark:bg-slate-800 flex-1"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
