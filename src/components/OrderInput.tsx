import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { Mic, Send, Sparkles, Loader2, StopCircle, CalendarPlus, AlertCircle, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { processUniversalInput } from "../services/geminiService";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, limit, deleteDoc, writeBatch, getDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { cn } from "@/lib/utils";
import { createGoogleCalendarEvent, createGoogleTask } from "../services/calendarService";
import { parseISO, addHours } from "date-fns";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

export default function OrderInput({ onOrderCreated, onQuery, onAiResponse }: { onOrderCreated: () => void, onQuery?: (queryData: any, aiResponse?: string) => void, onAiResponse?: (response: string) => void }) {
  const { user, googleToken, login } = useAuth();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ isDuplicate: boolean; similarOrderId?: string; reason?: string } | null>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [userSettings, setUserSettings] = useState<any>({});
  const [wasVoiceInput, setWasVoiceInput] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          setUserSettings(docSnap.data());
        }
      } catch (e) {
        console.error("Error fetching settings:", e);
      }
    };
    fetchSettings();
  }, [user]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Spracherkennung wird von diesem Browser nicht unterstützt.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = userSettings.recognitionLanguage || 'de-DE';
    recognitionRef.current.continuous = false;
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setWasVoiceInput(true);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const upsertProject = async (projectData: any, userId: string): Promise<string | null> => {
    if (!projectData?.name) return null;
    try {
      const now = new Date().toISOString();
      const q = query(collection(db, "projects"), where("userId", "==", userId), where("name", "==", projectData.name), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const projectDoc = snap.docs[0];
        const existing = projectDoc.data();
        let update: any = { updatedAt: now };
        let hasChanges = false;
        
        if (projectData.description && projectData.description !== existing.description) { update.description = projectData.description; hasChanges = true; }
        
        if (hasChanges) {
           await updateDoc(projectDoc.ref, update);
        }
        return projectDoc.id;
      } else {
        const newProjectData = {
          name: String(projectData.name),
          description: projectData.description || null,
          status: "active",
          userId: userId,
          createdAt: now,
          updatedAt: now
        };
        const docRef = await addDoc(collection(db, "projects"), newProjectData);
        return docRef.id;
      }
    } catch (e) {
      console.error("Project Upsert error:", e);
      return null;
    }
  };

  const upsertClient = async (clientData: any, userId: string): Promise<string | null> => {
    if (!clientData || !clientData.name) return null;
    console.log("DEBUG: Upsert-Versuch für Cliente:", clientData); // LOG
    try {
      // 1. Suche nach exaktem Namens-Match
      const q = query(
        collection(db, "clients"), 
        where("userId", "==", userId), 
        where("name", "==", clientData.name),
        limit(1)
      );
      let snap = await getDocs(q);
      
      // 2. Fallback: Suche in Aliase oder Teil-Match
      if (snap.empty) {
        const qAll = query(collection(db, "clients"), where("userId", "==", userId));
        const allClientsSnap = await getDocs(qAll);
        const match = allClientsSnap.docs.find(doc => {
           const d = doc.data();
           const nameMatch = d.name.toLowerCase() === clientData.name.toLowerCase();
           const aliasMatch = d.aliases?.some((a: string) => a.toLowerCase() === clientData.name.toLowerCase());
           return nameMatch || aliasMatch;
        });
        if (match) {
           snap = { empty: false, docs: [match] } as any;
        }
      }

      const now = serverTimestamp();
      
      if (!snap.empty) {
        const clientDoc = snap.docs[0];
        const existing = clientDoc.data();
        console.log("DEBUG: Bestehender Client gefunden, prüfe Updates:", existing);
        
        const update: any = { updatedAt: now };
        let hasChanges = false;
        
        if (clientData.telefon && clientData.telefon !== existing.telefon) { update.telefon = clientData.telefon; hasChanges = true; }
        if (clientData.email && clientData.email !== existing.email) { update.email = clientData.email; hasChanges = true; }
        if (clientData.adresse && clientData.adresse !== existing.adresse) { update.adresse = clientData.adresse; hasChanges = true; }
        if (clientData.zahlungsinfo && clientData.zahlungsinfo !== existing.zahlungsinfo) { update.zahlungsinfo = clientData.zahlungsinfo; hasChanges = true; }
        if (clientData.insights && clientData.insights !== existing.insights) { update.insights = clientData.insights; hasChanges = true; }
        
        if (hasChanges) {
           console.log("DEBUG: Update wird durchgeführt:", update);
           await updateDoc(clientDoc.ref, update);
        }
        return clientDoc.id;
      } else {
        console.log("DEBUG: Neuer Client wird erstellt.");
        const newClientData = {
          name: String(clientData.name),
          telefon: clientData.telefon || null,
          email: clientData.email || null,
          adresse: clientData.adresse || null,
          zahlungsinfo: clientData.zahlungsinfo || null,
          insights: clientData.insights || null,
          userId: userId,
          createdAt: now,
          updatedAt: now
        };
        const docRef = await addDoc(collection(db, "clients"), newClientData);
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
      const qOrders = query(collection(db, "orders"), where("userId", "==", user.uid), limit(20));
      const qClients = query(collection(db, "clients"), where("userId", "==", user.uid), limit(20));
      const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid), limit(20));
      
      const [snapOrders, snapClients, snapProjects] = await Promise.all([getDocs(qOrders), getDocs(qClients), getDocs(qProjects)]);
      
      const existingOrders = snapOrders.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const existingClients = snapClients.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const existingProjects = snapProjects.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const result = await processUniversalInput(
        input, 
        existingOrders, 
        existingClients.map((c: any) => `Client: ${c.name}${c.aliases ? ` (Aliase: ${c.aliases.join(', ')})` : ''}, Info: ${c.telefon || ''} ${c.email || ''} ${c.insights || ''}`).join('\n'),
        existingProjects.map((p: any) => `Project: ${p.name}, Info: ${p.description || ''}`).join('\n'),
        userSettings
      ); 
      
      if (onAiResponse) onAiResponse(result.text_response);

      if (result.intent === 'query') {
        if (onQuery && result.query_data) {
           onQuery(result.query_data, result.text_response);
           setInput("");
        }
        setIsProcessing(false);
        return;
      }

      if (result.intent === 'crm_update') {
        await upsertClient(result.client_data, user.uid);
        setInput("");
        setIsProcessing(false);
        return;
      }

      if (result.intent === 'delete_record' || result.intent === 'merge_clients' || result.intent === 'mark_completed') {
        if (result.intent === 'mark_completed') {
            const searchField = 'title';
            const q = query(collection(db, "orders"), where("userId", "==", user!.uid), where(searchField, "==", result.action_data?.primary_name), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                await updateDoc(snap.docs[0].ref, { status: 'completed', updatedAt: serverTimestamp() });
                toast.success(`"${result.action_data?.primary_name}" wurde als erledigt markiert!`);
                setInput("");
                onOrderCreated();
                setIsProcessing(false);
                return;
            }
        }
        setPendingAction({
            intent: result.intent,
            data: result.action_data
        });
        if (onAiResponse) onAiResponse(result.text_response);
        setIsProcessing(false);
        return;
      }

      if (result.intent === 'create') {
        const clientId = await upsertClient(result.client_data, user.uid);
        const projectId = await upsertProject(result.project_data, user.uid);
        
        if (result.create_data && Array.isArray(result.create_data) && result.create_data.length > 0) {
          const duplicates = result.create_data.filter((d: any) => d.duplicate_check?.is_potential_duplicate);
          const novel = result.create_data.filter((d: any) => !d.duplicate_check?.is_potential_duplicate);

          for (const orderData of novel) {
            await executeCreateOrder(rawInputToOrderData(orderData, input, user.uid, clientId, projectId, result));
          }

          if (duplicates.length > 0) {
            const firstDup = duplicates[0];
            setDuplicateCheck({
              isDuplicate: true,
              reason: firstDup.duplicate_check.reason,
              similarOrderId: firstDup.duplicate_check.similarOrderId
            });
            setPendingOrder({ input, existingOrders, structuredData: firstDup, clientId, projectId, result });
            setIsProcessing(false);
            return;
          }
        } else {
          // No specific tasks to create, but maybe client/project were handled
          toast.success(result.text_response || "Daten verarbeitet.");
          onOrderCreated();
        }

        setInput("");
        setIsProcessing(false);
        return;
      }

    } catch (error: any) {
      console.error("AI Unified Processing Error:", error);
      toast.error(`KI Fehler: ${error?.message || "Unbekannt"}`);
      setIsProcessing(false);
    }
  };

  const rawInputToOrderData = (create_data: any, originalInput: string, userId: string, clientId: string | null, projectId: string | null, result: any) => {
     return {
        type: create_data.type,
        title: create_data.title,
        clientId: clientId,
        clientName: create_data.clientName || result.client_data?.name || "",
        projectId: projectId,
        projectName: create_data.projectName || result.project_data?.name || "",
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
    <div className="bento-gradient h-full flex flex-col justify-between overflow-hidden">
      <div>
        <h3 className="text-accent-400 font-semibold mb-1 uppercase text-xs tracking-wider">Schnellerfassung</h3>
        <p className="text-2xl font-light text-slate-900 dark:text-white mb-6">Wie kann ich helfen?</p>
      </div>
      
      <div className="relative group">
        <Textarea
          placeholder="z.B. Sprachnotizen, Chat-Auszüge oder direkte Texte..."
          value={input}
          onChange={(e) => { setInput(e.target.value); setWasVoiceInput(false); }}
          className="min-h-[160px] bg-slate-50/40 dark:bg-slate-950/40 border-slate-300/50 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-600 rounded-2xl md:resize-y resize-none pr-12 focus:ring-accent-500/20 focus:border-accent-500/30 transition-all"
        />
        <div className="absolute right-3 top-3">
          <div className={cn(
             "w-2 h-2 rounded-full transition-all duration-500",
             isListening ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-accent-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
          )} />
        </div>
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
              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 hover:text-slate-800 dark:text-slate-200"
          )}
        >
          {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isProcessing || !input.trim()}
          className={cn(
            "flex-1 h-12 rounded-xl font-bold gap-3 transition-all",
            input.trim().length > 0
              ? "bg-accent-500 hover:bg-accent-400 text-slate-950"
              : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          )}
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

      {/* Dubletten-Check Dialog */}
      <AlertDialog open={!!duplicateCheck} onOpenChange={() => { setDuplicateCheck(null); setPendingOrder(null); }}>
        <AlertDialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Dubletten-Check
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed pt-2">
              <div className="p-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 italic text-xs text-slate-600 dark:text-slate-300">
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
              className="w-full bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-bold h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Bestehenden Auftrag aktualisieren
            </Button>
            
            <Button 
              onClick={async () => {
                if (pendingOrder) {
                  setDuplicateCheck(null);
                  await executeCreateOrder(rawInputToOrderData(pendingOrder.structuredData, pendingOrder.input, user!.uid, pendingOrder.clientId, pendingOrder.projectId || null, pendingOrder.result));
                }
              }}
              className="w-full bg-accent-600 hover:bg-accent-500 text-slate-900 dark:text-white font-bold h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Neu anlegen (Separater Eintrag)
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                setDuplicateCheck(null);
                setPendingOrder(null);
              }}
              className="w-full bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 h-11 rounded-xl text-xs uppercase tracking-tight"
            >
              Vorgang abbrechen
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Sicherheitsabfrage
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed pt-2">
              {pendingAction?.intent === 'delete_record' 
                ? `Möchtest du den ${pendingAction?.data.target_type === 'order' ? 'Auftrag' : 'Kunden'} "${pendingAction?.data.primary_name}" wirklich unwiderruflich löschen?`
                : `Möchtest du "${pendingAction?.data.secondary_name}" wirklich in "${pendingAction?.data.primary_name}" mergen?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} className="text-slate-500 dark:text-slate-400 bg-transparent border-slate-300 dark:border-slate-700 hover:bg-white dark:bg-slate-800">Abbrechen</Button>
            <Button 
                onClick={async () => {
                    setIsProcessing(true);
                    try {
                        const { intent, data } = pendingAction;
                        const collectionName = data.target_type === 'order' ? 'orders' : 'clients';
                        
                        // Finde primary
                        const searchField = data.target_type === 'order' ? 'title' : 'name';
                        const qPrimary = query(collection(db, collectionName), where("userId", "==", user!.uid), where(searchField, "==", data.primary_name), limit(1));
                        const snapPrimary = await getDocs(qPrimary);
                        
                        if (snapPrimary.empty) throw new Error("Primärer Eintrag nicht gefunden.");
                        const primaryDoc = snapPrimary.docs[0];

                        if (intent === 'delete_record') {
                            await deleteDoc(primaryDoc.ref);
                            toast.success("Eintrag gelöscht!");
                        } else if (intent === 'merge_clients') {
                            const qSecondary = query(collection(db, "clients"), where("userId", "==", user!.uid), where("name", "==", data.secondary_name), limit(1));
                            const snapSecondary = await getDocs(qSecondary);
                            
                            if (snapSecondary.empty) throw new Error("Sekundärer Kunde nicht gefunden.");                
                            const secondaryDoc = snapSecondary.docs[0];
                            
                            // Reassign orders
                            const qOrders = query(collection(db, "orders"), where("userId", "==", user!.uid), where("clientId", "==", secondaryDoc.id));
                            const snapOrders = await getDocs(qOrders);
                            
                            const batch = writeBatch(db);
                            snapOrders.docs.forEach(doc => batch.update(doc.ref, { 
                                clientId: primaryDoc.id, 
                                clientName: data.primary_name,
                                updatedAt: serverTimestamp()
                            }));
                            
                            const primaryData = primaryDoc.data();
                            const newAliases = [...(primaryData.aliases || []), data.secondary_name];
                            batch.update(primaryDoc.ref, { 
                                aliases: newAliases,
                                updatedAt: serverTimestamp() 
                            });

                            batch.delete(secondaryDoc.ref);
                            await batch.commit();
                            
                            toast.success("Kunden erfolgreich zusammengeführt!");
                        }
                        
                        setInput("");
                        onOrderCreated();
                        setPendingAction(null);
                        if (onAiResponse) onAiResponse('');
                    } catch (e: any) {
                        toast.error(`Fehler: ${e.message}`);
                    } finally {
                        setIsProcessing(false);
                    }
                }}
                className="bg-red-600 hover:bg-red-500 text-slate-900 dark:text-white font-bold"
            >
              Ja, ausführen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
