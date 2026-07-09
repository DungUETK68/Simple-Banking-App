import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'actor_id', nullable: true })
    actorId: string;

    @Column()
    action: string;

    @Column({ name: 'entity_name', nullable: true })
    entityName: string;

    @Column({ name: 'entity_id', nullable: true })
    entityId: string;

    @Column({ name: 'ip_address', nullable: true })
    ipAddress: string;

    @Column({ name: 'user_agent', nullable: true })
    userAgent: string;

    @Column({ type: 'jsonb', name: 'before_data', nullable: true })
    beforeData: any;

    @Column({ type: 'jsonb', name: 'after_data', nullable: true })
    afterData: any;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}