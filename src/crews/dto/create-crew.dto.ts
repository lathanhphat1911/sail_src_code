import { IsNotEmpty, IsNumberString, IsOptional, IsString, Matches } from "class-validator";

export class CreateCrewDto {
  @IsNotEmpty({ message: 'Tên hạm đội không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Số tiền mục tiêu phải là một con số' })
  amount?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}