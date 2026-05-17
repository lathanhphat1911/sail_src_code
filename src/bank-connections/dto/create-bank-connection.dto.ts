import { IsString, IsNotEmpty } from 'class-validator';

export class CreateBankConnectionDto {
  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @IsString()
  @IsNotEmpty()
  bank_bin: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  account_name: string;

  @IsString()
  @IsNotEmpty()
  casso_connection_id: string;
}
