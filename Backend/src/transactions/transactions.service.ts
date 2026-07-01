import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class TransactionsService {
    constructor(private dataSource: DataSource) { }

    async transfer(userId: string, transferDto: TransferDto) {
        const { fromAccountNumber, toAccountNumber, amount, description } = transferDto;

        if (fromAccountNumber === toAccountNumber) {
            throw new BadRequestException('Bạn không thể tự chuyển tiền cho chính mình.');
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
}