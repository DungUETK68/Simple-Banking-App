import { IsNotEmpty, IsUUID } from 'class-validator';

export class RefreshTokenDto {
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @IsNotEmpty()
    refreshToken: string;
}