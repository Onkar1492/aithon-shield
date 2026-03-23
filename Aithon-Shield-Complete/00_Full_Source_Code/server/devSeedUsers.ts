import type { IStorage } from "./storage";
import { hashPassword } from "./auth";

/** Documented in README — created in development if missing */
const DEV_SEED_USERS = [
  {
    email: "milan@yahoo.com",
    username: "milan_demo",
    firstName: "Milan",
    lastName: "User",
    plainPassword: "987654321",
  },
  {
    email: "samuel@yahoo.com",
    username: "samuel_demo",
    firstName: "Samuel",
    lastName: "User",
    plainPassword: "password",
  },
] as const;

export async function ensureDevSeedUsers(storage: IStorage): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  for (const seed of DEV_SEED_USERS) {
    const existing = await storage.getUserByEmailOrUsername(seed.email);
    const hashedPassword = await hashPassword(seed.plainPassword);
    if (!existing) {
      await storage.createUser({
        email: seed.email,
        username: seed.username,
        firstName: seed.firstName,
        lastName: seed.lastName,
        password: hashedPassword,
      });
      console.log(`[dev] Seeded demo user: ${seed.email}`);
      continue;
    }
    // Dev only: keep README demo passwords working even if the row was created earlier with a different hash
    await storage.updateUser(existing.id, { password: hashedPassword });
    console.log(`[dev] Ensured demo credentials for ${seed.email}`);
  }
}
