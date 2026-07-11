import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Send, History, LogOut, Wallet, Users, BookOpen, Activity, Settings, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import '../styles/layout.css';

const MainLayout = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="main-layout">
            <aside className="sidebar">
                <div className="brand">
                    <Wallet size={32} color="var(--primary-color)" />
                    <span>TD Bank</span>
                </div>
                <nav className="nav-links">
                    <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        Thông tin tài khoản
                    </NavLink>
                    <NavLink to="/transfer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Send size={20} />
                        Chuyển tiền
                    </NavLink>
                    <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <History size={20} />
                        Lịch sử giao dịch
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        Cài đặt tài khoản
                    </NavLink>
                    {user?.role === 'teller' && (
                        <NavLink to="/teller/transfer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Send size={20} />
                            Tạo giao dịch
                        </NavLink>
                    )}
                    {user?.role === 'admin' && (
                        <>
                            <NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <Users size={20} />
                                Quản lý người dùng
                            </NavLink>
                            <NavLink to="/admin/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <Activity size={20} />
                                Giao dịch hệ thống
                            </NavLink>
                            <NavLink to="/admin/ledger" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <BookOpen size={20} />
                                Sổ cái kép
                            </NavLink>
                            <NavLink to="/admin/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <ShieldAlert size={20} />
                                Nhật ký hệ thống
                            </NavLink>
                        </>
                    )}
                </nav>
                <div className="logout-btn" onClick={handleLogout}>
                    <LogOut size={20} />
                    <span>Đăng xuất</span>
                </div>
            </aside>
            <div className="content-wrapper">
                <header className="top-header">
                    <div className="user-profile">
                        <div className="avatar">{user?.fullName?.charAt(0).toUpperCase() || 'U'}</div>
                        <span>{user?.fullName || 'Khách hàng'}</span>
                    </div>
                </header>
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;