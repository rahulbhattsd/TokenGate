import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  token: string | null;
  setTokens: (token: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setTokens: (token) => {
    set({ token });
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    set({ token: null });
  }
}));
