import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CrewPeriodsService } from './crew-periods.service';
import { CreateBulkPeriodsDto } from './dto/create-crew-period.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('crew-periods')
export class CrewPeriodsController {
  constructor(private readonly crewPeriodsService: CrewPeriodsService) {}

  @Post('bulk')
  createBulk(@Request() req, @Body() dto: CreateBulkPeriodsDto) {
    return this.crewPeriodsService.createBulk(req.user.userId, dto);
  }

  @Get('crew/:crewId')
  findByCrew(@Param('crewId') crewId: string) {
    return this.crewPeriodsService.findByCrew(crewId);
  }

  @Get('crew/:crewId/stats')
  getPeriodsWithStats(@Param('crewId') crewId: string) {
    return this.crewPeriodsService.getPeriodsWithStats(crewId);
  }
}