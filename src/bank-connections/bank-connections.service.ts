import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBankConnectionDto } from './dto/create-bank-connection.dto';
import { LinkBankToCrewDto } from './dto/link-bank-to-crew.dto';

@Injectable()
export class BankConnectionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new bank connection for a user
   * Called after successful Casso authentication callback
   */
  async create(userId: string, dto: CreateBankConnectionDto) {
    try {
      // Check if this casso_connection_id is already registered by another user
      const existingConnection = await this.prisma.bank_connections.findUnique({
        where: { casso_connection_id: dto.casso_connection_id },
      });

      if (existingConnection && existingConnection.user_id !== userId) {
        throw new BadRequestException('This bank connection is already registered by another user');
      }

      // Create or update the connection
      const bankConnection = await this.prisma.bank_connections.upsert({
        where: { casso_connection_id: dto.casso_connection_id },
        create: {
          user_id: userId,
          bank_name: dto.bank_name,
          bank_bin: dto.bank_bin,
          account_number: dto.account_number,
          account_name: dto.account_name,
          casso_connection_id: dto.casso_connection_id,
          is_active: true,
        },
        update: {
          bank_name: dto.bank_name,
          bank_bin: dto.bank_bin,
          account_number: dto.account_number,
          account_name: dto.account_name,
          is_active: true,
        },
      });

      return {
        id: bankConnection.id,
        bank_name: bankConnection.bank_name,
        bank_bin: bankConnection.bank_bin,
        account_number: bankConnection.account_number,
        account_name: bankConnection.account_name,
        casso_connection_id: bankConnection.casso_connection_id,
        is_active: bankConnection.is_active,
        created_at: bankConnection.created_at,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to create bank connection: ${error.message}`);
    }
  }

  /**
   * Get all active bank connections for a user
   */
  async findByUser(userId: string) {
    const connections = await this.prisma.bank_connections.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      select: {
        id: true,
        bank_name: true,
        bank_bin: true,
        account_number: true,
        account_name: true,
        is_active: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return connections;
  }

  /**
   * Get a specific bank connection
   */
  async findById(id: string) {
    const connection = await this.prisma.bank_connections.findUnique({
      where: { id },
      select: {
        id: true,
        user_id: true,
        bank_name: true,
        bank_bin: true,
        account_number: true,
        account_name: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!connection) {
      throw new NotFoundException(`Bank connection with ID ${id} not found`);
    }

    return connection;
  }

  /**
   * Deactivate a bank connection
   */
  async deactivate(id: string, userId: string) {
    const connection = await this.findById(id);

    if (connection.user_id !== userId) {
      throw new ForbiddenException('You can only deactivate your own bank connections');
    }

    const updated = await this.prisma.bank_connections.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        bank_name: true,
        is_active: true,
      },
    });

    return updated;
  }

  /**
   * Link a bank connection to a crew
   * Requirements:
   * - Only crew leader can link bank
   * - Bank connection must belong to the leader
   * - Only one active bank per crew
   * - Updating bank replaces previous assignment
   */
  async linkBankToCrew(crewId: string, userId: string, dto: LinkBankToCrewDto) {
    // Verify crew exists and user is the leader
    const crew = await this.prisma.crews.findUnique({
      where: { id: crewId },
      select: { id: true, owner_id: true },
    });

    if (!crew) {
      throw new NotFoundException(`Crew with ID ${crewId} not found`);
    }

    if (crew.owner_id !== userId) {
      throw new ForbiddenException('Only the crew leader can assign a bank connection');
    }

    // Verify bank connection exists and belongs to the user
    const connection = await this.findById(dto.bank_connection_id);

    if (connection.user_id !== userId) {
      throw new ForbiddenException('This bank connection does not belong to you');
    }

    if (!connection.is_active) {
      throw new BadRequestException('Cannot assign an inactive bank connection');
    }

    // Update crew with new bank connection (replaces any previous)
    const updatedCrew = await this.prisma.crews.update({
      where: { id: crewId },
      data: { bank_connection_id: dto.bank_connection_id },
      select: {
        id: true,
        name: true,
        bank_connection_id: true,
        bank_connection: {
          select: {
            id: true,
            bank_name: true,
            bank_bin: true,
            account_number: true,
            account_name: true,
          },
        },
      },
    });

    return {
      crew_id: updatedCrew.id,
      crew_name: updatedCrew.name,
      bank_connection: updatedCrew.bank_connection,
    };
  }

  /**
   * Get current bank connection assigned to a crew
   */
  async getCrewBankConnection(crewId: string) {
    const crew = await this.prisma.crews.findUnique({
      where: { id: crewId },
      select: {
        bank_connection_id: true,
        bank_connection: {
          select: {
            id: true,
            bank_name: true,
            bank_bin: true,
            account_number: true,
            account_name: true,
            is_active: true,
          },
        },
      },
    });

    if (!crew) {
      throw new NotFoundException(`Crew with ID ${crewId} not found`);
    }

    if (!crew.bank_connection) {
      throw new NotFoundException('No bank connection assigned to this crew');
    }

    return crew.bank_connection;
  }
}
