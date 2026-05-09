import React, { useState, useRef } from "react";
import { Mic, Send, Sparkles, Loader2, StopCircle, CalendarPlus, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { processUniversalInput } from "../services/geminiService";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, limit } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { cn } from "@/lib/utils";
import { createGoogleCalendarEvent } from "../services/calendarService";
import { parseISO, addHours } from "date-fns";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

export default function OrderInput({ onOrderCreated, onQuery }: { onOrderCreated: () => void, onQuery?: (queryData: any) => void }) {
  const { user, googleToken, login } = useAuth();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoCalendar, setAutoCalendar] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ isDuplicate: boolean; similarOrderId?: string; reason?: string } | null>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [pendingClient, setPendingClient] = useState<any>(null);
  
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Spracherkennung wird von diesem Browser nicht unterstützt.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'de-DE';
    recognitionRef.current.continuous = false;
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const upsertClient = async (clientData: any, userId: string): Promise<string | null> => {
    if (!clientData || !clientData.name) return null;
    try {
      const q = query(
        collection(db, "clients"), 
        where("userId", "==", userId), 
        where("name", "==", clientData.name),
        limit(1)
      );
      const snap = await getDocs(q);
      const now = serverTimestamp();
      
      if (!snap.empty) {
        const clientDoc = snap.docs[0];
        // Only update if fresh info is provided
        const existing = clientDoc.data();
        const update: any = { updatedAt: now };
        if (clientData.telefon && clientData.telefon !== existing.telefon) update.telefon = clientData.telefon;
        if (clientData.email && clientData.email !== existing.email) update.email = clientData.email;
        if (clientData.adresse && clientData.adresse !== existing.adresse) update.adresse = clientData.adresse;
        if (clientData.zahlungsinfo && clientData.zahlungsinfo !== existing.zahlungsinfo) update.zahlungsinfo = clientData.zahlungsinfo;
        
        await updateDoc(clientDoc.ref, update);
        return clientDoc.id;
      } else {
        const docRef = await addDoc(collection(db, "clients"), {
          ...clientData,
          userId,
          updatedAt: now
        });
        return docRef.id;
      }
    } catch (e) {
      console.error("CRM Upsert error:", e);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || !user) return;
    
    setIsProcessing(true);
    try {
      // 1. Fetch existing orders and clients for context
      const qOrders = query(collection(db, "orders"), where("userId", "==", user.uid), limit(20));
      const qClients = query(collection(db, "clients"), where("userId", "==", user.uid), limit(20));
      
      const [snapOrders, snapClients] = await Promise.all([getDocs(qOrders), getDocs(qClients)]);
      
      const existingOrders = snapOrders.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const existingClients = snapClients.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // 2. AI Unified Processing
      const result = await processUniversalInput(
        input, 
        existingOrders, 
        existingClients.map((c: any) => `Client: ${c.name}, Info: ${c.telefon || ''} ${c.email || ''}`).join('\n')
      ); 
      
      toast(result.text_response, { icon: "🧠" });

      if (result.intent === 'query') {
        if (onQuery && result.query_data) {
           onQuery(result.query_data);
           setInput("");
        }
        setIsProcessing(false);
        return;
      }

      // 3. Handle Create Intent
      if (result.intent === 'create' && result.create_data) {
        // Invisible CRM Upsert if client data present
        const clientId = await upsertClient(result.client_data, user.uid);
        
        if (result.create_data.duplicate_check?.is_potential_duplicate) {
          setDuplicateCheck({
            isDuplicate: true,
            reason: result.create_data.duplicate_check.reason,
            similarOrderId: result.create_data.duplicate_check.similarOrderId
          });
          setPendingOrder({ input, existingOrders, structuredData: result.create_data, clientId });
          setIsProcessing(false);
          return;
        }

        await executeCreateOrder(rawInputToOrderData(result.create_data, input, user.uid, clientId));
      }

    } catch (error: any) {
      console.error("AI Unified Processing Error:", error);
      const errorMessage = error?.message || "Unbekannter Fehler";
      toast.error(`KI Fehler: ${errorMessage.slice(0, 50)}...`, {
        description: "Zero-Friction Engine konnte die Eingabe nicht verarbeiten."
      });
      setIsProcessing(false);
    }
  };

  const rawInputToOrderData = (create_data: any, originalInput: string, userId: string, clientId: string | null) => {
     return {
        type: create_data.type,
        title: create_data.title,
        clientId: clientId,
        clientName: create_data.clientName || "",
        description: create_data.description,
        deadline: create_data.deadline,
        priority: create_data.priority,
        structured_details: create_data.structured_details,
        rawInput: originalInput,
        userId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending'
     }
  }

  const executeCreateOrder = async (newOrder: any) => {
    setIsProcessing(true);
    try {
      await addDoc(collection(db, "orders"), newOrder);
      
      // Auto Calendar Sync
      if (autoCalendar && googleToken && newOrder.deadline) {
        try {
          const startDateTime = parseISO(newOrder.deadline);
          const endDateTime = addHours(startDateTime, 1);
          await createGoogleCalendarEvent(googleToken, {
            summary: `${newOrder.type.toUpperCase()}: ${newOrder.title}`,
            description: `${newOrder.description}${newOrder.clientName ? `\n\nKunde: ${newOrder.clientName}` : ''}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
          });
          toast.success("Auch im Kalender vermerkt!");
        } catch (calError) {
          console.error(calError);
          toast.error("Auftrag erstellt, aber Kalender-Eintrag fehlgeschlagen.");
        }
      }

      setInput("");
      onOrderCreated();
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Erstellen des Auftrags.");
    } finally {
      setIsProcessing(false);
      setDuplicateCheck(null);
      setPendingOrder(null);
    }
  };

  return (
    <div className="bento-gradient min-h-[220px] flex flex-col justify-between overflow-hidden">
      <div>
        <h3 className="text-emerald-400 font-semibold mb-1 uppercase text-xs tracking-wider">Schnellerfassung</h3>
        <p className="text-2xl font-light text-white mb-6">Wie kann ich helfen?</p>
      </div>
      
      <div className="relative group">
        <Textarea
          placeholder="z.B. Sprachnotizen, Chat-Auszüge oder direkte Texte..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[100px] bg-slate-950/40 border-slate-700/50 text-slate-200 placeholder:text-slate-600 rounded-2xl resize-none pr-12 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all"
        />
        <div className="absolute right-3 top-3">
          <div className={cn(
             "w-2 h-2 rounded-full transition-all duration-500",
             isListening ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
          )} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 mb-2">
        <div className="flex items-center space-x-2">
          <Switch 
            id="auto-calendar" 
            checked={autoCalendar} 
            onCheckedChange={setAutoCalendar}
            className="data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="auto-calendar" className="text-[10px] uppercase font-bold text-slate-500 cursor-pointer flex items-center gap-1.5">
            <CalendarPlus className="w-3 h-3" /> Im Google Kalender eintragen
          </Label>
        </div>
        {!googleToken && autoCalendar && (
           <div className="flex flex-col items-end">
             <p className="text-[9px] text-orange-400 animate-pulse font-medium">Berechtigung fehlt</p>
             <button 
               onClick={(e) => { e.preventDefault(); login(); }} 
               className="text-[8px] text-blue-400 underline hover:text-blue-300"
             >
               Jetzt Kalender freigeben
             </button>
           </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Button 
          size="icon" 
          variant="outline" 
          onClick={isListening ? stopListening : startListening}
          className={cn(
            "rounded-xl h-12 w-12 shrink-0 transition-all",
            isListening 
              ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" 
              : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          )}
        >
          {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isProcessing || !input.trim()}
          className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold gap-3 transition-all disabled:bg-slate-800 disabled:text-slate-600"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              VERARBEITEN
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={!!duplicateCheck} onOpenChange={() => { setDuplicateCheck(null); setPendingOrder(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-bento max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Dubletten-Check
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed pt-2">
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 mb-4 italic text-xs text-slate-300">
                "{duplicateCheck?.reason}"
              </div>
              Wie möchtest du mit dieser Eingabe verfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 gap-2 mt-4">
            <Button 
              onClick={async () => {
                if (pendingOrder && duplicateCheck?.similarOrderId) {
                  setIsProcessing(true);
                  try {
                    const orderRef = doc(db, "orders", duplicateCheck.similarOrderId);
                    const existing = (pendingOrder.existingOrders as any[]).find(o => o.id === duplicateCheck.similarOrderId);
                    
                    await updateDoc(orderRef, {
                      description: `${existing?.description || ""}\n\n[Update ${new Date().toLocaleDateString()}]: ${pendingOrder.input}`,
                      updatedAt: serverTimestamp()
                    });
                    
                    toast.success("Eintrag wurde dem bestehenden Auftrag hinzugefügt!");
                    setInput("");
                    onOrderCreated();
                    setDuplicateCheck(null);
                    setPendingOrder(null);
                  } catch (e) {
                    toast.error("Fehler beim Aktualisieren.");
                  } finally {
                    setIsProcessing(false);
                  }
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Bestehenden Auftrag aktualisieren
            </Button>
            
            <Button 
              onClick={async () => {
                if (pendingOrder) {
                  setDuplicateCheck(null);
                  await executeCreateOrder(rawInputToOrderData(pendingOrder.structuredData, pendingOrder.input, user!.uid, pendingOrder.clientId));
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Neu anlegen (Separater Eintrag)
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                setDuplicateCheck(null);
                setPendingOrder(null);
              }}
              className="w-full bg-transparent border-slate-800 text-slate-500 hover:text-slate-300 h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Vorgang abbrechen
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
