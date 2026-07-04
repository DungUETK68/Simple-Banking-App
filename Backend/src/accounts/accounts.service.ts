import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Account } from 'src/entities/account.entity';

@Injectable()
export class AccountsService {
    constructor(private dataSource: DataSource) { }

    async getMyProfileAndBalance(userId: string) {
        const user = await this.dataSource.manager.findOne(User, {
            where: { id: userId },
            relations: { accounts: true }, // join accounts
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy dữ liệu người dùng');
        }

        return {
            message: 'Lấy thông tin tài khoản thành công',
            data: {
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                },
                // lay account dau tien (duy nhat)
                account: user.accounts[0] ? {
                    accountId: user.accounts[0].id,
                    accountNumber: user.accounts[0].accountNumber,
                    balance: Number(user.accounts[0].balance),
                    currency: user.accounts[0].currency,
                } : null
            }
        };
    }

    async getAccountOwnerName(accountNumber: string) {
        const account = await this.dataSource.manager.findOne(Account, {
            where: { accountNumber },
            relations: { user: true }
        });

        if (!account) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        return { fullName: account.user.fullName };
    }
}
