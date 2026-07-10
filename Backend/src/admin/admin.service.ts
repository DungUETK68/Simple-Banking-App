import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { UserHistory } from '../entities/user-history.entity';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class AdminService {
    constructor(private dataSource: DataSource) { }

    async getAllUsers(page: number, limit: number, filters: any) {
        const queryBuilder = this.dataSource.manager.createQueryBuilder(User, 'user')
            .select(['user.id', 'user.fullName', 'user.email', 'user.role', 'user.status', 'user.createdAt']);

        if (filters.name) {
            queryBuilder.andWhere('user.fullName ILIKE :name', { name: `%${filters.name}%` });
        }
        if (filters.email) {
            queryBuilder.andWhere('user.email ILIKE :email', { email: `%${filters.email}%` });
        }
        if (filters.role) {
            queryBuilder.andWhere('user.role = :role', { role: filters.role });
        }
        if (filters.status) {
            queryBuilder.andWhere('user.status = :status', { status: filters.status });
        }

        queryBuilder.orderBy('user.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

        const [users, total] = await queryBuilder.getManyAndCount();

        return {
            message: 'Lấy danh sách người dùng thành công',
            data: {
                items: users,
                meta: {
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    limit
                }
            }
        };
    }

    async updateUserStatus(userId: string, newStatus: UserStatus) {
        const user = await this.dataSource.manager.findOne(User, { where: { id: userId } });

        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng');
        }

        user.status = newStatus;
        await this.dataSource.manager.save(user);

        return {
            message: `Tài khoản đã được ${newStatus === UserStatus.ACTIVE ? 'mở khóa' : 'khóa'} thành công`,
            data: {
                id: user.id,
                status: user.status
            }
        };
    }
    async getLedgerEntries(page: number, limit: number, filters: any) {
        const queryBuilder = this.dataSource.manager.createQueryBuilder(LedgerEntry, 'ledger')
            .leftJoinAndSelect('ledger.account', 'account')
            .leftJoinAndSelect('ledger.transaction', 'transaction');

        if (filters.accountId) {
            queryBuilder.andWhere('account.id = :accountId', { accountId: filters.accountId });
        }
        if (filters.accountNumber) {
            queryBuilder.andWhere('account.accountNumber = :accountNumber', { accountNumber: filters.accountNumber });
        }
        if (filters.transactionId) {
            queryBuilder.andWhere('transaction.id = :transactionId', { transactionId: filters.transactionId });
        }
        if (filters.type) {
            queryBuilder.andWhere('ledger.type = :type', { type: filters.type });
        }

        queryBuilder.orderBy('ledger.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

        const [entries, total] = await queryBuilder.getManyAndCount();

        return {
            message: 'Lấy danh sách bút toán thành công',
            data: {
                items: entries,
                meta: {
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    limit
                }
            }
        };
    }

    async getUserHistory(userId: string) {
        const history = await this.dataSource.manager.find(UserHistory, {
            where: { user: { id: userId } },
            order: { changedAt: 'DESC' },
            relations: { user: true },
        });

        if (!history || history.length === 0) {
            return {
                message: 'Người dùng này chưa từng cập nhật thông tin.',
                data: []
            };
        }

        return {
            message: 'Lấy lịch sử thay đổi thông tin thành công',
            data: history
        };
    }

    async getAllTransactions(page: number = 1, limit: number = 10, filters?: { type?: string; status?: string; transactionId?: string }) {
        const queryBuilder = this.dataSource.manager.createQueryBuilder(Transaction, 'tx')
            .leftJoinAndSelect('tx.fromAccount', 'fromAccount')
            .leftJoinAndSelect('fromAccount.user', 'fromUser')
            .leftJoinAndSelect('tx.toAccount', 'toAccount')
            .leftJoinAndSelect('toAccount.user', 'toUser');

        if (filters?.type) {
            queryBuilder.andWhere('tx.type = :type', { type: filters.type });
        }
        if (filters?.status) {
            queryBuilder.andWhere('tx.status = :status', { status: filters.status });
        }
        if (filters?.transactionId) {
            queryBuilder.andWhere('tx.id = :transactionId', { transactionId: filters.transactionId });
        }

        queryBuilder.orderBy('tx.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

        const [transactions, total] = await queryBuilder.getManyAndCount();

        const formattedData = transactions.map(tx => {
            return {
                id: tx.id,
                amount: tx.amount,
                type: tx.type,
                status: tx.status,
                description: tx.description,
                createdAt: tx.createdAt,
                fromAccount: tx.fromAccount?.accountNumber,
                fromUserName: tx.fromAccount?.user?.fullName,
                toAccount: tx.toAccount?.accountNumber,
                toUserName: tx.toAccount?.user?.fullName,
            };
        });

        return {
            message: 'Lấy danh sách giao dịch thành công',
            data: {
                items: formattedData,
                meta: {
                    total,
                    currentPage: Number(page),
                    totalPages: Math.ceil(total / limit),
                    limit: Number(limit)
                }
            }
        };
    }
}
