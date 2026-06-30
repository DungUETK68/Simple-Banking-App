import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty()
    fullName: string;

    @IsEmail()
    email: string;

    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;
}