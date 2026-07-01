import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class TransactionsService {
    constructor(private dataSource: DataSource) { }

    async transfer(userId: string, transferDto: TransferDto) {
        const { fromAccountNumber, toAccountNumber, amount, description, idempotencyKey } = transferDto;

        if (fromAccountNumber === toAccountNumber) {
            throw new BadRequestException('Bạn không thể tự chuyển tiền cho chính mình.');
        }

        const existingTx = await this.dataSource.manager.findOne(Transaction, { where: { idempotencyKey } });
        if (existingTx) {
            throw new BadRequestException('Giao dịch này đã được xử lý.');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const fromAccount = await queryRunner.manager.findOne(Account, {
                where: {
                    accountNumber: fromAccountNumber,
                    user: { id: userId }
                },
                lock: { mode: 'pessimistic_write' } // typeorm khoa khong cho request khac truy cap
            });

            if (!fromAccount) {
                throw new NotFoundException('Không tìm thấy tài khoản nguồn.');
            }

            const toAccount = await queryRunner.manager.findOne(Account, {
                where: { accountNumber: toAccountNumber },
                lock: { mode: 'pessimistic_write' }
            });

            if (!toAccount) {
                throw new NotFoundException('Tài khoản người nhận không tồn tại.');
            }

            const currentBalance = Number(fromAccount.balance);
            if (currentBalance < amount) {
                throw new BadRequestException('Số dư tài khoản không đủ để thực hiện giao dịch.');
            }

            // chuyen tien
            fromAccount.balance = currentBalance - amount;
            await queryRunner.manager.save(fromAccount);

            toAccount.balance = Number(toAccount.balance) + amount;
            await queryRunner.manager.save(toAccount);

            // luu giao dich
            const transaction = new Transaction();

            transaction.amount = amount;
            transaction.idempotencyKey = idempotencyKey;
            transaction.type = TransactionType.TRANSFER;
            transaction.status = TransactionStatus.SUCCESS;
            transaction.description = description || 'Chuyển khoản';
            transaction.fromAccount = fromAccount;
            transaction.toAccount = toAccount;

            const savedTransaction = await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return {
                message: 'Chuyển khoản thành công.',
                data: {
                    transactionId: savedTransaction.id,
                    newBalance: fromAccount.balance
                }
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new InternalServerErrorException('Giao dịch thất bại do lỗi hệ thống.');
        } finally {
            await queryRunner.release();
        }
    }

    async getTransactions(userId: string, accountNumber: string, page: number = 1, limit: number = 10) {
        const account = await this.dataSource.manager.findOne(Account, {
            where: {
                accountNumber: accountNumber,
                user: { id: userId }
            }
        });

        if (!account) {
            throw new NotFoundException('Tài khoản không tồn tại hoặc không thuộc quyền sở hữu của bạn.');
        }

        const [transactions, total] = await this.dataSource.manager.findAndCount(Transaction, {
            where: [
                { fromAccount: { id: account.id } },
                { toAccount: { id: account.id } }
            ],
            relations: { fromAccount: true, toAccount: true }, // join de lay account number
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit, // so ban ghi bo qua
            take: limit
        });

        const formattedData = transactions.map(tx => {
            const isMoneyOut = tx.fromAccount?.id === account.id;

            return {
                id: tx.id,
                amount: tx.amount,
                type: isMoneyOut ? 'EXPENSE' : 'INCOME',
                status: tx.status,
                description: tx.description,
                createdAt: tx.createdAt,
                fromAccount: tx.fromAccount?.accountNumber,
                toAccount: tx.toAccount?.accountNumber
            };
        });

        return {
            data: formattedData,
            total,
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            limit: Number(limit)
        };
    }
}