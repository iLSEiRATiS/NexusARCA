import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

interface PrivacyContextType {
  isManagementUnlocked: boolean;
  isPinModalOpen: boolean;
  unlockWithPin: (pin: string) => boolean;
  lockManagement: () => void;
  openPinModal: () => void;
  closePinModal: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const STORAGE_KEY = 'nexus_mgmt_mode_unlocked';
const SECRET_PIN = '1991';

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isManagementUnlocked, setIsManagementUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const unlockWithPin = (pin: string): boolean => {
    if (pin.trim() === SECRET_PIN) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsManagementUnlocked(true);
      setIsPinModalOpen(false);
      toast.success('Modo Gestión Comercial habilitado');
      return true;
    } else {
      toast.error('Clave gerencial incorrecta');
      return false;
    }
  };

  const lockManagement = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsManagementUnlocked(false);
    toast.info('Modo Fiscal Oficial activado (Vista protegida)');
  };

  const openPinModal = () => setIsPinModalOpen(true);
  const closePinModal = () => setIsPinModalOpen(false);

  // Atajos de teclado:
  // - Esc: Bloqueo rápido de pánico a Modo Fiscal
  // - Ctrl + Shift + G: Abrir diálogo de PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si presiona Ctrl + Shift + G (o Ctrl + Alt + G)
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        if (isManagementUnlocked) {
          lockManagement();
        } else {
          openPinModal();
        }
      }

      // Si está desbloqueado y presiona Esc fuera de formularios o modales interactivos
      if (e.key === 'Escape' && isManagementUnlocked && !isPinModalOpen) {
        const activeElement = document.activeElement;
        const isInput = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
        if (!isInput) {
          lockManagement();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManagementUnlocked, isPinModalOpen]);

  return (
    <PrivacyContext.Provider
      value={{
        isManagementUnlocked,
        isPinModalOpen,
        unlockWithPin,
        lockManagement,
        openPinModal,
        closePinModal,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
