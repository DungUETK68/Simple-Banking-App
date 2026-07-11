import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Send } from 'lucide-react';
import '../styles/transfer.css';

const TellerTransfer = () => {
    const [formData, setFormData] = useState({
        fromAccountNumber: '',
        toAccountNumber: '',
        amount: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [pendingMessage, setPendingMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [senderName, setSenderName] = useState('');
    const [receiverName, setReceiverName] = useState('');
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const fetchSenderName = async () => {
            if (formData.fromAccountNumber.length < 10) {
                setSenderName('');
                return;
            }

            try {
                const response: any = await axiosClient.get(`/accounts/info/${formData.fromAccountNumber}`);
                setSenderName(response.data.fullName);
            } catch (error) {
                setSenderName('Không tìm thấy tài khoản hợp lệ');
            }
        };

        const timeoutId = setTimeout(() => { fetchSenderName(); }, 500);
        return () => clearTimeout(timeoutId);
    }, [formData.fromAccountNumber]);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setFormData({ ...formData, amount: rawValue });
    };

    const formatDisplayAmount = (val: string) => {
        if (!val) return '';
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
            setErrorMessage('Không thể chuyển tiền cho chính tài khoản gửi.');
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

            const payload = {
                ...formData,
                amount,
                idempotencyKey
            };

            const response: any = await axiosClient.post('/transactions/transfer', payload);
            
            if (amount >= 100000000) {
                setPendingMessage(response.data?.message || 'Giao dịch đang chờ duyệt.');
                setTimeout(() => setPendingMessage(''), 5000);
            } else {
                setSuccessMessage(response.data?.message || 'Chuyển khoản thành công!');
                setTimeout(() => setSuccessMessage(''), 5000);
            }

            // Clear form
            setFormData({
                fromAccountNumber: '',
                toAccountNumber: '',
                amount: '',
                description: ''
            });
            setSenderName('');
            setReceiverName('');

        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || 'Có lỗi xảy ra trong quá trình xử lý giao dịch.');
            setTimeout(() => setErrorMessage(''), 4000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="transfer-container">
            <div className="transfer-card">
                <div className="transfer-header">
                    <Send size={28} />
                    <h2>Tạo Giao Dịch Cho Khách Hàng</h2>
                </div>

                {successMessage && (
                    <div className="toast-message success">
                        ✅ {successMessage}
                    </div>
                )}
                {pendingMessage && (
                    <div className="toast-message" style={{ backgroundColor: '#f59e0b', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}>
                        ⏳ {pendingMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="toast-message error">
                        ❌ {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="transfer-form">
                    <div className="form-group">
                        <label>Số tài khoản người gửi</label>
                        <input
                            type="text"
                            name="fromAccountNumber"
                            placeholder="Nhập số tài khoản người gửi..."
                            value={formData.fromAccountNumber}
                            onChange={handleChange}
                            className="form-control"
                            required
                        />
                        {senderName && (
                            <div className={`receiver-name ${senderName === 'Không tìm thấy tài khoản hợp lệ' ? 'invalid' : ''}`}>
                                <span>Người gửi:</span> {senderName}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Số tài khoản người nhận</label>
                        <input
                            type="text"
                            name="toAccountNumber"
                            placeholder="Nhập số tài khoản người nhận..."
                            value={formData.toAccountNumber}
                            onChange={handleChange}
                            className="form-control"
                            required
                        />
                        {receiverName && (
                            <div className={`receiver-name ${receiverName === 'Không tìm thấy tài khoản hợp lệ' ? 'invalid' : ''}`}>
                                <span>Người nhận:</span> {receiverName}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Số tiền chuyển (VND)</label>
                        <div className="amount-input-wrapper">
                            <input
                                type="text"
                                value={formatDisplayAmount(formData.amount)}
                                onChange={handleAmountChange}
                                placeholder="0"
                                className="form-control"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Nội dung chuyển khoản (Tùy chọn)</label>
                        <input
                            type="text"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Nhập lời nhắn..."
                            className="form-control"
                            maxLength={255}
                        />
                    </div>

                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading || receiverName === 'Không tìm thấy tài khoản hợp lệ' || senderName === 'Không tìm thấy tài khoản hợp lệ'}
                    >
                        {loading ? 'Đang xử lý...' : (
                            <>
                                <Send size={18} />
                                Tạo giao dịch
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Confirmation Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Xác nhận giao dịch</h3>
                        <div className="confirm-details">
                            <div className="detail-row">
                                <span>Người gửi:</span>
                                <strong>{senderName} ({formData.fromAccountNumber})</strong>
                            </div>
                            <div className="detail-row">
                                <span>Người nhận:</span>
                                <strong>{receiverName} ({formData.toAccountNumber})</strong>
                            </div>
                            <div className="detail-row">
                                <span>Số tiền:</span>
                                <strong className="amount-highlight">
                                    {formatDisplayAmount(formData.amount)} VND
                                </strong>
                            </div>
                            <div className="detail-row">
                                <span>Lời nhắn:</span>
                                <strong>{formData.description || 'Không có'}</strong>
                            </div>
                        </div>
                        {Number(formData.amount) >= 100000000 && (
                            <p style={{ marginTop: '15px', color: '#b91c1c', fontSize: '13px' }}>
                                * Giao dịch này có giá trị từ 100 triệu trở lên, sẽ được chuyển vào trạng thái CHỜ DUYỆT bởi Admin.
                            </p>
                        )}
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowModal(false)} disabled={loading}>Hủy</button>
                            <button className="modal-btn confirm" onClick={confirmTransfer} disabled={loading}>Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TellerTransfer;
