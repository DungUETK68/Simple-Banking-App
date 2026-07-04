import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Send } from 'lucide-react';
import '../styles/transfer.css';

const Transfer = () => {
    const [account, setAccount] = useState<any>(null);
    const [formData, setFormData] = useState({
        fromAccountNumber: '',
        toAccountNumber: '',
        amount: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [receiverName, setReceiverName] = useState('');
    const [showModal, setShowModal] = useState(false);

    // tai danh sach account
    useEffect(() => {
        const fetchMyAccount = async () => {
            try {
                const response: any = await axiosClient.get('/accounts/me');

                if (response.data && response.data.account) {
                    setAccount(response.data.account);
                    setFormData(prev => ({ ...prev, fromAccountNumber: response.data.account.accountNumber }));
                }
            } catch (error) {
                console.error("Lỗi lấy thông tin tài khoản", error);
            }
        };

        fetchMyAccount();
    }, []);

    useEffect(() => {
        const fetchReceiverName = async () => {
            if (formData.toAccountNumber.length < 10) {
                setReceiverName('');
                return;
            }

            try {
                const response: any = await axiosClient.get(`/accounts/info/${formData.toAccountNumber}`);
                setReceiverName(response.data.fullName);
            } catch (error) {
                setReceiverName('Không tìm thấy tài khoản hợp lệ');
            }
        };

        const timeoutId = setTimeout(() => { fetchReceiverName(); }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.toAccountNumber]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // xoa ky tu khong phai so
        const rawValue = e.target.value.replace(/\D/g, '');
        setFormData({ ...formData, amount: rawValue });
    };

    const formatDisplayAmount = (val: string) => {
        if (!val) return '';
        // ngat hang nghin
        return new Intl.NumberFormat('en-US').format(Number(val));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        const amount = Number(formData.amount);
        if (amount <= 0) {
            setErrorMessage('Số tiền phải lớn hơn 0.');
            return;
        }

        if (formData.fromAccountNumber === formData.toAccountNumber) {
            setErrorMessage('Không thể chuyển tiền cho chính tài khoản của bạn.');
            return;
        }

        setShowModal(true);
    };

    const confirmTransfer = async () => {
        setShowModal(false);
        setLoading(true);

        try {
            const idempotencyKey = crypto.randomUUID();
            const amount = Number(formData.amount);

            await axiosClient.post('/transactions/transfer', {
                fromAccountNumber: formData.fromAccountNumber,
                toAccountNumber: formData.toAccountNumber,
                amount: amount,
                description: formData.description,
                idempotencyKey: idempotencyKey
            });

            setSuccessMessage('Giao dịch thành công!');
            setTimeout(() => setSuccessMessage(''), 4000);
            // xoa form
            setFormData(prev => ({ ...prev, toAccountNumber: '', amount: '', description: '' }));

            // tai lai so du
            const accountResponse: any = await axiosClient.get('/accounts/me');
            if (accountResponse.data && accountResponse.data.account) {
                setAccount(accountResponse.data.account);
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Giao dịch thất bại, vui lòng thử lại.');
            setTimeout(() => setErrorMessage(''), 4000);
        } finally {
            setLoading(false);
        }
    }

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

    return (
        <div className="transfer-container">
            <div className="transfer-card">
                <div className="transfer-header">
                    <Send size={28} />
                    <h2>Chuyển tiền</h2>
                </div>
                {successMessage && (
                    <div className="toast-message success">
                        ✅ {successMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="toast-message error">
                        ⚠️ {errorMessage}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Tài khoản nguồn</label>
                        <select
                            name="fromAccountNumber"
                            className="form-control"
                            value={formData.fromAccountNumber}
                            onChange={handleChange}
                            required
                        >
                            <option value="" disabled>-- Chọn tài khoản --</option>
                            {account && (
                                <option value={account.accountNumber}>
                                    {account.accountNumber}
                                </option>
                            )}
                        </select>
                        {account && (
                            <div className="balance-hint">
                                <span>Số dư khả dụng:</span>
                                <span>
                                    {formatMoney(account.balance)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Số tài khoản người nhận</label>
                        <input
                            type="text"
                            name="toAccountNumber"
                            className="form-control"
                            placeholder="Nhập số tài khoản đích..."
                            value={formData.toAccountNumber}
                            onChange={handleChange}
                            required
                        />
                        {receiverName && (
                            <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold', color: receiverName.includes('Không tìm thấy') ? '#ef4444' : '#10b981' }}>
                                Người nhận: {receiverName}
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Số tiền chuyển (VND)</label>
                        <input
                            type="text"
                            name="amount"
                            className="form-control"
                            placeholder="Ví dụ: 50000"
                            value={formatDisplayAmount(formData.amount)}
                            onChange={handleAmountChange}
                            min="1"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Nội dung chuyển khoản (Tùy chọn)</label>
                        <input
                            type="text"
                            name="description"
                            className="form-control"
                            placeholder="Ví dụ: Tra tien cafe"
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </div>
                    <button type="submit" className="submit-btn" disabled={loading || !account}>
                        {loading ? 'Đang xử lý giao dịch...' : (
                            <><Send size={18} /> Chuyển khoản ngay</>
                        )}
                    </button>
                </form>

                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 style={{ marginTop: 0 }}>Xác nhận chuyển khoản</h3>
                            <p>
                                Bạn sắp chuyển số tiền <strong style={{ color: '#10b981', fontSize: '18px' }}>{formatDisplayAmount(formData.amount)} VND</strong>
                            </p>
                            <p>
                                Tới người nhận: <strong>{receiverName || formData.toAccountNumber}</strong>
                            </p>
                            <div className="modal-actions">
                                <button className="modal-btn cancel" onClick={() => setShowModal(false)}>
                                    Hủy bỏ
                                </button>
                                <button className="modal-btn confirm" onClick={confirmTransfer}>
                                    Xác nhận chuyển
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Transfer;