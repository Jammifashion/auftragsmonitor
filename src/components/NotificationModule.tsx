import React, { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../AuthContext";
import { Bell, CalendarClock, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { differenceInHours, isPast, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function NotificationModule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Request browser notification permission if not yet granted

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // We only care about pending or in_progress tasks
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allActive = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.deadline);
      
      const newNotifications: any[] = [];
      let newUnreadCount = 0;

      allActive.forEach(order => {
        if (order.deadline) {
          const deadlineDate = parseISO(order.deadline);
          const hoursLeft = differenceInHours(deadlineDate, new Date());
          const overdue = isPast(deadlineDate);

          let type = null;
          let urgencyLevel = 0;

          if (overdue) {
            type = 'overdue';
            urgencyLevel = 2; // highest
          } else if (hoursLeft <= 24) {
            type = 'upcoming';
            urgencyLevel = 1; // warning
          }

          if (type) {
            newNotifications.push({
              id: order.id,
              order,
              type,
              urgencyLevel,
              hoursLeft
            });
            newUnreadCount++;
          }
        }
      });

      // Sort by urgency, then by closest deadline
      newNotifications.sort((a, b) => {
        if (b.urgencyLevel !== a.urgencyLevel) {
          return b.urgencyLevel - a.urgencyLevel;
        }
        return a.hoursLeft - b.hoursLeft;
      });

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.length);

      // Trigger automatic toasts/system notifications for new ones
      newNotifications.forEach(notif => {
        if (!notifiedIds.has(notif.id)) {
          triggerNotificationAlert(notif);
          setNotifiedIds(prev => new Set(prev).add(notif.id));
        }
      });
    }, (err) => {
      console.error("Notifications listener error", err);
    });

    return () => unsubscribe();
  }, [user, notifiedIds]);

  // Periodic check for tasks that just crossed the 24h or overdue threshold while the app is open
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => {
        const nextList = [...prev];
        let changed = false;

        nextList.forEach((notif, index) => {
          if (notif.order.deadline) {
            const deadlineDate = parseISO(notif.order.deadline);
            const hoursLeft = differenceInHours(deadlineDate, new Date());
            const overdue = isPast(deadlineDate);

            let newType = null;
            let newUrgency = 0;

            if (overdue) {
              newType = 'overdue';
              newUrgency = 2;
            } else if (hoursLeft <= 24) {
              newType = 'upcoming';
              newUrgency = 1;
            }

            if (newType && newType !== notif.type) {
              nextList[index] = { ...notif, type: newType, urgencyLevel: newUrgency, hoursLeft };
              triggerNotificationAlert(nextList[index]);
              changed = true;
            }
          }
        });

        if (changed) {
          nextList.sort((a, b) => {
            if (b.urgencyLevel !== a.urgencyLevel) {
              return b.urgencyLevel - a.urgencyLevel;
            }
            return a.hoursLeft - b.hoursLeft;
          });
          return nextList;
        }
        return prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const triggerNotificationAlert = (notif: any) => {
    // 1. Toast Notification
    const title = notif.type === 'overdue' ? `Überfällig: ${notif.order.title}` : `Bald fällig: ${notif.order.title}`;
    const desc = notif.order.structured_details?.kern_aufgabe 
      || notif.order.structured_details?.naechster_schritt 
      || notif.order.description 
      || "Bitte überprüfen Sie diese Aufgabe.";

    const toastOptions = {
      description: desc,
      action: {
        label: 'Anzeigen',
        onClick: () => navigate("/orders", { state: { openOrderId: notif.id } })
      }
    };

    if (notif.type === 'overdue') {
      toast.error(title, toastOptions);
    } else {
      toast.warning(title, toastOptions);
    }

    // 2. Native Browser Notification (if allowed and app is in background or we just want to push it)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: desc,
        icon: "/vite.svg" // fallback icon mapping
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 ml-1 md:ml-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white dark:bg-slate-800 rounded-full transition-colors outline-none cursor-pointer focus:ring-2 focus:ring-accent-500"
      >
        <Bell className="w-5 h-5 md:w-6 md:h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full border-2 border-slate-50 dark:border-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-xl z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm tracking-wide text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent-500" />
              Erinnerungen ({unreadCount})
            </h3>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                Aktion erforderlich
              </span>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-8 h-8 mb-3 text-emerald-500/50" />
                <p className="text-sm font-medium">Alles im grünen Bereich!</p>
                <p className="text-xs mt-1 opacity-70">Keine anstehenden oder überfälligen Aufgaben.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/orders", { state: { openOrderId: notif.id } });
                  }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    notif.type === 'overdue' 
                      ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10" 
                      : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {notif.type === 'overdue' ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CalendarClock className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-bold uppercase tracking-widest mb-1",
                      notif.type === 'overdue' ? "text-red-500" : "text-amber-500"
                    )}>
                      {notif.type === 'overdue' ? 'Überfällig' : 'Fällig in < 24h'}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mb-1">
                      {notif.order.title}
                    </p>
                    {notif.order.structured_details?.kern_aufgabe && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">
                         <span className="font-semibold text-slate-800 dark:text-slate-200">Ziel:</span> {notif.order.structured_details.kern_aufgabe}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[10px] font-mono text-slate-500 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                         Deadline: {new Date(notif.order.deadline).toLocaleString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
