import React, { useState, useRef } from "react";
import { Mic, Send, Sparkles, Loader2, StopCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { parseOrderInput, checkForDuplicates } from "../services/geminiService";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function OrderInput({ onOrderCreated }: { onOrderCreated: () => void }) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ isDuplicate: boolean; similarOrderId?: string; reason?: string } | null>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  
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

  const handleSubmit = async () => {
    if (!input.trim() || !user) return;
    
    setIsProcessing(true);
    try {
      // 1. Fetch existing orders for context/duplicate check
      const q = query(collection(db, "orders"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const existingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. AI Duplicate Check
      const check = await checkForDuplicates(input, existingOrders);
      
      if (check.isDuplicate) {
        setDuplicateCheck(check);
        setIsProcessing(false);
        return;
      }

      await createOrder(input, existingOrders);
    } catch (error) {
      console.error(error);
      toast.error("Fehler bei der Verarbeitung.");
      setIsProcessing(false);
    }
  };

  const createOrder = async (rawInput: string, existingOrders: any[]) => {
    setIsProcessing(true);
    try {
      const structuredData = await parseOrderInput(rawInput, JSON.stringify(existingOrders.slice(0, 10)));
      
      const newOrder = {
        ...structuredData,
        rawInput,
        userId: user!.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: structuredData.status || 'pending',
      };

      await addDoc(collection(db, "orders"), newOrder);
      toast.success("Auftrag erfolgreich angelegt!");
      setInput("");
      onOrderCreated();
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Erstellen des Auftrags.");
    } finally {
      setIsProcessing(false);
      setDuplicateCheck(null);
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

      <div className="flex items-center gap-3 mt-6">
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

      <AlertDialog open={!!duplicateCheck} onOpenChange={() => setDuplicateCheck(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-bento">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-400 font-bold uppercase tracking-wider text-sm italic">AI KONTEXT HINWEIS</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed pt-2">
              {duplicateCheck?.reason}
              <br /><br />
              <span className="text-slate-200 font-semibold block">Möchtest du diesen Auftrag trotzdem als neuen Eintrag anlegen?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel variant="outline" size="default" className="flex-1 bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl">Nein, abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="default" size="default" onClick={() => createOrder(input, [])} className="flex-1 bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 rounded-xl">Trotzdem anlegen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
