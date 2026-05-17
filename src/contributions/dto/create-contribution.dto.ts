import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateContributionDto {
  @IsUUID()
  crewId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
