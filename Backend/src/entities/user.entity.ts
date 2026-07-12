import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, OneToMany } from "typeorm";
import { Account } from './account.entity';
import { Session } from './session.entity';

export enum UserRole {
    CUSTOMER = 'customer',
    TELLER = 'teller',
    ADMIN = 'admin',
}

export enum UserStatus {
    ACTIVE = 'active',
    LOCKED = 'locked',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'full_name' })
    fullName: string;

    @Column({ unique: true })
    email: string;

    @Column({ name: 'phone_number', unique: true, nullable: true })
    phoneNumber: string;

    @Column({ name: 'password_hash' })
    passwordHash: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
    role: UserRole;

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
    status: UserStatus;

    @Column({ name: 'failed_login_attempts', default: 0 })
    failedLoginAttempts: number;

    @Column({ name: 'lock_until', nullable: true, type: 'timestamp' })
    lockUntil: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;

    @OneToMany(() => Account, (account) => account.user)
    accounts: Account[];

    @OneToMany(() => Session, (session) => session.user)
    sessions: Session[];
}