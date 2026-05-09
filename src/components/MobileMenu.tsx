import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Settings, LogOut, X } from "lucide-react";
import { useAuth } from "../AuthContext";
import { cn } from "../lib/utils";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { logout } = useAuth();
  const location = useLocation();

  if (!isOpen) return null;

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: ShoppingCart, label: "Aufträge", path: "/orders" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-6">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Menü</h2>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
          <X className="w-8 h-8" />
        </button>
      </div>

      <nav className="flex flex-col space-y-8 flex-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-4 text-xl font-bold py-4 px-6 rounded-xl transition-all",
                isActive 
                  ? "bg-slate-800 text-emerald-400" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className="w-8 h-8" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-8 border-t border-slate-800">
        <button
          onClick={() => { logout(); onClose(); }}
          className="flex items-center gap-4 text-xl font-bold text-red-400 py-4 px-6 rounded-xl w-full hover:bg-slate-800"
        >
          <LogOut className="w-8 h-8" />
          Logout
        </button>
      </div>
    </div>
  );
}
