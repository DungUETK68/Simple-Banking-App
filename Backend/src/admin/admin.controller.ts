import { Controller, Get, Patch, Param, Body, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { DataSource, In } from 'typeorm';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { AuditLog } from 'src/entities/audit-log.entity';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService, private dataSource: DataSource) { }

    @Get('users')
    getAllUsers(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('name') name?: string,
        @Query('email') email?: string,
        @Query('role') role?: string,
        @Query('status') status?: string,
    ) {
        return this.adminService.getAllUsers(Number(page), Number(limit),
            { name, email, role, status });
    }

    @Patch('users/:id/status')
    updateUserStatus(@Param('id') id: string, @Body('status') status: UserStatus) {
        if (![UserStatus.ACTIVE, UserStatus.LOCKED].includes(status)) {
            throw new BadRequestException('Trạng thái không hợp lệ');
        }

        return this.adminService.updateUserStatus(id, status);
    }

    @Get('test-delete-ledger')
    async testDeleteLedger() {
        try {
            const firstEntry = await this.dataSource.manager.findOne(LedgerEntry, { where: {} });
            if (!firstEntry) return 'Chưa có bút toán nào để test!';

            await this.dataSource.manager.remove(firstEntry);
            return 'Xóa thành công';
        } catch (error: any) {
            throw new BadRequestException(error.message);
        }
    }

    @Get('audit-logs')
    async getAuditLogs() {
        const logs = await this.dataSource.manager.find(AuditLog, {
            order: { createdAt: 'DESC' },
            take: 50
        });

        const userIds = [...new Set([
            ...logs.map(log => log.actorId).filter(id => id),
            ...logs.map(log => log.entityId).filter(id => id)
        ])];

        const users = userIds.length > 0 ? await this.dataSource.manager.find(User, {
            where: { id: In(userIds) },
            select: { id: true, fullName: true }
        }) : [];

        const userMap = new Map(users.map(u => [u.id, u.fullName]));

        return logs.map(log => {
            const actorName = log.actorId ? userMap.get(log.actorId) || 'Unknown User' : 'Hệ thống';
            const entityName = (log.entityName === 'User' && log.entityId) ? userMap.get(log.entityId) || 'Unknown User' : log.entityName;

            return {
                ...log,
                actorName,
                entityNameDisplay: entityName
            };
        });
    }

    @Get('ledger-entries')
    getLedgerEntries(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('accountId') accountId?: string,
        @Query('accountNumber') accountNumber?: string,
        @Query('transactionId') transactionId?: string,
        @Query('type') type?: string,
    ) {
        return this.adminService.getLedgerEntries(Number(page), Number(limit), {
            accountId,
            accountNumber,
            transactionId,
            type,
        });
    }

    @Get('users/:id/history')
    getUserHistory(@Param('id') id: string) {
        return this.adminService.getUserHistory(id);
    }

    @Get('transactions')
    getAllTransactions(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('transactionId') transactionId?: string,
    ) {
        return this.adminService.getAllTransactions(Number(page), Number(limit), {
            type, status, transactionId
        });
    }
}
