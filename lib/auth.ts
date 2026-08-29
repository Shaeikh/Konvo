import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: ["https://crinkle-shaping-creatable.ngrok-free.dev"],
    fallback: process.env.BETTER_AUTH_URL || "http://localhost:3000",
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
