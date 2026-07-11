import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Lock, Unlock, Clock, Info } from 'lucide-react';
import '../styles/admin.css';

const Admin = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // History Modal States
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [userHistory, setUserHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedUserForHistory, setSelectedUserForHistory] = useState<any>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [filters, setFilters] = useState({ name: '', email: '', role: '', status: '' })

    const fetchUsers = async (currentPage: number) => {
        setLoading(true);
        try {
            let url = `/admin/users?page=${currentPage}&limit=10`;
            if (filters.name) url += `&name=${filters.name}`;
            if (filters.email) url += `&email=${filters.email}`;
            if (filters.role) url += `&role=${filters.role}`;
            if (filters.status) url += `&status=${filters.status}`;

            const response: any = await axiosClient.get(url);
            setUsers(response.data.items);
            setMeta(response.data.meta);
        } catch (error) {
            console.error("Lỗi khi tải danh sách:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenHistoryModal = async (user: any) => {
        setSelectedUserForHistory(user);
        setIsHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const response: any = await axiosClient.get(`/admin/users/${user.id}/history`);
            setUserHistory(response.data);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi tải lịch sử.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    useEffect(() => {
        fetchUsers(1);
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
            fetchUsers(page);
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
            <div className="filter-toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input
                    type="text" placeholder="Tìm tên..." value={filters.name}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <input
                    type="text" placeholder="Tìm email..." value={filters.email}
                    onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} style={{ padding: '8px', borderRadius: '8px' }}>
                    <option value="">Tất cả Vai trò</option>
                    <option value="customer">Khách hàng</option>
                    <option value="admin">Quản trị viên</option>
                </select>
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ padding: '8px', borderRadius: '8px' }}>
                    <option value="">Tất cả Trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="locked">Đã khóa</option>
                </select>
                <button
                    onClick={() => { setPage(1); fetchUsers(1); }}
                    style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    Áp dụng
                </button>
            </div>
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
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {user.role !== 'admin' && (
                                            <button
                                                onClick={() => handleOpenModal(user)}
                                                className={`action-btn ${user.status === 'active' ? 'btn-lock' : 'btn-unlock'}`}
                                                style={{ flex: 1 }}
                                            >
                                                {user.status === 'active' ? (
                                                    <><Lock size={16} /> Khóa tài khoản</>
                                                ) : (
                                                    <><Unlock size={16} /> Mở khóa</>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenHistoryModal(user)}
                                            className="action-btn btn-unlock"
                                            style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', flex: 1 }}
                                        >
                                            <Clock size={16} /> Lịch sử
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {meta && meta.totalPages > 1 && (
                    <div className="pagination">
                        <button className="page-btn" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchUsers(page - 1); }}>Trang trước</button>
                        <span className="page-info">Trang {meta.currentPage} / {meta.totalPages}</span>
                        <button className="page-btn" disabled={page >= meta.totalPages} onClick={() => { setPage(page + 1); fetchUsers(page + 1); }}>Trang sau</button>
                    </div>
                )}
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
                                className="modal-btn confirm-btn"
                                onClick={confirmToggleStatus}
                                style={{ backgroundColor: selectedUser.status === 'active' ? '#ef4444' : '#10b981' }}
                            >
                                Xác nhận {selectedUser.status === 'active' ? 'khóa' : 'mở khóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lịch sử thay đổi */}
            {isHistoryModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={24} color="#3b82f6" />
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Lịch sử thay đổi thông tin</h2>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
                            Hiển thị các lần thay đổi Email và Số điện thoại của tài khoản: <strong>{selectedUserForHistory?.fullName}</strong>
                        </p>

                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Đang tải dữ liệu...</div>
                            ) : userHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>
                                    <Info size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                                    Người dùng này chưa từng thay đổi thông tin nhạy cảm.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {userHistory.map((item, index) => (
                                        <div key={item.id} style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                                                Lần {userHistory.length - index}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                                                <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                Thay đổi lúc: <strong>{formatDate(item.changedAt)}</strong>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                                <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Dữ liệu bị ghi đè</div>
                                                    <div style={{ fontSize: '13px' }}>
                                                        <div><span style={{ color: '#64748b' }}>Email:</span> {item.oldEmail || 'N/A'}</div>
                                                        <div><span style={{ color: '#64748b' }}>Phone:</span> {item.oldPhoneNumber || 'N/A'}</div>
                                                    </div>
                                                </div>
                                                <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                                    <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Dữ liệu mới</div>
                                                    <div style={{ fontSize: '13px', color: '#166534' }}>
                                                        {(() => {
                                                            const newData = index === 0
                                                                ? { email: userHistory[0]?.user?.email || selectedUserForHistory?.email, phone: userHistory[0]?.user?.phoneNumber || selectedUserForHistory?.phoneNumber }
                                                                : { email: userHistory[index - 1].oldEmail, phone: userHistory[index - 1].oldPhoneNumber };
                                                            return (
                                                                <>
                                                                    <div><span style={{ color: '#15803d' }}>Email:</span> {newData.email || 'N/A'}</div>
                                                                    <div><span style={{ color: '#15803d' }}>Phone:</span> {newData.phone || 'N/A'}</div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button className="modal-btn cancel" onClick={() => setIsHistoryModalOpen(false)}>
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Admin;