import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import '../styles/admin.css';

const AdminTransactions = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [filters, setFilters] = useState({ type: '', status: '', transactionId: '' });

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [isRefunding, setIsRefunding] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    const fetchTransactions = async (currentPage: number) => {
        setLoading(true);
        try {
            let url = `/admin/transactions?page=${currentPage}&limit=10`;
            if (filters.transactionId) url += `&transactionId=${filters.transactionId}`;
            if (filters.type) url += `&type=${filters.type}`;
            if (filters.status) url += `&status=${filters.status}`;

            const response: any = await axiosClient.get(url);
            setTransactions(response.data.items);
            setMeta(response.data.meta);
        } catch (error) {
            console.error("Lỗi khi tải danh sách giao dịch:", error);
            alert("Có lỗi xảy ra khi tải dữ liệu giao dịch");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions(1);
    }, []);

    const handleFilter = () => {
        setPage(1);
        fetchTransactions(1);
    };

    const handleRefund = async () => {
        if (!selectedTransaction) return;
        setIsRefunding(true);
        try {
            await axiosClient.post(`/transactions/${selectedTransaction.id}/reverse`);
            setShowConfirmModal(false);
            fetchTransactions(page); // Reload current page
        } catch (error: any) {
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi hoàn tiền');
        } finally {
            setIsRefunding(false);
            setSelectedTransaction(null);
        }
    };

    const handleApprove = async () => {
        if (!selectedTransaction) return;

        setIsApproving(true);
        try {
            await axiosClient.post(`/transactions/${selectedTransaction.id}/approve`);
            setShowApproveModal(false);
            fetchTransactions(page);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi duyệt giao dịch');
        } finally {
            setIsApproving(false);
            setSelectedTransaction(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return <span className="status-badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} style={{ marginRight: '4px', display: 'inline' }} /> Thành công</span>;
            case 'failed':
                return <span className="status-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}><XCircle size={12} style={{ marginRight: '4px', display: 'inline' }} /> Thất bại</span>;
            case 'pending':
                return <span className="status-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}><AlertCircle size={12} style={{ marginRight: '4px', display: 'inline' }} /> Đang xử lý</span>;
            case 'reversed':
                return <span className="status-badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}><RefreshCw size={12} style={{ marginRight: '4px', display: 'inline' }} /> Đã hoàn tiền</span>;
            default:
                return <span className="status-badge">{status}</span>;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'transfer': return 'Chuyển khoản';
            case 'deposit': return 'Nạp tiền';
            case 'reversal': return 'Hoàn tiền (Reversal)';
            default: return type;
        }
    };

    if (loading && transactions.length === 0) {
        return <div style={{ textAlign: 'center', marginTop: '100px' }}>Đang tải dữ liệu...</div>;
    }

    return (
        <div className="admin-container">
            <h1 className="page-title">Quản lý Giao dịch Hệ thống</h1>

            <div className="filter-toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Mã giao dịch..."
                    value={filters.transactionId}
                    onChange={(e) => setFilters({ ...filters, transactionId: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px' }}
                >
                    <option value="">Tất cả Loại</option>
                    <option value="transfer">Chuyển khoản</option>
                    <option value="deposit">Nạp tiền</option>
                    <option value="reversal">Hoàn tiền</option>
                </select>
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px' }}
                >
                    <option value="">Tất cả Trạng thái</option>
                    <option value="success">Thành công</option>
                    <option value="failed">Thất bại</option>
                    <option value="pending">Đang xử lý</option>
                    <option value="reversed">Đã hoàn tiền</option>
                </select>
                <button
                    onClick={handleFilter}
                    style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    Áp dụng
                </button>
            </div>

            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>MÃ GD & THỜI GIAN</th>
                            <th>NGƯỜI GỬI</th>
                            <th>NGƯỜI NHẬN</th>
                            <th>SỐ TIỀN & LOẠI</th>
                            <th>TRẠNG THÁI</th>
                            <th>THAO TÁC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((tx) => (
                            <tr key={tx.id}>
                                <td>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{tx.id}</div>
                                    <div style={{ fontSize: '13px' }}>{formatDate(tx.createdAt)}</div>
                                </td>
                                <td>
                                    {tx.fromAccount ? (
                                        <>
                                            <div style={{ fontWeight: '500' }}>{tx.fromUserName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{tx.fromAccount}</div>
                                        </>
                                    ) : '-'}
                                </td>
                                <td>
                                    {tx.toAccount ? (
                                        <>
                                            <div style={{ fontWeight: '500' }}>{tx.toUserName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{tx.toAccount}</div>
                                        </>
                                    ) : '-'}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 'bold', color: tx.type === 'reversal' ? '#4f46e5' : '#0f172a' }}>
                                        {formatCurrency(Number(tx.amount))}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{getTypeLabel(tx.type)}</div>
                                </td>
                                <td>
                                    {getStatusBadge(tx.status)}
                                </td>
                                <td>
                                    {tx.status === 'success' && tx.type === 'transfer' && (
                                        <button
                                            onClick={() => {
                                                setSelectedTransaction(tx);
                                                setShowConfirmModal(true);
                                            }}
                                            className="action-btn"
                                            style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}
                                        >
                                            <RefreshCw size={14} style={{ marginRight: '4px', display: 'inline' }} /> Hoàn tiền
                                        </button>
                                    )}
                                    {tx.status === 'pending' && (
                                        <button
                                            onClick={() => {
                                                setSelectedTransaction(tx);
                                                setShowApproveModal(true);
                                            }}
                                            disabled={isApproving}
                                            className="action-btn"
                                            style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', marginLeft: '5px' }}
                                        >
                                            <CheckCircle2 size={14} style={{ marginRight: '4px', display: 'inline' }} />
                                            Duyệt
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                    Không có dữ liệu giao dịch.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {meta && meta.totalPages > 1 && (
                    <div className="pagination">
                        <button className="page-btn" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchTransactions(page - 1); }}>Trang trước</button>
                        <span className="page-info">Trang {meta.currentPage} / {meta.totalPages}</span>
                        <button className="page-btn" disabled={page >= meta.totalPages} onClick={() => { setPage(page + 1); fetchTransactions(page + 1); }}>Trang sau</button>
                    </div>
                )}
            </div>

            {/* Confirm Refund Modal */}
            {showConfirmModal && selectedTransaction && (
                <div className="modal-overlay">
                    <div className="modal-content confirm-modal">
                        <h2>Xác nhận hoàn tiền</h2>
                        <div style={{ margin: '20px 0', lineHeight: '1.5', color: '#334155' }}>
                            <p>Bạn có chắc chắn muốn hoàn tiền cho giao dịch này không?</p>
                            <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', marginTop: '15px' }}>
                                <div><strong>Mã GD:</strong> {selectedTransaction.id}</div>
                                <div><strong>Số tiền:</strong> {formatCurrency(Number(selectedTransaction.amount))}</div>
                                <div><strong>Người gửi:</strong> {selectedTransaction.fromUserName} ({selectedTransaction.fromAccount})</div>
                                <div><strong>Người nhận:</strong> {selectedTransaction.toUserName} ({selectedTransaction.toAccount})</div>
                            </div>
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="btn-cancel"
                                onClick={() => { setShowConfirmModal(false); setSelectedTransaction(null); }}
                                disabled={isRefunding}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleRefund}
                                disabled={isRefunding}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer' }}
                            >
                                {isRefunding ? 'Đang xử lý...' : 'Xác nhận Hoàn tiền'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Approve Modal */}
            {showApproveModal && selectedTransaction && (
                <div className="modal-overlay">
                    <div className="modal-content confirm-modal">
                        <h2>Xác nhận duyệt giao dịch</h2>
                        <div style={{ margin: '20px 0', lineHeight: '1.5', color: '#334155' }}>
                            <p>Bạn có chắc chắn muốn duyệt giao dịch này không?</p>
                            <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', marginTop: '15px' }}>
                                <div><strong>Mã GD:</strong> {selectedTransaction.id}</div>
                                <div><strong>Số tiền:</strong> {formatCurrency(Number(selectedTransaction.amount))}</div>
                                <div><strong>Người gửi:</strong> {selectedTransaction.fromUserName} ({selectedTransaction.fromAccount})</div>
                                <div><strong>Người nhận:</strong> {selectedTransaction.toUserName} ({selectedTransaction.toAccount})</div>
                            </div>
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="btn-cancel"
                                onClick={() => { setShowApproveModal(false); setSelectedTransaction(null); }}
                                disabled={isApproving}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleApprove}
                                disabled={isApproving}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                            >
                                {isApproving ? 'Đang xử lý...' : 'Xác nhận Duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTransactions;
