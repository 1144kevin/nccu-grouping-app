import { create } from 'zustand';

type NavigationState = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
