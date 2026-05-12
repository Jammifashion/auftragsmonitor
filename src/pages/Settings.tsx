import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Paintbrush, Save, Moon, Sun, Monitor, Bot, Languages, CalendarClock, Archive, Download, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../AuthContext";
import { toast } from "sonner";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { useTheme } from "next-themes";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const { setTheme: setNextTheme, theme: nextTheme } = useTheme();
  const [theme, setTheme] = useState("system");
  const [accent, setAccent] = useState("emerald");
  
  const [toneOfVoice, setToneOfVoice] = useState("business");
  const [recognitionLanguage, setRecognitionLanguage] = useState("de-DE");
  
  const [defaultDeadline, setDefaultDeadline] = useState("7");
  const [autoArchive, setAutoArchive] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.theme) {
            setTheme(data.theme);
            setNextTheme(data.theme);
          }
          if (data.accent) setAccent(data.accent);
          if (data.toneOfVoice) setToneOfVoice(data.toneOfVoice);
          if (data.recognitionLanguage) setRecognitionLanguage(data.recognitionLanguage);
          if (data.defaultDeadline) setDefaultDeadline(data.defaultDeadline);
          if (data.autoArchive !== undefined) setAutoArchive(data.autoArchive);
        }
      } catch (e) {
        console.error("Fehler beim Laden der Einstellungen:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user, setNextTheme]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        theme,
        accent,
        toneOfVoice,
        recognitionLanguage,
        defaultDeadline,
        autoArchive
      }, { merge: true });
      toast.success("Einstellungen gespeichert");
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setNextTheme(newTheme);
  };

  const handleExportCSV = async () => {
    if (!user) return;
    try {
      toast.info("Export wird vorbereitet...");
      const snap = await getDocs(collection(db, "orders"));
      const orders = snap.docs.map(d => d.data());
      
      // Filtere auf den User (optional, wenn Orders eine userId haben)
      // Fürs Erste exportieren wir einfach die Felder
      const csvContent = [
        ["Titel", "Kunde", "Typ", "Status", "Priorität", "Deadline"].join(";"),
        ...orders.map(o => [
          `"${(o.title || "").replace(/"/g, '""')}"`,
          `"${(o.clientName || "").replace(/"/g, '""')}"`,
          `"${o.type || ""}"`,
          `"${o.status || ""}"`,
          `"${o.priority || ""}"`,
          `"${o.deadline || ""}"`
        ].join(";"))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `auftragsmonitor_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export abgeschlossen");
    } catch (e) {
      console.error("Fehler beim Export:", e);
      toast.error("Export fehlgeschlagen");
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">Lade Einstellungen...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between p-4 md:p-6 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-accent-500" />
              Einstellungen
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">Passe dein Dashboard an</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent-600 hover:bg-accent-500 text-slate-900 dark:text-white px-4 py-2 rounded-xl font-medium transition-all"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">{saving ? "Speichert..." : "Speichern"}</span>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
          
          <section className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Paintbrush className="w-5 h-5 text-accent-400" />
              Darstellung
            </h2>
            
            <div className="space-y-6">
              {/* Theme Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Farbschema (Theme)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                      theme === "dark" ? "bg-white dark:bg-slate-800 border-accent-500 text-slate-900 dark:text-white" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:border-slate-700 hover:text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="font-medium">Dark Mode</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                      theme === "light" ? "bg-white dark:bg-slate-800 border-accent-500 text-slate-900 dark:text-white" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:border-slate-700 hover:text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="font-medium">Light Mode</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("system")}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                      theme === "system" ? "bg-white dark:bg-slate-800 border-accent-500 text-slate-900 dark:text-white" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:border-slate-700 hover:text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="font-medium">System</span>
                  </button>
                </div>
              </div>

              {/* Accent Color Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Akzentfarbe</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { id: "emerald", color: "#10b981" },
                    { id: "blue", color: "#3b82f6" },
                    { id: "purple", color: "#a855f7" },
                    { id: "orange", color: "#f97316" },
                    { id: "rose", color: "#f43f5e" }
                  ].map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setAccent(color.id)}
                      style={{ backgroundColor: color.color }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        accent === color.id ? "ring-2 ring-accent-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              KI-Assistent (Gemini) Einstellungen
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Tone of Voice</label>
                <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <span className="flex-1 text-left truncate">
                      {toneOfVoice === 'business' ? 'Strikt geschäftlich' : toneOfVoice === 'short' ? 'Kurz & knackig' : toneOfVoice === 'humorous' ? 'Humorvoll' : toneOfVoice}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <SelectItem value="business">Strikt geschäftlich</SelectItem>
                    <SelectItem value="short">Kurz & knackig</SelectItem>
                    <SelectItem value="humorous">Humorvoll</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Bestimmt, wie der Sprachassistent antwortet.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Spracherkennungs-Sprache</label>
                <Select value={recognitionLanguage} onValueChange={setRecognitionLanguage}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <span className="flex-1 text-left truncate">
                      {recognitionLanguage === 'de-DE' ? 'Deutsch (DE)' : recognitionLanguage === 'en-US' ? 'Englisch (US)' : recognitionLanguage === 'en-GB' ? 'Englisch (UK)' : recognitionLanguage === 'es-ES' ? 'Spanisch' : recognitionLanguage}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <SelectItem value="de-DE">Deutsch (DE)</SelectItem>
                    <SelectItem value="en-US">Englisch (US)</SelectItem>
                    <SelectItem value="en-GB">Englisch (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanisch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Wenn du ab und zu englische Aufträge einsprichst.</p>
              </div>
            </div>
          </section>

          <section className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-400" />
              Workflow & Automatisierung
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Standard-Deadline (falls nicht genannt)</label>
                <Select value={defaultDeadline} onValueChange={setDefaultDeadline}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white md:w-1/2">
                    <span className="flex-1 text-left truncate">
                      {defaultDeadline === '1' ? 'Morgen (1 Tag)' : defaultDeadline === '3' ? 'In 3 Tagen' : defaultDeadline === '7' ? 'In 7 Tagen' : defaultDeadline === '14' ? 'In 14 Tagen' : defaultDeadline === 'none' ? 'Keine Standard-Deadline' : defaultDeadline}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <SelectItem value="1">Morgen (1 Tag)</SelectItem>
                    <SelectItem value="3">In 3 Tagen</SelectItem>
                    <SelectItem value="7">In 7 Tagen</SelectItem>
                    <SelectItem value="14">In 14 Tagen</SelectItem>
                    <SelectItem value="none">Keine Standard-Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h3 className="text-slate-900 dark:text-white font-medium flex items-center gap-2">
                    <Archive className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Auto-Archivierung
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Erledigte Aufgaben nach 30 Tagen automatisch ausblenden/löschen.</p>
                </div>
                <Switch 
                  checked={autoArchive} 
                  onCheckedChange={setAutoArchive} 
                  className="data-[state=checked]:bg-accent-500"
                />
              </div>
            </div>
          </section>

          <section className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-400" />
              Datenverwaltung & Export
            </h2>
            
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h3 className="text-slate-900 dark:text-white font-medium">CSV-Export (Excel)</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Lade alle Aufträge und Kunden als CSV herunter.</p>
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg flex items-center gap-2 transition-colors border border-slate-300 dark:border-slate-700 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Exportieren
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl opacity-70">
                <div>
                  <h3 className="text-slate-900 dark:text-white font-medium flex items-center gap-2">
                    Kategorien anpassen <span className="text-[10px] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Demnächst</span>
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Benenne "Structure" in "Interne Projekte" etc. um.</p>
                </div>
                <button 
                  disabled
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-900 text-slate-600 rounded-lg flex items-center gap-2 border border-slate-200 dark:border-slate-800 shrink-0 cursor-not-allowed"
                >
                  <Paintbrush className="w-4 h-4" />
                  Anpassen
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
