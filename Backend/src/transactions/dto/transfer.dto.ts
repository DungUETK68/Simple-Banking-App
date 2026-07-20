import { IsNotEmpty, IsNumber, IsString, IsOptional, Min, Max, IsUUID } from "class-validator";

export class TransferDto {
    @IsNotEmpty({ message: 'Vui lòng nhập số tài khoản nguồn.' })
    @IsString()
    fromAccountNumber: string;

    @IsNotEmpty({ message: 'Vui lòng nhập số tài khoản người nhận.' })
    toAccountNumber: string;

    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Số tiền phải là một con số hợp lệ.' })
    @Min(1, { message: 'Số tiền chuyển tối thiểu là 1 VND.' })
    @Max(100000000, { message: 'Số tiền vượt quá hạn mức giao dịch cho phép.' })
    amount: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty({ message: 'Thiếu mã Idempotency Key để chống lặp giao dịch.' })
    @IsUUID('all', { message: 'Idempotency Key phải là định dạng UUID hợp lệ.' })
    idempotencyKey: string;
}