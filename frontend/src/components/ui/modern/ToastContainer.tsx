import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}> = ({ children, position = 'top-right' }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`fixed z-[9999] flex flex-col space-y-3 pointer-events-none ${
        position === 'top-right' ? 'top-6 right-6' :
        position === 'top-left' ? 'top-6 left-6' :
        position === 'bottom-right' ? 'bottom-6 right-6' :
        'bottom-6 left-6'
      }`}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto min-w-[260px] max-w-xs px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3
                ${
                  toast.type === "success"
                    ? "bg-gradient-to-r from-green-500/90 to-emerald-600/90 text-white"
                    : toast.type === "error"
                    ? "bg-gradient-to-r from-red-500/90 to-pink-600/90 text-white"
                    : "bg-gradient-to-r from-blue-500/90 to-purple-600/90 text-white"
                }
              `}
            >
              <span>
                {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
                {toast.type === "error" && <AlertCircle className="w-5 h-5" />}
                {toast.type === "info" && <Info className="w-5 h-5" />}
              </span>
              <span className="flex-1">{toast.message}</span>
              <button
                className="ml-2 text-white/70 hover:text-white transition-colors pointer-events-auto"
                onClick={() => removeToast(toast.id)}
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// Export par défaut pour la compatibilité
export default ToastProvider;