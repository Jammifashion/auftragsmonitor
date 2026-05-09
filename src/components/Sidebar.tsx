import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, LogOut, Settings, Zap } from "lucide-react";
import { useAuth } from "../AuthContext";
import { cn } from "../lib/utils";

export default function Sidebar() {
  const { logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: ShoppingCart, label: "Aufträge", path: "/orders" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-20 bg-slate-900 border-r border-slate-800 flex-col items-center py-8 z-50">
      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 mb-12">
        <Zap className="w-6 h-6 fill-current" />
      </div>

      <nav className="flex flex-col space-y-6 flex-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={cn(
                "p-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-slate-800 text-emerald-400" 
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              )}
            >
              <item.icon className="w-6 h-6" />
              {isActive && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-6 items-center pt-8 border-t border-slate-800 w-full">
        <button
          onClick={logout}
          className="p-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-all duration-200"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </aside>
  );
}
