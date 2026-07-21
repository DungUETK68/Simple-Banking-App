import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { LedgerEntry } from '../transactions/entities/ledger-entry.entity';
import { UserHistory } from '../users/entities/user-history.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Account } from '../accounts/entities/account.entity';

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
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await queryRunner.manager.findOne(User, { where: { id: userId } });

            if (!user) {
                throw new NotFoundException('Không tìm thấy người dùng');
            }

            user.status = newStatus;
            await queryRunner.manager.save(user);

            await queryRunner.commitTransaction();

            return {
                message: `Tài khoản đã được ${newStatus === UserStatus.ACTIVE ? 'mở khóa' : 'khóa'} thành công`,
                data: {
                    id: user.id,
                    status: user.status
                }
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async deleteUser(userId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await queryRunner.manager.findOne(User, {
                where: { id: userId },
                relations: { accounts: true }
            });

            if (!user) {
                throw new NotFoundException('Người dùng không tồn tại');
            }

            if (user.accounts && user.accounts.length > 0) {
                await queryRunner.manager.softRemove(user.accounts);
            }

            await queryRunner.manager.softRemove(user);

            await queryRunner.commitTransaction();

            return {
                message: 'Xóa tài khoản thành công'
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async testDeleteLedger() {
        const firstEntry = await this.dataSource.manager.findOne(LedgerEntry, { where: {} });
        if (!firstEntry) return 'Chưa có bút toán nào để test!';

        await this.dataSource.manager.remove(firstEntry);
        return 'Xóa thành công';
    }

    async getAuditLogs(page: number = 1, limit: number = 10) {
        const [logs, total] = await this.dataSource.manager.findAndCount(AuditLog, {
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit
        });

        const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const userIds = [...new Set([
            ...logs.map(log => log.actorId).filter(id => id && isUUID(id)),
            ...logs.map(log => log.entityId).filter(id => id && isUUID(id))
        ])];

        const users = userIds.length > 0 ? await this.dataSource.manager.find(User, {
            where: { id: In(userIds) },
            select: { id: true, fullName: true },
            withDeleted: true
        }) : [];

        const userMap = new Map(users.map(u => [u.id, u.fullName]));

        const formattedLogs = logs.map(log => {
            const actorName = log.actorId ? userMap.get(log.actorId) || 'Unknown User' : 'Hệ thống';
            const entityName = (log.entityName === 'User' && log.entityId) ? userMap.get(log.entityId) || 'Unknown User' : log.entityName;

            return {
                ...log,
                actorName,
                entityNameDisplay: entityName
            };
        });

        return {
            message: 'Lấy danh sách Audit Log thành công',
            data: {
                items: formattedLogs,
                meta: {
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    limit
                }
            }
        };
    }

    async getLedgerEntries(page: number, limit: number, filters: any) {
        const queryBuilder = this.dataSource.manager.createQueryBuilder(LedgerEntry, 'ledger')
            .withDeleted()
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
            .withDeleted()
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
