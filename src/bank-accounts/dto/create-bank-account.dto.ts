import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bank_bin: string;

  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  account_name: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}