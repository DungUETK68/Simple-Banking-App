import { Controller, Get, Patch, Param, Body, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserStatus } from '../entities/user.entity';
import { DataSource } from 'typeorm';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { AuditLog } from 'src/entities/audit-log.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
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
    @UseGuards(RolesGuard) // Yêu cầu quyền Admin (Nếu bạn đã setup @Roles thì gắn thêm vào)
    async getAuditLogs() {
        return this.dataSource.manager.find(AuditLog, {
            order: { createdAt: 'DESC' }, // Lấy log mới nhất
            take: 50
        });
    }

}
