import React, { useState } from "react";
import OrderInput from "../components/OrderInput";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

export default function AgentHome() {
  const navigate = useNavigate();

  const handleOrderCreated = () => {
    // Optionally stay here or navigate
  };

  const handleQuery = (queryData: any) => {
    // Navigate to orders with the query
    navigate('/orders', { state: { queryData } });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center justify-end p-4 md:p-6">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-sm font-medium">Zum Dashboard umschalten</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full space-y-8 flex flex-col items-center">
          
          <div className="text-center space-y-4 mb-8">
             <div className="w-20 h-20 bg-accent-500/10 rounded-3xl mx-auto flex items-center justify-center border border-accent-500/20 mb-6">
               <span className="text-4xl">🧠</span>
             </div>
             <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">Hallo Jammi,</h1>
             <p className="text-slate-500 dark:text-slate-400 text-lg">Sag mir einfach, was es Neues gibt, oder frage mich etwas über deine Projekte.</p>
          </div>

          <OrderInput 
            onOrderCreated={handleOrderCreated} 
            onQuery={handleQuery} 
            hideAiResponseText={false}
          />
          
        </div>
      </div>
    </div>
  );
}
