import { Controller, Get, Post, Body, UseGuards, Request, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateContributionDto } from './dto/create-contribution.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  /**
   * Create a new contribution
   * POST /contributions/create
   * 
   * Request:
   * {
   *   "crewId": "crew_id_uuid",
   *   "amount": 500000
   * }
   * 
   * Response:
   * {
   *   "contributionId": "ctr_uuid",
   *   "amount": 500000,
   *   "memo": "SAIL-01JXYZABC",
   *   "status": "PENDING",
   *   "qrUrl": "https://img.vietqr.io/...",
   *   "bankInfo": { ... },
   *   "createdAt": "2026-05-17T10:00:00Z"
   * }
   */
  @Post('create')
  create(@Request() req, @Body() createContributionDto: CreateContributionDto) {
    return this.contributionsService.create(req.user.userId, createContributionDto);
  }

  /**
   * Get a specific contribution by ID
   * GET /contributions/:id
   */
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contributionsService.findById(id);
  }

  /**
   * Get all contributions for authenticated user
   * GET /contributions/user/me
   */
  @Get('user/me')
  findMyContributions(@Request() req) {
    return this.contributionsService.findByUser(req.user.userId);
  }

  /**
   * Get all contributions for a crew
   * GET /contributions/crew/:crewId
   */
  @Get('crew/:crewId')
  findByCrewId(@Param('crewId', ParseUUIDPipe) crewId: string) {
    return this.contributionsService.findByCrew(crewId);
  }

  /**
   * Get contributions by status (optional query param)
   * GET /contributions?status=PENDING
   */
  @Get()
  findByStatus(@Query('status') status?: string) {
    if (status) {
      return this.contributionsService.findByStatus(status);
    }
    return [];
  }
}
