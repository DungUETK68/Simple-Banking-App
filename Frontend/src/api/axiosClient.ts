import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const axiosClient = axios.create({
    baseURL: 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// truoc khi gui request
axiosClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

let isRefreshing = false;

// sau khi nhan response
axiosClient.interceptors.response.use((response) => {
    return response.data;
}, async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        originalRequest.url !== '/auth/login' &&
        originalRequest.url !== '/auth/register'
    ) { // loi token va chua thu lai
        originalRequest._retry = true; // da thu
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                const { refreshToken, user } = useAuthStore.getState();

                if (!refreshToken || !user) {
                    throw new Error('Không có refresh token');
                }

                const { data } = await axios.post('http://localhost:3000/auth/refresh', {
                    userId: user.id,
                    refreshToken: refreshToken
                });

                useAuthStore.getState().setAuth(data.data.accessToken, data.data.refreshToken, user);
                isRefreshing = false;

                originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
                return axiosClient(originalRequest);

            } catch (refreshError) {
                isRefreshing = false;
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
    }
    return Promise.reject(error);
});

export default axiosClient;
