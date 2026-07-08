import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Lock, Unlock } from 'lucide-react';
import '../styles/admin.css';

const Admin = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const fetchUsers = async () => {
        try {
            const response: any = await axiosClient.get('/admin/users');
            setUsers(response.data);
        } catch (error) {
            console.error("Lỗi khi tải danh sách:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleOpenModal = (user: any) => {
        setSelectedUser(user);
        setShowConfirmModal(true);
    };

    const confirmToggleStatus = async () => {
        if (!selectedUser) return;
        const newStatus = selectedUser.status === 'active' ? 'locked' : 'active';

        try {
            await axiosClient.patch(`/admin/users/${selectedUser.id}/status`, { status: newStatus });
            setShowConfirmModal(false);
            fetchUsers();
        } catch (error) {
            alert('Có lỗi xảy ra!');
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '100px' }}>Đang tải dữ liệu...</div>;
    }

    return (
        <div className="admin-container">
            <h1 className="page-title">Quản trị hệ thống</h1>
            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>HỌ VÀ TÊN</th>
                            <th>EMAIL</th>
                            <th>VAI TRÒ</th>
                            <th>TRẠNG THÁI</th>
                            <th>THAO TÁC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.fullName}</td>
                                <td>{user.email}</td>
                                <td>
                                    {user.role === 'admin' ?
                                        <span className="role-badge">Admin</span> :
                                        <span style={{ opacity: 0.6, fontSize: '13px' }}>Khách hàng</span>
                                    }
                                </td>
                                <td>
                                    <span className={`status-badge ${user.status === 'active' ? 'status-active' : 'status-locked'}`}>
                                        {user.status === 'active' ? 'Đang hoạt động' : 'Bị khóa'}
                                    </span>
                                </td>
                                <td>
                                    {user.role !== 'admin' && (
                                        <button
                                            onClick={() => handleOpenModal(user)}
                                            className={`action-btn ${user.status === 'active' ? 'btn-lock' : 'btn-unlock'}`}
                                        >
                                            {user.status === 'active' ? (
                                                <><Lock size={16} /> Khóa tài khoản</>
                                            ) : (
                                                <><Unlock size={16} /> Mở khóa</>
                                            )}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showConfirmModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginTop: 0 }}>Xác nhận thao tác</h3>
                        <p>
                            Bạn có chắc chắn muốn <strong style={{ color: selectedUser.status === 'active' ? '#ef4444' : '#10b981', fontSize: '16px' }}>
                                {selectedUser.status === 'active' ? 'Khóa' : 'Mở khóa'}
                            </strong> tài khoản này không?
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            {selectedUser.status === 'active'
                                ? 'Người dùng sẽ bị văng ra ngoài và không thể đăng nhập lại.'
                                : 'Người dùng sẽ có thể đăng nhập và giao dịch bình thường.'}
                        </p>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowConfirmModal(false)}>
                                Hủy bỏ
                            </button>
                            <button
                                className="modal-btn confirm"
                                onClick={confirmToggleStatus}
                                style={{ backgroundColor: selectedUser.status === 'active' ? '#ef4444' : '#10b981' }}
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Admin;