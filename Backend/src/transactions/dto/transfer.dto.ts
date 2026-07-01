import { IsNotEmpty, IsNumber, IsString, IsOptional, Min } from "class-validator";

export class TransferDto {
    @IsNotEmpty({ message: 'Vui lòng nhập số tài khoản nguồn' })
    @IsString()
    fromAccountNumber: string;

    @IsNotEmpty({ message: 'Vui lòng nhập số tài khoản người nhận' })
    toAccountNumber: string;

    @IsNumber({}, { message: 'Số tiền phải là một con số' })
    @Min(1, { message: 'Số tiền chuyển tối thiểu là 1 VND' })
    amount: number;

    @IsOptional()
    @IsString()
    description?: string;
}