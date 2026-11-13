import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';

/** TypeORM connection options, built from databaseConfig(). */
export const typeOrmConfig = (): TypeOrmModuleOptions => {
  const db = databaseConfig();
  return {
    type: 'postgres',
    url: db.url,
    autoLoadEntities: true, // entities come from each module's TypeOrmModule.forFeature()
    synchronize: true, // creates/updates tables on boot
    ssl: db.ssl ? { rejectUnauthorized: false } : false,
    extra: { max: db.poolMax },
  };
};
