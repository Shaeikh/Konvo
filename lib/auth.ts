import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
    fallback: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  database: new Pool({
    connectionString: process.env.POSTGRESQL_URL,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    onExistingUserSignUp: async (data, request) => {
      console.log(
        `Duplicate registration attempt for email: ${data.user.email}`,
      );
    },
  },
  session: {
    cookieCache: {
      enabled: true,
    },
  },
});
