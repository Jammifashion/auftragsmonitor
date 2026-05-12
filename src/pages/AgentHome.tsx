import React, { useState } from "react";
import OrderInput from "../components/OrderInput";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import ReactMarkdown from 'react-markdown';

export default function AgentHome() {
  const navigate = useNavigate();
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const handleOrderCreated = () => {
    // Optionally stay here or navigate
  };

  const handleQuery = (queryData: any, aiResponse?: string) => {
    // Navigate to orders with the query
    navigate('/orders', { state: { queryData, aiResponse } });
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

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:h-full max-w-7xl mx-auto">
          {/* Left Column: Input */}
          <div className="flex flex-col md:h-full">
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
              onAiResponse={setAiResponse}
            />
          </div>

          {/* Right Column: Persistent Response */}
          <div className="flex flex-col md:h-full bg-slate-100 dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 md:overflow-y-auto mt-8 md:mt-0 min-h-[300px]">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">KI-Kontext</h3>
            {aiResponse ? (
                <div className="prose prose-sm dark:prose-invert prose-slate">
                   <ReactMarkdown>{aiResponse}</ReactMarkdown>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 italic">
                    Keine Antwort verfügbar.
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
