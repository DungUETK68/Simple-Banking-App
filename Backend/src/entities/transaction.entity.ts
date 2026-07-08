import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { Account } from './account.entity';

export enum TransactionType {
    TRANSFER = 'transfer',
    DEPOSIT = 'deposit',
    REVERSAL = 'reversal',
}

export enum TransactionStatus {
    SUCCESS = 'success',
    FAILED = 'failed',
    PENDING = 'pending',
    REVERSED = 'reversed',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'numeric', precision: 18, scale: 2 })
    amount: number;

    @Column({ name: 'idempotency_key', unique: true, nullable: true })
    idempotencyKey: string;

    @Column({ type: 'enum', enum: TransactionType, default: TransactionType.TRANSFER })
    type: TransactionType;

    @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Column({ nullable: true })
    description: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => Account, (account) => account.sentTransactions)
    @JoinColumn({ name: 'from_account_id' })
    fromAccount: Account;

    @ManyToOne(() => Account, (account) => account.receivedTransactions)
    @JoinColumn({ name: 'to_account_id' })
    toAccount: Account;

    @ManyToOne(() => Transaction, { nullable: true })
    @JoinColumn({ name: 'original_transaction_id' })
    originalTransaction: Transaction;
}