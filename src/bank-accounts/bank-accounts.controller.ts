import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { AuthGuard } from '@nestjs/passport'; 

@UseGuards(AuthGuard('jwt')) 
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  create(@Request() req, @Body() createBankAccountDto: CreateBankAccountDto) {
    return this.bankAccountsService.create(req.user.userId, createBankAccountDto);
  }

  @Get()
  findMyAccounts(@Request() req) {
    return this.bankAccountsService.findByUser(req.user.userId);
  }
}