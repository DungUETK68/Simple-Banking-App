import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuthStore } from '../stores/authStore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response: any = await axiosClient.post('/auth/login', { email, password });
            setAuth(response.data.accessToken, response.data.refreshToken, response.data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đã có lỗi xảy ra khi đăng nhập');
        } finally {
            setIsLoading(false);
        }
    }
    return (
        <div className="auth-container">
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Đăng nhập vào tài khoản của bạn</p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label>Email</label>
                    <input
                        type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nhap@email.com"
                    />
                </div>
                <div className="input-group">
                    <label>Mật khẩu</label>
                    <input
                        type="password" required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                </div>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? 'Đang xử lý...' : 'Đăng Nhập'}
                </button>
            </form>
            <Link to="/register" className="auth-link">
                Chưa có tài khoản? <span>Đăng ký ngay</span>
            </Link>
        </div>);
}

export default Login;