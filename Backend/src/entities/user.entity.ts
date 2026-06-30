import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { Account } from './account.entity';

export enum UserRole {
    CUSTOMER = 'customer',
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

    @Column({ name: 'password_hash' })
    passwordHash: string;

    @Column({ name: 'refresh_token', nullable: true })
    refreshToken: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
    role: UserRole;

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
    status: UserStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => Account, (account) => account.user)
    accounts: Account[];
}