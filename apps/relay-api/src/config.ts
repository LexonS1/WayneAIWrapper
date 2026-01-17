import "dotenv/config";

export const config = {
  API_KEY: process.env.API_KEY || "dev-secret",
  PORT: Number(process.env.PORT || 3000)
};
