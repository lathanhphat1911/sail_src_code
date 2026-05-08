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
    CrewPeriodsModule,
    ScheduleModule.forRoot(),
    StoriesModule,
    AchievementsModule,
    AdminModule.createAdminAsync({
      useFactory: () => ({
        adminJsOptions: {
          rootPath: '/admin',
          resources: [
            {
              resource: { model: getModelByName('users'), client: prisma },
              options: {
                navigation: 'Quản lý Hệ thống',
                properties: { password_hash: { isVisible: false } },
              },
            },
            {
              resource: { model: getModelByName('crews'), client: prisma },
              options: { navigation: 'Quản lý Hạm đội' },
            },
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
