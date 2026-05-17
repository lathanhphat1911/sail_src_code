import { IsUUID, IsNotEmpty } from 'class-validator';

export class LinkBankToCrewDto {
  @IsUUID()
  @IsNotEmpty()
  bank_connection_id: string;
}
