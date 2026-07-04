import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Wallet, CreditCard, Mail, User, Copy, Check } from 'lucide-react';
import '../styles/dashboard.css';

const Dashboard = () => {
    const [accountData, setAccountData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const response: any = await axiosClient.get('/accounts/me');
                setAccountData(response.data);
            } catch (error) {
                console.error("Lỗi khi tải thông tin tài khoản:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccount();
    }, []);

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '100px', fontWeight: 'bold' }}>Đang tải dữ liệu...</div>;
    }
    if (!accountData || !accountData.account) {
        return <div className="error-message">Chưa có tài khoản ngân hàng nào được liên kết.</div>;
    }

    const { user, account } = accountData;
    const formattedBalance = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(account.balance);

    const handleCopy = () => {
        navigator.clipboard.writeText(accountData.account.accountNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="dashboard-container">
            <h1 className="welcome-text">Xin chào, <span>{user.fullName}</span> 👋</h1>
            <div className="cards-grid">
                <div className="balance-card">
                    <div className="balance-label">
                        <Wallet size={18} />
                        Số dư khả dụng
                    </div>
                    <div className="balance-amount">{formattedBalance}</div>

                    <div className="account-info-box">
                        <div>
                            <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>SỐ TÀI KHOẢN</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>{account.accountNumber}</span>
                                <button
                                    onClick={handleCopy}
                                    style={{ background: 'none', border: 'none', color: copied ? '#10b981' : 'white', cursor: 'pointer', padding: 0 }}
                                    title="Copy số tài khoản"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>LOẠI TIỀN</div>
                            <span>{account.currency}</span>
                        </div>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-item">
                        <div className="info-icon"><User size={24} /></div>
                        <div className="info-text">
                            <p>Chủ tài khoản</p>
                            <h4>{user.fullName}</h4>
                        </div>
                    </div>

                    <div className="info-item">
                        <div className="info-icon"><Mail size={24} /></div>
                        <div className="info-text">
                            <p>Email đăng ký</p>
                            <h4>{user.email}</h4>
                        </div>
                    </div>

                    <div className="info-item">
                        <div className="info-icon"><CreditCard size={24} /></div>
                        <div className="info-text">
                            <p>Trạng thái thẻ</p>
                            <h4 style={{ color: '#10b981' }}>Đang hoạt động</h4>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;