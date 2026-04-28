import { PartialType } from '@nestjs/mapped-types';
import { CreateBulkPeriodsDto } from './create-crew-period.dto';

export class UpdateCrewPeriodDto extends PartialType(CreateBulkPeriodsDto) {}
