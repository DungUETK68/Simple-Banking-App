import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('Không tìm thấy thông tin xác thực');
        }

        if (user.role !== 'admin') {
            throw new ForbiddenException('Bạn không có quyền truy cập tính năng của Quản trị viên');
        }

        return true;
    }
}