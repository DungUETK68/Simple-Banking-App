import { Injectable, HttpException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { TransferDto } from './dto/transfer.dto';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';

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
            const isFromFirst = fromAccountNumber < toAccountNumber;
            let fromAccount: Account | null, toAccount: Account | null;

            if (isFromFirst) {
                fromAccount = await queryRunner.manager.findOne(Account, {
                    where: { accountNumber: fromAccountNumber, user: { id: userId } },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!fromAccount) throw new NotFoundException('Không tìm thấy tài khoản nguồn.');

                toAccount = await queryRunner.manager.findOne(Account, {
                    where: { accountNumber: toAccountNumber },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!toAccount) throw new NotFoundException('Tài khoản người nhận không tồn tại.');
            } else {
                toAccount = await queryRunner.manager.findOne(Account, {
                    where: { accountNumber: toAccountNumber },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!toAccount) throw new NotFoundException('Tài khoản người nhận không tồn tại.');

                fromAccount = await queryRunner.manager.findOne(Account, {
                    where: { accountNumber: fromAccountNumber, user: { id: userId } },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!fromAccount) throw new NotFoundException('Không tìm thấy tài khoản nguồn.');
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

            // but toan tru tien nguoi gui
            const debitEntry = new LedgerEntry();
            debitEntry.account = fromAccount;
            debitEntry.transaction = savedTransaction;
            debitEntry.type = LedgerEntryType.DEBIT;
            debitEntry.amount = amount;
            debitEntry.balanceAfter = fromAccount.balance;
            await queryRunner.manager.save(debitEntry);

            // but toan cong tien nguoi nhan
            const creditEntry = new LedgerEntry();
            creditEntry.account = toAccount;
            creditEntry.transaction = savedTransaction;
            creditEntry.type = LedgerEntryType.CREDIT;
            creditEntry.amount = amount;
            creditEntry.balanceAfter = toAccount.balance;
            await queryRunner.manager.save(creditEntry);

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

    async reverseTransaction(transactionId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Lấy thông tin giao dịch (KHÔNG LOCK) để biết ai là người gửi/nhận
            const txInfo = await queryRunner.manager.createQueryBuilder(Transaction, 'tx')
                .innerJoinAndSelect('tx.fromAccount', 'fromAccount')
                .innerJoinAndSelect('tx.toAccount', 'toAccount')
                .where('tx.id = :id', { id: transactionId })
                .getOne();

            if (!txInfo) {
                throw new NotFoundException('Không tìm thấy giao dịch gốc.');
            }

            // 2. CHỐNG DEADLOCK: Khóa Tài khoản theo đúng thứ tự như khi chuyển tiền
            const isFromFirst = txInfo.fromAccount.accountNumber < txInfo.toAccount.accountNumber;
            let originalSender: Account | null, originalReceiver: Account | null;

            if (isFromFirst) {
                originalSender = await queryRunner.manager.findOne(Account, { where: { id: txInfo.fromAccount.id }, lock: { mode: 'pessimistic_write' } });
                originalReceiver = await queryRunner.manager.findOne(Account, { where: { id: txInfo.toAccount.id }, lock: { mode: 'pessimistic_write' } });
            } else {
                originalReceiver = await queryRunner.manager.findOne(Account, { where: { id: txInfo.toAccount.id }, lock: { mode: 'pessimistic_write' } });
                originalSender = await queryRunner.manager.findOne(Account, { where: { id: txInfo.fromAccount.id }, lock: { mode: 'pessimistic_write' } });
            }

            if (!originalSender || !originalReceiver) {
                throw new NotFoundException('Tài khoản không tồn tại hoặc đã bị xóa.');
            }

            // 3. Khóa Giao dịch (Transaction) sau khi đã cầm chắc 2 khóa của Tài khoản
            const originalTx = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!originalTx) {
                throw new NotFoundException('Không tìm thấy giao dịch gốc.');
            }

            if (originalTx.status === TransactionStatus.REVERSED) {
                throw new BadRequestException('Giao dịch này đã được hoàn tiền rồi.');
            }
            if (originalTx.status !== TransactionStatus.SUCCESS) {
                throw new BadRequestException('Chỉ có thể hoàn tiền giao dịch thành công.');
            }
            if (originalTx.type === TransactionType.REVERSAL) {
                throw new BadRequestException('Không thể hoàn lại giao dịch hoàn tiền.');
            }

            if (Number(originalReceiver.balance) < Number(originalTx.amount)) {
                throw new BadRequestException('Người nhận không đủ số dư để hoàn lại!');
            }

            originalReceiver.balance = Number(originalReceiver.balance) - Number(originalTx.amount);
            originalSender.balance = Number(originalSender.balance) + Number(originalTx.amount);
            await queryRunner.manager.save(originalReceiver);
            await queryRunner.manager.save(originalSender);

            // tao giao dich
            const reversalTx = new Transaction();
            reversalTx.amount = originalTx.amount;
            reversalTx.type = TransactionType.REVERSAL;
            reversalTx.status = TransactionStatus.SUCCESS;
            reversalTx.description = `Hoàn tiền cho giao dịch (Mã: ${originalTx.id})`;
            reversalTx.fromAccount = originalReceiver;
            reversalTx.toAccount = originalSender;
            reversalTx.originalTransaction = originalTx;
            const savedReversalTx = await queryRunner.manager.save(reversalTx);

            // ghi vao so cai
            const debitEntry = new LedgerEntry();
            debitEntry.account = originalReceiver;
            debitEntry.transaction = savedReversalTx;
            debitEntry.type = LedgerEntryType.DEBIT;
            debitEntry.amount = originalTx.amount;
            debitEntry.balanceAfter = originalReceiver.balance;
            await queryRunner.manager.save(debitEntry);

            const creditEntry = new LedgerEntry();
            creditEntry.account = originalSender;
            creditEntry.transaction = savedReversalTx;
            creditEntry.type = LedgerEntryType.CREDIT;
            creditEntry.amount = originalTx.amount;
            creditEntry.balanceAfter = originalSender.balance;
            await queryRunner.manager.save(creditEntry);

            // doi trang thai giao dich goc
            originalTx.status = TransactionStatus.REVERSED;
            await queryRunner.manager.save(originalTx);

            await queryRunner.commitTransaction();

            return {
                message: 'Hoàn tiền thành công!',
                data: {
                    reversalTransactionId: savedReversalTx.id
                }
            };
        } catch (error) {
            console.error('LỖI KHI HOÀN TIỀN:', error);
            await queryRunner.rollbackTransaction();
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('Lỗi hệ thống khi hoàn tiền.');
        } finally {
            await queryRunner.release();
        }
    }

    async getTransactions(userId: string, accountNumber: string, page: number = 1, limit: number = 10,
        filters?: { type?: string; minAmount?: number; maxAmount?: number; startDate?: string; endDate?: string }
    ) {
        const account = await this.dataSource.manager.findOne(Account, {
            where: {
                accountNumber: accountNumber,
                user: { id: userId }
            }
        });

        if (!account) {
            throw new NotFoundException('Tài khoản không tồn tại hoặc không thuộc quyền sở hữu của bạn.');
        }

        const queryBuilder = this.dataSource.manager.createQueryBuilder(Transaction, 'tx')
            .leftJoinAndSelect('tx.fromAccount', 'fromAccount')
            .leftJoinAndSelect('tx.toAccount', 'toAccount');

        // loai giao dich
        if (filters?.type === 'INCOME') {
            queryBuilder.andWhere('toAccount.id = :accountId', { accountId: account.id });
        } else if (filters?.type === 'EXPENSE') {
            queryBuilder.andWhere('fromAccount.id = :accountId', { accountId: account.id });
        } else {
            queryBuilder.andWhere('(fromAccount.id = :accountId OR toAccount.id = :accountId)', { accountId: account.id });
        }

        // khoang tien
        if (filters?.minAmount) {
            queryBuilder.andWhere('tx.amount >= :minAmount', { minAmount: filters.minAmount });
        }
        if (filters?.maxAmount) {
            queryBuilder.andWhere('tx.amount <= :maxAmount', { maxAmount: filters.maxAmount });
        }

        // khoang ngay
        if (filters?.startDate) {
            queryBuilder.andWhere('tx.createdAt >= :startDate', { startDate: new Date(filters.startDate) });
        }
        if (filters?.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('tx.createdAt <= :endDate', { endDate: end });
        }

        queryBuilder.orderBy('tx.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

        const [transactions, total] = await queryBuilder.getManyAndCount();

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
            items: formattedData,
            meta: {
                total,
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                limit: Number(limit)
            }
        };
    }
}