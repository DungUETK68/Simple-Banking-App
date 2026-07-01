import { Controller, Post, Body, UseGuards, Req, Get, Query, BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post('transfer')
    transfer(@Req() req: any, @Body() transferDto: TransferDto) {
        const userId = req.user.id;

        return this.transactionsService.transfer(userId, transferDto);
    }

    @Get()
    getTransactions(
        @Req() req: any,
        @Query('accountNumber') accountNumber: string,
        @Query('page') page: number,
        @Query('limit') limit: number
    ) {
        if (!accountNumber) {
            throw new BadRequestException('Vui lòng nhập accountNumber.');
        }

        const userId = req.user.id;
        const pageNum = page || 1;
        const limitNum = limit || 10;

        return this.transactionsService.getTransactions(userId, accountNumber, pageNum, limitNum);
    }
}