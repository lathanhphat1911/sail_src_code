import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PeriodItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  deadline: string; // YYYY-MM-DD

  @IsNumber()
  amount: number;
}

export class CreateBulkPeriodsDto {
  @IsString()
  @IsNotEmpty()
  crewId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeriodItemDto)
  periods: PeriodItemDto[];
}