import { EventSubscriber, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { RequestContext } from '../utils/request-context';

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface<User> {
    listenTo() {
        return User;
    }

    async afterUpdate(event: UpdateEvent<User>) {
        if (!event.entity || !event.databaseEntity) return;
        const req = RequestContext.getStore();

        const actorId = req?.user?.id || 'HỆ_THỐNG';
        const ipAddress = req?.ip || '';
        const userAgent = req?.headers?.['user-agent'] || '';
        const auditLog = new AuditLog();
        auditLog.actorId = actorId;
        auditLog.action = 'UPDATE_USER_STATUS';
        auditLog.entityName = 'User';
        auditLog.entityId = event.entity.id as string;
        auditLog.ipAddress = ipAddress;
        auditLog.userAgent = userAgent;

        auditLog.beforeData = { status: event.databaseEntity.status };
        auditLog.afterData = { status: event.entity.status };
        await event.manager.save(AuditLog, auditLog);
    }
}