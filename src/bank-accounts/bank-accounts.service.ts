import { Injectable } from '@nestjs/common';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBankAccountDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.bank_accounts.updateMany({
          where: { user_id: userId },
          data: { is_default: false },
        });
      }

      return tx.bank_accounts.create({
        data: {
          ...dto,
          user_id: userId,
        },
      });
    });
  }

  async findByUser(userId: string) {
    return this.prisma.bank_accounts.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }
}