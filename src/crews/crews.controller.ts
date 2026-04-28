import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseUUIDPipe, Headers, UnauthorizedException } from '@nestjs/common';
import { CrewsService } from './crews.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateCrewDto } from './dto/create-crew.dto';
import { CreateInviteDto, JoinCrewDto } from './dto/invite.crew.dto';

@Controller('crews')
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  @Get('/hello')
  nigger(){
    return 'hello world'
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  getMyCrews(@Request() req) {
    return this.crewsService.getMyCrews(req.user.userId);
  }
  
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id : string) {
    return this.crewsService.findById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  createCrew(@Request() req, @Body() createCrewDto: CreateCrewDto) {
    return this.crewsService.create(req.user.userId, createCrewDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/detail')
  getCrewDetail(@Param('id') id: string) {
    return this.crewsService.getDetail(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/bank-account')
  linkBankAccount(@Param('id') id: string, @Body('bankAccountId') bankAccountId: string) {
    return this.crewsService.linkBankAccount(id, bankAccountId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/invite')
  createInvite(
    @Request() req,
    @Param('id') crewId: string,
    @Body() dto: CreateInviteDto
  ) {
    return this.crewsService.createInviteCode(req.user.userId, crewId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invite/:code') 
    async getInvitePreview(@Param('code') code: string) {
    return this.crewsService.getInvitePreview(code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('join')
  joinCrew(@Request() req, @Body() dto: JoinCrewDto) {
    return this.crewsService.joinByCode(req.user.userId, dto.code);
  }

  @Get(':id/logs')
  getCrewLogs(@Param('id') id: string) {
    return this.crewsService.getCrewLogs(id);
  }

  @UseGuards(AuthGuard('jwt')) 
  @Post(':id/deposit')
  reportDeposit(@Param('id') id: string, @Body('amount') amount: number, @Request() req) {
    return this.crewsService.reportDeposit(id, req.user.userId, amount); 
  }

  @Patch('transactions/:txId/approve')
  approveDeposit(@Param('txId') txId: string) {
    return this.crewsService.approveDeposit(txId);
  }
}