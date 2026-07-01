import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
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
}