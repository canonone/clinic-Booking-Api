export interface DatabaseConfig {
  url: string;
  /** TLS is on for remote hosts (e.g. Neon) and off for localhost/Docker, or when PGSSL=disable. */
  ssl: boolean;
  poolMax: number;
}

/** Reads the database settings from the environment (loaded from .env by dotenv). */
export const databaseConfig = (env: NodeJS.ProcessEnv = process.env): DatabaseConfig => {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const local = /localhost|127\.0\.0\.1/.test(url);
  return {
    url,
    ssl: !local && env.PGSSL !== 'disable',
    poolMax: 10,
  };
};
