import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContributionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate ULID-like unique contribution memo in format: SAIL-{ULID}
   * 
   * ULID provides:
   * - Global uniqueness
   * - Not predictable
   * - Doesn't expose internal IDs
   * - Sortable by timestamp
   * 
   * Using crockford base32 encoding as per ULID spec
   */
  private generateMemo(): string {
    // Crockford Base32 alphabet
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    
    // Generate timestamp part (10 chars for ~8000 years from 1970)
    const now = Date.now();
    const timestampChars: string[] = [];
    let time = now;
    for (let i = 0; i < 10; i++) {
      timestampChars.unshift(alphabet[time % 32]);
      time = Math.floor(time / 32);
    }
    
    // Generate random part (6 chars for ~1 billion combinations)
    const randomChars: string[] = [];
    for (let i = 0; i < 6; i++) {
      randomChars.push(alphabet[Math.floor(Math.random() * 32)]);
    }
    
    // Combine: SAIL-{10 timestamp chars}{6 random chars}
    const ulid = timestampChars.join('') + randomChars.join('');
    return `SAIL-${ulid}`;
  }

  /**
   * Generate VietQR URL for payment
   * Format: https://img.vietqr.io/image/{bin}-{account}.png?amount={amount}&addInfo={memo}
   */
  private generateVietQRUrl(
    bankBin: string,
    accountNumber: string,
    amount: number,
    memo: string
  ): string {
    const baseUrl = 'https://img.vietqr.io/image';
    const params = new URLSearchParams({
      amount: amount.toString(),
      addInfo: memo,
    });
    return `${baseUrl}/${bankBin}-${accountNumber}.png?${params.toString()}`;
  }

  /**
   * Create a new contribution transaction
   * 
   * Backend responsibilities:
   * 1. Validate crew exists
   * 2. Validate crew has linked bank
   * 3. Generate unique contribution memo
   * 4. Create contribution with status=PENDING
   * 5. Generate VietQR URL
   * 6. Return contribution metadata
   */
  async create(userId: string, dto: CreateContributionDto) {
    // 1. Validate crew exists and get its details
    const crew = await this.prisma.crews.findUnique({
      where: { id: dto.crewId },
      include: { bank_connection: true },
    });

    if (!crew) {
      throw new NotFoundException(`Crew with ID ${dto.crewId} not found`);
    }

    // 2. Validate crew has linked bank
    if (!crew.bank_connection_id || !crew.bank_connection) {
      throw new BadRequestException(
        'This crew does not have a linked bank connection. Please contact the crew leader to assign a bank account.'
      );
    }

    // Verify bank connection is active
    if (!crew.bank_connection.is_active) {
      throw new BadRequestException(
        'The linked bank connection is inactive. Please contact the crew leader to update it.'
      );
    }

    // 3. Generate unique contribution memo
    const memo = this.generateMemo();

    // 4. Create contribution with status=PENDING
    const contribution = await this.prisma.contributions.create({
      data: {
        crew_id: dto.crewId,
        payer_id: userId,
        amount: new Prisma.Decimal(dto.amount),
        memo: memo,
        status: 'PENDING',
        bank_connection_id: crew.bank_connection.id,
      },
    });

    // 5. Generate VietQR URL
    const qrUrl = this.generateVietQRUrl(
      crew.bank_connection.bank_bin,
      crew.bank_connection.account_number,
      dto.amount,
      memo
    );

    // 6. Return contribution metadata
    return {
      contributionId: contribution.id,
      amount: dto.amount,
      memo: memo,
      status: contribution.status,
      qrUrl: qrUrl,
      bankInfo: {
        bankName: crew.bank_connection.bank_name,
        bankBin: crew.bank_connection.bank_bin,
        accountNumber: crew.bank_connection.account_number,
        accountName: crew.bank_connection.account_name,
      },
      createdAt: contribution.created_at,
    };
  }

  /**
   * Get a contribution by ID
   */
  async findById(id: string) {
    const contribution = await this.prisma.contributions.findUnique({
      where: { id },
      include: {
        crew: { select: { id: true, name: true } },
        payer: { select: { id: true, full_name: true } },
        bank_connection: {
          select: {
            bank_name: true,
            bank_bin: true,
            account_number: true,
            account_name: true,
          },
        },
      },
    });

    if (!contribution) {
      throw new NotFoundException(`Contribution with ID ${id} not found`);
    }

    return contribution;
  }

  /**
   * Get all contributions for a user
   */
  async findByUser(userId: string) {
    return this.prisma.contributions.findMany({
      where: { payer_id: userId },
      include: {
        crew: { select: { id: true, name: true } },
        bank_connection: {
          select: {
            bank_name: true,
            bank_bin: true,
            account_number: true,
            account_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get all contributions for a crew
   */
  async findByCrew(crewId: string) {
    return this.prisma.contributions.findMany({
      where: { crew_id: crewId },
      include: {
        payer: { select: { id: true, full_name: true } },
        bank_connection: {
          select: {
            bank_name: true,
            bank_bin: true,
            account_number: true,
            account_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get contributions by status
   */
  async findByStatus(status: string) {
    return this.prisma.contributions.findMany({
      where: { status: status as any },
      include: {
        crew: { select: { id: true, name: true } },
        payer: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
