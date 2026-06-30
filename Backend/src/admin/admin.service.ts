import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';

@Injectable()
export class AdminService {
    constructor(private dataSource: DataSource) { }

    async getAllUsers() {
        const users = await this.dataSource.manager.find(User, {
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
            },
            order: { createdAt: 'DESC' }
        });

        return {
            message: 'Lấy danh sách người dùng thành công',
            data: users
        };
    }

    async updateUserStatus(userId: string, newStatus: UserStatus) {
        const user = await this.dataSource.manager.findOne(User, { where: { id: userId } });

        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng');
        }

        user.status = newStatus;
        await this.dataSource.manager.save(user);

        return {
            message: `Tài khoản đã được ${newStatus === UserStatus.ACTIVE ? 'mở khóa' : 'khóa'} thành công`,
            data: {
                id: user.id,
                status: user.status
            }
        };
    }
}
