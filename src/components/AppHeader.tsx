import { useAuth } from "../AuthContext";
import { Search, User, Menu } from "lucide-react";

interface AppHeaderProps {
  onMenuClick: () => void;
}

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-slate-50 dark:bg-slate-950 flex items-center justify-between px-4 md:px-8 border-b border-slate-900 shrink-0">
      <div className="flex items-center gap-2 md:gap-4">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <span className="hidden md:inline">AUFTRAGS</span><span className="md:hidden">A</span> <span className="text-accent-400">MONITOR</span> 
          <span className="hidden md:inline text-slate-600 font-normal ml-2">| Dashboard</span>
        </h1>
      </div>
      <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-full w-96 border border-slate-200 dark:border-slate-800">
        <Search className="w-4 h-4 text-slate-500 dark:text-slate-500 mr-2" />
        <input 
          type="text" 
          placeholder="Suche nach Aufträgen..." 
          className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-600 dark:text-slate-300 placeholder-slate-600"
        />
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">{user?.displayName?.split(' ')[0]}</p>
          <p className="text-[10px] text-accent-400">Verbunden</p>
        </div>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="User" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-300 dark:border-slate-700" />
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center">
            <User className="text-slate-500 dark:text-slate-400 w-4 h-4 md:w-5 md:h-5" />
          </div>
        )}
        <button className="p-2 ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white dark:bg-slate-800 rounded-full transition-colors md:hidden" onClick={onMenuClick}>
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
