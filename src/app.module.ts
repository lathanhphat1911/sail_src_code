import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { CrewsModule } from './crews/crews.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { BankConnectionsModule } from './bank-connections/bank-connections.module';
import { ContributionsModule } from './contributions/contributions.module';
import { CrewPeriodsModule } from './crew-periods/crew-periods.module';
import { ScheduleModule } from '@nestjs/schedule';
import { StoriesModule } from './stories/stories.module';
import { AchievementsModule } from './achievements/achievements.module';
import { AdminModule } from '@adminjs/nestjs';
import AdminJS from 'adminjs';
import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient, Prisma } from '@prisma/client';

AdminJS.registerAdapter({
  Resource: Resource,
  Database: Database,
});

const prisma = new PrismaClient();
const modelMap = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const datamodelEnumMap = Object.fromEntries(
  Prisma.dmmf.datamodel.enums.map((enumType) => [enumType.name, enumType]),
);

(prisma as any)._baseDmmf = {
  modelMap,
  datamodelEnumMap,
};

const getModelByName = (modelName: string) => {
  return modelMap[modelName];
};

@Module({
  imports: [
    CrewsModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    BankAccountsModule,
    BankConnectionsModule,
    ContributionsModule,
    CrewPeriodsModule,
    ScheduleModule.forRoot(),
    StoriesModule,
    AchievementsModule,
    AdminModule.createAdminAsync({
      useFactory: () => ({
        adminJsOptions: {
          rootPath: '/admin',
          resources: [
            // ==========================================
            // 👤 NHÓM 1: QUẢN LÝ NGƯỜI DÙNG & HỆ THỐNG
            // ==========================================
            {
              resource: { model: getModelByName('users'), client: prisma },
              options: { 
                navigation: '👤 Người dùng & Hệ thống',
                properties: { password_hash: { isVisible: false } } 
              },
            },
            { resource: { model: getModelByName('user_settings'), client: prisma }, options: { navigation: '👤 Người dùng & Hệ thống' } },
            { resource: { model: getModelByName('activity_logs'), client: prisma }, options: { navigation: '👤 Người dùng & Hệ thống' } },
            { resource: { model: getModelByName('notifications'), client: prisma }, options: { navigation: '👤 Người dùng & Hệ thống' } },
            { resource: { model: getModelByName('invite_codes'), client: prisma }, options: { navigation: '👤 Người dùng & Hệ thống' } },
          
            // ==========================================
            // 🚢 NHÓM 2: QUẢN LÝ HẠM ĐỘI
            // ==========================================
            { resource: { model: getModelByName('crews'), client: prisma }, options: { navigation: '🚢 Quản lý Hạm đội' } },
            { resource: { model: getModelByName('crew_periods'), client: prisma }, options: { navigation: '🚢 Quản lý Hạm đội' } },
            { resource: { model: getModelByName('memberships'), client: prisma }, options: { navigation: '🚢 Quản lý Hạm đội' } },
          
            // ==========================================
            // 💰 NHÓM 3: TÀI CHÍNH & GIAO DỊCH
            // ==========================================
            { resource: { model: getModelByName('bank_accounts'), client: prisma }, options: { navigation: '💰 Tài chính & Kinh tế' } },
            { resource: { model: getModelByName('transaction_categories'), client: prisma }, options: { navigation: '💰 Tài chính & Kinh tế' } },
            { resource: { model: getModelByName('transactions'), client: prisma }, options: { navigation: '💰 Tài chính & Kinh tế' } },
            { resource: { model: getModelByName('sepay_webhook_logs'), client: prisma }, options: { navigation: '💰 Tài chính & Kinh tế' } },
          
            // ==========================================
            // 🎯 NHÓM 4: NHIỆM VỤ, VẬT PHẨM & THÀNH TỰU
            // ==========================================
            { resource: { model: getModelByName('missions'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
            { resource: { model: getModelByName('user_missions'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
            { resource: { model: getModelByName('achievements'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
            { resource: { model: getModelByName('user_achievements'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
            { resource: { model: getModelByName('items'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
            { resource: { model: getModelByName('user_items'), client: prisma }, options: { navigation: '🎯 Game Hóa (Gamification)' } },
          
            // ==========================================
            // 📰 NHÓM 5: MẠNG XÃ HỘI (STORIES)
            // ==========================================
            { resource: { model: getModelByName('stories'), client: prisma }, options: { navigation: '📰 Bảng tin (Stories)' } },
            { resource: { model: getModelByName('story_comments'), client: prisma }, options: { navigation: '📰 Bảng tin (Stories)' } },
            { resource: { model: getModelByName('story_likes'), client: prisma }, options: { navigation: '📰 Bảng tin (Stories)' } },
          ],
          branding: {
            companyName: 'Pockit Admin',
            softwareBrothers: false,
          },
        },
        auth: {
          authenticate: (email: string, password: string) => {
            if (
              email === process.env.ADMIN_EMAIL &&
              password === process.env.ADMIN_PASSWORD
            ) {
              return Promise.resolve({ email, role: 'admin' });
            }
            return Promise.resolve(null);
          },
          cookieName: 'adminjs_pockit_cookie',
          cookiePassword: 'doi-cai-chuoi-nay-thanh-mat-khau-bat-ky-cua-may',
        },
        sessionOptions: {
          resave: true,
          saveUninitialized: true,
          secret: 'mot-chuoi-bi-mat-khac-cho-session',
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
