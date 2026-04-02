import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ProjectsModule } from './projects/projects.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { EventsModule } from './events/events.module';
import { SalesModule } from './sales/sales.module';
import { RafflesModule } from './raffles/raffles.module';
import { ReportsModule } from './reports/reports.module';
import { ContributionsModule } from './contributions/contributions.module';

const typeOrmSync =
  process.env.SYNC_DB === 'true' ? true : process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            synchronize: typeOrmSync,
            logging: process.env.NODE_ENV === 'development',
            ssl: { rejectUnauthorized: false },
          }
        : {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_DATABASE || 'rover_fundraising',
            autoLoadEntities: true,
            synchronize: typeOrmSync,
            logging: process.env.NODE_ENV === 'development',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          },
    ),
    AuthModule,
    ProjectsModule,
    BeneficiariesModule,
    EventsModule,
    SalesModule,
    RafflesModule,
    ReportsModule,
    ContributionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
