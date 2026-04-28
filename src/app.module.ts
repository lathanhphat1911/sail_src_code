import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { CrewsModule } from './crews/crews.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { CrewPeriodsModule } from './crew-periods/crew-periods.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [CrewsModule, PrismaModule, UsersModule, AuthModule, BankAccountsModule, CrewPeriodsModule, ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
