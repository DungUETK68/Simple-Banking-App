import { Controller, Post, Body, UseGuards, Req, Get, Query, BadRequestException, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post('transfer')
    transfer(@Req() req: any, @Body() transferDto: TransferDto) {
        const userId = req.user.id;
        const userRole = req.user.role;

        return this.transactionsService.transfer(userId, userRole, transferDto);
    }

    @Post(':id/reverse')
    @UseGuards(RolesGuard)
    reverseTransaction(@Param('id') id: string) {
        return this.transactionsService.reverseTransaction(id);
    }

    @Get()
    getTransactions(
        @Req() req: any,
        @Query('accountNumber') accountNumber: string,
        @Query('page') page: number,
        @Query('limit') limit: number,
        @Query('type') type?: string,
        @Query('minAmount') minAmount?: number,
        @Query('maxAmount') maxAmount?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        if (!accountNumber) {
            throw new BadRequestException('Vui lòng nhập accountNumber.');
        }

        const userId = req.user.id;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;

        return this.transactionsService.getTransactions(userId, accountNumber, pageNum, limitNum, {
            type, minAmount, maxAmount, startDate, endDate
        });
    }

    @Post(':id/approve')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    approveTransaction(@Param('id') id: string) {
        return this.transactionsService.approveLargeTransaction(id);
    }
}