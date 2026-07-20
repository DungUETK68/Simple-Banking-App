import { Injectable, HttpException, BadRequestException, NotFoundException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { DataSource, In, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Account } from '../accounts/entities/account.entity';
import { Transaction, TransactionType, TransactionStatus } from './entities/transaction.entity';
import { TransferDto } from './dto/transfer.dto';
import { LedgerEntry, LedgerEntryType } from './entities/ledger-entry.entity';

@Injectable()
export class TransactionsService {
    constructor(private dataSource: DataSource) { }

    async transfer(userId: string, userRole: string, transferDto: TransferDto) {
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
                    where: userRole === 'customer' ? { accountNumber: fromAccountNumber, user: { id: userId } } : { accountNumber: fromAccountNumber },
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
                    where: userRole === 'customer' ? { accountNumber: fromAccountNumber, user: { id: userId } } : { accountNumber: fromAccountNumber },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!fromAccount) throw new NotFoundException('Không tìm thấy tài khoản nguồn.');
            }

            const currentBalance = Number(fromAccount.balance);
            if (currentBalance < amount) {
                throw new BadRequestException('Số dư tài khoản không đủ để thực hiện giao dịch.');
            }

            const DAILY_LIMIT = 200000000;
            const vnTimeOffset = 7 * 60 * 60 * 1000;
            const vnNow = new Date(Date.now() + vnTimeOffset);
            const startOfDayVn = new Date(vnNow);
            startOfDayVn.setUTCHours(0, 0, 0, 0);
            const startOfDayUtc = new Date(startOfDayVn.getTime() - vnTimeOffset);
            const endOfDayVn = new Date(vnNow);
            endOfDayVn.setUTCHours(23, 59, 59, 999);
            const endOfDayUtc = new Date(endOfDayVn.getTime() - vnTimeOffset);

            const { totalSent } = await queryRunner.manager
                .createQueryBuilder(Transaction, 'tx')
                .select('SUM(tx.amount)', 'totalSent')
                .where('tx.from_account_id = :accountId', { accountId: fromAccount.id })
                .andWhere('tx.created_at BETWEEN :start AND :end', { start: startOfDayUtc, end: endOfDayUtc })
                .andWhere('tx.status IN (:...statuses)', {
                    statuses: [TransactionStatus.SUCCESS, TransactionStatus.PENDING, TransactionStatus.PENDING_OTP]
                })
                .getRawOne();

            const totalSentToday = Number(totalSent) || 0;

            if (totalSentToday + amount > DAILY_LIMIT) {
                throw new BadRequestException(
                    `Giao dịch vượt quá hạn mức ${DAILY_LIMIT.toLocaleString('vi-VN')} VND/ngày. ` +
                    `Bạn đã giao dịch ${totalSentToday.toLocaleString('vi-VN')} VND trong hôm nay.`
                );
            }

            const LARGE_TX_LIMIT = 100000000;
            const isLargeTx = amount >= LARGE_TX_LIMIT && userRole === 'teller';
            const OTP_LIMIT = 10000000;
            const requiresOtp = amount >= OTP_LIMIT && userRole === 'customer';

            // luu giao dich
            const transaction = new Transaction();
            transaction.amount = amount;
            transaction.idempotencyKey = idempotencyKey;
            transaction.type = TransactionType.TRANSFER;
            transaction.description = description || 'Chuyển khoản';
            transaction.fromAccount = fromAccount;
            transaction.toAccount = toAccount;

            if (requiresOtp) {
                transaction.status = TransactionStatus.PENDING_OTP;
                const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6
                transaction.otpCode = otp;
                transaction.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
                const savedTransaction = await queryRunner.manager.save(transaction);

                console.log(`\n\n[OTP] 🔔 Mã OTP cho giao dịch chuyển ${amount}đ (ID: ${savedTransaction.id}) là: ${otp}\n\n`);

                await queryRunner.commitTransaction();
                return {
                    message: 'Vui lòng xác thực OTP để hoàn tất giao dịch.',
                    data: { transactionId: savedTransaction.id, requiresOtp: true }
                };
            }

            transaction.status = isLargeTx ? TransactionStatus.PENDING : TransactionStatus.SUCCESS;
            const savedTransaction = await queryRunner.manager.save(transaction);

            if (isLargeTx) {
                await queryRunner.commitTransaction();
                return {
                    message: 'Giao dịch có giá trị lớn, đang chờ Admin phê duyệt.',
                    data: { transactionId: savedTransaction.id }
                };
            }

            fromAccount.balance = currentBalance - amount;
            await queryRunner.manager.save(fromAccount);
            toAccount.balance = Number(toAccount.balance) + amount;
            await queryRunner.manager.save(toAccount);

            const debitEntry = new LedgerEntry();
            debitEntry.account = fromAccount;
            debitEntry.transaction = savedTransaction;
            debitEntry.type = LedgerEntryType.DEBIT;
            debitEntry.amount = amount;
            debitEntry.balanceAfter = fromAccount.balance;
            await queryRunner.manager.save(debitEntry);

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

    async verifyOtp(userId: string, transactionId: string, otp: string, userRole: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedTx = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId, status: TransactionStatus.PENDING_OTP },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedTx) {
                throw new NotFoundException('Không tìm thấy giao dịch chờ OTP hợp lệ.');
            }

            const transaction = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId },
                relations: { fromAccount: { user: true }, toAccount: true }
            });

            if (!transaction) {
                throw new NotFoundException('Không tìm thấy giao dịch chờ OTP hợp lệ.');
            }

            transaction.status = lockedTx.status;
            transaction.otpCode = lockedTx.otpCode;
            transaction.otpExpiresAt = lockedTx.otpExpiresAt;
            transaction.otpAttempts = lockedTx.otpAttempts;
            transaction.amount = lockedTx.amount;

            if (userRole === 'customer' && transaction.fromAccount.user.id !== userId) {
                throw new UnauthorizedException('Bạn không có quyền xác thực giao dịch này.');
            }

            if (transaction.otpExpiresAt && transaction.otpExpiresAt < new Date()) {
                transaction.status = TransactionStatus.FAILED;
                transaction.description = 'Hủy do OTP hết hạn';
                await queryRunner.manager.save(transaction);
                await queryRunner.commitTransaction();
                throw new BadRequestException('Mã OTP đã hết hạn. Giao dịch bị hủy.');
            }

            if (transaction.otpCode !== otp) {
                transaction.otpAttempts += 1;
                if (transaction.otpAttempts >= 3) {
                    transaction.status = TransactionStatus.FAILED;
                    transaction.description = 'Hủy do nhập sai OTP quá 3 lần';
                    await queryRunner.manager.save(transaction);
                    await queryRunner.commitTransaction();
                    throw new BadRequestException('Giao dịch đã bị hủy do nhập sai mã OTP quá 3 lần.');
                }
                await queryRunner.manager.save(transaction);
                await queryRunner.commitTransaction();
                throw new BadRequestException(`Mã OTP không đúng. Bạn còn ${3 - transaction.otpAttempts} lần thử.`);
            }

            const isFromFirst = transaction.fromAccount.accountNumber < transaction.toAccount.accountNumber;
            let fromAccount: Account | null, toAccount: Account | null;

            if (isFromFirst) {
                fromAccount = await queryRunner.manager.findOne(Account, {
                    where: { id: transaction.fromAccount.id }, lock: { mode: 'pessimistic_write' }
                });
                toAccount = await queryRunner.manager.findOne(Account, {
                    where: { id: transaction.toAccount.id }, lock: { mode: 'pessimistic_write' }
                });
            } else {
                toAccount = await queryRunner.manager.findOne(Account, {
                    where: { id: transaction.toAccount.id }, lock: { mode: 'pessimistic_write' }
                });
                fromAccount = await queryRunner.manager.findOne(Account, {
                    where: { id: transaction.fromAccount.id }, lock: { mode: 'pessimistic_write' }
                });
            }

            if (!fromAccount || !toAccount) {
                throw new NotFoundException('Tài khoản không tồn tại.');
            }

            const currentBalance = Number(fromAccount.balance);
            const amount = Number(transaction.amount);
            if (currentBalance < amount) {
                transaction.status = TransactionStatus.FAILED;
                transaction.description = 'Hủy do số dư không đủ tại thời điểm xác thực';
                await queryRunner.manager.save(transaction);
                await queryRunner.commitTransaction();
                throw new BadRequestException('Số dư tài khoản không đủ để thực hiện giao dịch.');
            }

            fromAccount.balance = currentBalance - amount;
            await queryRunner.manager.save(fromAccount);
            toAccount.balance = Number(toAccount.balance) + amount;
            await queryRunner.manager.save(toAccount);

            const debitEntry = new LedgerEntry();
            debitEntry.account = fromAccount;
            debitEntry.transaction = transaction;
            debitEntry.type = LedgerEntryType.DEBIT;
            debitEntry.amount = amount;
            debitEntry.balanceAfter = fromAccount.balance;
            await queryRunner.manager.save(debitEntry);

            const creditEntry = new LedgerEntry();
            creditEntry.account = toAccount;
            creditEntry.transaction = transaction;
            creditEntry.type = LedgerEntryType.CREDIT;
            creditEntry.amount = amount;
            creditEntry.balanceAfter = toAccount.balance;
            await queryRunner.manager.save(creditEntry);

            transaction.otpCode = null;
            transaction.otpExpiresAt = null;
            transaction.status = TransactionStatus.SUCCESS;
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return {
                message: 'Chuyển khoản thành công.',
                data: {
                    transactionId: transaction.id,
                    newBalance: fromAccount.balance
                }
            };

        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            console.error("verifyOtp error: ", error);
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
                throw error;
            }
            throw new InternalServerErrorException('Lỗi hệ thống khi xác thực OTP.');
        } finally {
            await queryRunner.release();
        }
    }

    async cancelTransaction(userId: string, transactionId: string, userRole: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedTx = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId, status: TransactionStatus.PENDING_OTP },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedTx) {
                throw new NotFoundException('Không tìm thấy giao dịch chờ OTP hợp lệ.');
            }

            const transaction = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId },
                relations: { fromAccount: { user: true } }
            });

            if (!transaction) {
                throw new NotFoundException('Không tìm thấy giao dịch chờ OTP hợp lệ.');
            }

            if (userRole === 'customer' && transaction.fromAccount.user.id !== userId) {
                throw new UnauthorizedException('Bạn không có quyền hủy giao dịch này.');
            }

            transaction.status = TransactionStatus.FAILED;
            transaction.description = 'Hủy do người dùng từ chối';
            await queryRunner.manager.save(transaction);
            await queryRunner.commitTransaction();

            return { message: 'Đã hủy giao dịch thành công.' };
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            if (error instanceof NotFoundException || error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Có lỗi xảy ra khi hủy giao dịch.');
        } finally {
            await queryRunner.release();
        }
    }

    async approveLargeTransaction(transactionId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedTx = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId, status: TransactionStatus.PENDING },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedTx) {
                throw new NotFoundException('Không tìm thấy giao dịch PENDING.');
            }

            const transaction = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId },
                relations: { fromAccount: true, toAccount: true }
            });

            if (!transaction) {
                throw new NotFoundException('Không tìm thấy chi tiết giao dịch.');
            }

            const { fromAccount, toAccount, amount } = transaction;

            const isFromFirst = fromAccount.accountNumber < toAccount.accountNumber;
            if (isFromFirst) {
                await queryRunner.manager.findOne(Account, { where: { id: fromAccount.id }, lock: { mode: 'pessimistic_write' } });
                await queryRunner.manager.findOne(Account, { where: { id: toAccount.id }, lock: { mode: 'pessimistic_write' } });
            } else {
                await queryRunner.manager.findOne(Account, { where: { id: toAccount.id }, lock: { mode: 'pessimistic_write' } });
                await queryRunner.manager.findOne(Account, { where: { id: fromAccount.id }, lock: { mode: 'pessimistic_write' } });
            }

            const currentBalance = Number(fromAccount.balance);
            if (currentBalance < Number(amount)) {
                throw new BadRequestException('Tài khoản người gửi không đủ số dư để duyệt giao dịch này.');
            }

            fromAccount.balance = currentBalance - Number(amount);
            await queryRunner.manager.save(fromAccount);

            toAccount.balance = Number(toAccount.balance) + Number(amount);
            await queryRunner.manager.save(toAccount);

            const debitEntry = new LedgerEntry();
            debitEntry.account = fromAccount;
            debitEntry.transaction = transaction;
            debitEntry.type = LedgerEntryType.DEBIT;
            debitEntry.amount = amount;
            debitEntry.balanceAfter = fromAccount.balance;
            await queryRunner.manager.save(debitEntry);

            const creditEntry = new LedgerEntry();
            creditEntry.account = toAccount;
            creditEntry.transaction = transaction;
            creditEntry.type = LedgerEntryType.CREDIT;
            creditEntry.amount = amount;
            creditEntry.balanceAfter = toAccount.balance;
            await queryRunner.manager.save(creditEntry);

            transaction.status = TransactionStatus.SUCCESS;
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return {
                message: 'Phê duyệt giao dịch thành công!',
                data: { transactionId: transaction.id }
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async rejectLargeTransaction(transactionId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedTx = await queryRunner.manager.findOne(Transaction, {
                where: { id: transactionId, status: TransactionStatus.PENDING },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedTx) {
                throw new NotFoundException('Không tìm thấy giao dịch PENDING.');
            }

            lockedTx.status = TransactionStatus.FAILED;
            lockedTx.description = (lockedTx.description ? lockedTx.description + ' - ' : '') + 'Bị từ chối bởi Admin';
            await queryRunner.manager.save(lockedTx);

            await queryRunner.commitTransaction();

            return {
                message: 'Từ chối giao dịch thành công!',
                data: { transactionId: lockedTx.id }
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async reverseTransaction(transactionId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const txInfo = await queryRunner.manager.createQueryBuilder(Transaction, 'tx')
                .innerJoinAndSelect('tx.fromAccount', 'fromAccount')
                .innerJoinAndSelect('tx.toAccount', 'toAccount')
                .where('tx.id = :id', { id: transactionId })
                .getOne();

            if (!txInfo) {
                throw new NotFoundException('Không tìm thấy giao dịch gốc.');
            }

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
        filters?: { type?: string; minAmount?: number; maxAmount?: number; startDate?: string; endDate?: string; status?: string }
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
        const vnTimeOffset = 7 * 60 * 60 * 1000;

        if (filters?.startDate) {
            const start = new Date(filters.startDate);
            const startUtc = new Date(start.getTime() - vnTimeOffset);
            queryBuilder.andWhere('tx.createdAt >= :startDate', { startDate: startUtc });
        }
        if (filters?.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            const endUtc = new Date(end.getTime() - vnTimeOffset);
            queryBuilder.andWhere('tx.createdAt <= :endDate', { endDate: endUtc });
        }

        // trang thai
        if (filters?.status) {
            queryBuilder.andWhere('tx.status = :status', { status: filters.status });
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

    private isExpiredOTPCronRunning = false;

    @Cron(CronExpression.EVERY_MINUTE)
    async handleExpiredOTPTransactions() {
        if (this.isExpiredOTPCronRunning) {
            console.log('[CronJob] Tiến trình dọn dẹp OTP trước đó chưa hoàn tất, bỏ qua lượt chạy này.');
            return;
        }

        this.isExpiredOTPCronRunning = true;
        try {
            const result = await this.dataSource.manager.update(Transaction, {
                status: TransactionStatus.PENDING_OTP,
                otpExpiresAt: LessThan(new Date())
            }, {
                status: TransactionStatus.FAILED,
                description: 'Hủy do OTP hết hạn'
            });

            if (result.affected && result.affected > 0) {
                console.log(`[CronJob] Đã tự động hủy ${result.affected} giao dịch hết hạn OTP.`);
            }
        } catch (error) {
            console.error('[CronJob] Lỗi khi tự động hủy giao dịch hết hạn OTP:', error);
        } finally {
            this.isExpiredOTPCronRunning = false;
        }
    }
}