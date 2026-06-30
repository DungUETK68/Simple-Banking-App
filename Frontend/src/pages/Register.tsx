import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const Register = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await axiosClient.post('/auth/register', { fullName, email, password });
            navigate('/login');
        } catch (err: any) {
            const message = err.response?.data?.message;
            setError(Array.isArray(message) ? message[0] : message || 'Lỗi đăng ký');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">Mở tài khoản ngân hàng chỉ trong 1 phút</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label>Họ và Tên</label>
                    <input
                        type="text" required value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                    />
                </div>
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
                        type="password" required minLength={6} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                    />
                </div>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? 'Đang tạo...' : 'Đăng Ký'}
                </button>
            </form>

            <Link to="/login" className="auth-link">
                Đã có tài khoản? <span>Đăng nhập</span>
            </Link>
        </div>
    );
};

export default Register;
