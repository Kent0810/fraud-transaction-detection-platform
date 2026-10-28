import { defineConfig } from 'prisma/config';

// Flyway owns the schema: never run `prisma migrate` or `prisma db push` here.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL },
});
