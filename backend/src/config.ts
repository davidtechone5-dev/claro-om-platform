import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || "3000",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/claro_om?schema=public",
  JWT_SECRET: process.env.JWT_SECRET || "claro_super_secure_jwt_secret_key_2026",
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || "24h",
  INTEGRATION_SECRET: process.env.INTEGRATION_SECRET || "claro_integration_secret_token_12345"
};
