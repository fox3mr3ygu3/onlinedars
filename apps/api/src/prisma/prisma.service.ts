import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // Lazy connect: Prisma connects on the first query. Keeps boot working while the DB starts.
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
