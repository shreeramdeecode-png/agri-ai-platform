import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  try {
    // Create admin user
    const adminEmail = "admin@agrisearch.com";
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      await storage.createUser({
        email: adminEmail,
        password: "admin123",
        fullName: "Admin User",
        role: "admin",
        isActive: true,
      });
      console.log("✓ Admin user created");
      console.log("  Email: admin@agrisearch.com");
      console.log("  Password: admin123");
    } else {
      console.log("✓ Admin user already exists");
    }

    // Create test user
    const userEmail = "user@agrisearch.com";
    const existingUser = await storage.getUserByEmail(userEmail);
    
    if (!existingUser) {
      await storage.createUser({
        email: userEmail,
        password: "user123",
        fullName: "Test User",
        role: "user",
        isActive: true,
      });
      console.log("✓ Test user created");
      console.log("  Email: user@agrisearch.com");
      console.log("  Password: user123");
    } else {
      console.log("✓ Test user already exists");
    }

    console.log("\n✅ Seeding complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
