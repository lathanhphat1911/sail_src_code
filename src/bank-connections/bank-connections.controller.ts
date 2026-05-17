import { Controller, Get, Post, Body, UseGuards, Request, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { BankConnectionsService } from './bank-connections.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateBankConnectionDto } from './dto/create-bank-connection.dto';
import { LinkBankToCrewDto } from './dto/link-bank-to-crew.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('bank-connections')
export class BankConnectionsController {
  constructor(private readonly bankConnectionsService: BankConnectionsService) {}

  /**
   * Create a new bank connection (called after Casso callback)
   * POST /bank-connections/connect
   */
  @Post('connect')
  create(@Request() req, @Body() createBankConnectionDto: CreateBankConnectionDto) {
    return this.bankConnectionsService.create(req.user.userId, createBankConnectionDto);
  }

  /**
   * Get all bank connections for the authenticated user
   * GET /bank-connections
   */
  @Get()
  findMyConnections(@Request() req) {
    return this.bankConnectionsService.findByUser(req.user.userId);
  }

  /**
   * Get a specific bank connection by ID
   * GET /bank-connections/:id
   */
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankConnectionsService.findById(id);
  }

  /**
   * Deactivate a bank connection
   * DELETE /bank-connections/:id
   */
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.bankConnectionsService.deactivate(id, req.user.userId);
  }
}
