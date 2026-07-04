import { Controller, Get, UseGuards, Req, Param } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMyAccount(@Req() req: any) {
        const userId = req.user.id;
        return this.accountsService.getMyProfileAndBalance(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('info/:accountNumber')
    getAccountInfo(@Param('accountNumber') accountNumber: string) {
        return this.accountsService.getAccountOwnerName(accountNumber);
    }
}
