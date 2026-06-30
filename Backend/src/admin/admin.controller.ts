import { Controller, Get, Patch, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserStatus } from '../entities/user.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    getAllUsers() {
        return this.adminService.getAllUsers();
    }

    @Patch('users/:id/status')
    updateUserStatus(@Param('id') id: string, @Body('status') status: UserStatus) {
        if (![UserStatus.ACTIVE, UserStatus.LOCKED].includes(status)) {
            throw new BadRequestException('Trạng thái không hợp lệ');
        }

        return this.adminService.updateUserStatus(id, status);
    }
}
