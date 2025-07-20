import { create } from 'zustand';

export type ModalStore = {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
};

export const useModalStore = create<ModalStore>((set) => ({
  showAuthModal: false,
  setShowAuthModal: (show: boolean) => set({ showAuthModal: show }),
}));
