import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length, Min } from "class-validator";

export class CreateInviteDto {
@IsOptional() 
  @IsInt()      
  @IsPositive()
  expires_in_hours?: number; 

  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number;     
}

export class JoinCrewDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}