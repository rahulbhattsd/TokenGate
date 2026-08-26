import { create } from 'zustand';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  setTokens: (token: string | null, refreshToken: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  setTokens: (token, refreshToken) => {
    if (token && refreshToken) {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
    }
    set({ token, refreshToken });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ token: null, refreshToken: null });
  }
}));
