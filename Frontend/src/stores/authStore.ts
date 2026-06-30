import { create } from "zustand";

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: any | null;
    setAuth: (accessToken: string, refreshToken: string, user: any) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    // khoi tao ban dau khi f5
    accessToken: localStorage.getItem('accessToken') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    // dang nhap thanh cong
    setAuth: (accessToken, refreshToken, user) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        set({ accessToken, refreshToken, user });
    },
    // dang xuat
    logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        set({ accessToken: null, refreshToken: null, user: null });
    },
}));