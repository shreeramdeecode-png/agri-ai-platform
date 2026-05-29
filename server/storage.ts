import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, desc, sql, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import ws from "ws";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Document,
  InsertDocument,
  Image,
  InsertImage,
  SearchHistory,
  InsertSearchHistory,
  ApiSetting,
  InsertApiSetting,
  AdminLog,
  InsertAdminLog,
  Notification,
  InsertNotification,
} from "@shared/schema";

// Configure WebSocket for Neon in Node.js environment
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Document operations
  createDocument(doc: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getAllDocuments(): Promise<Document[]>;
  deleteDocument(id: string): Promise<void>;
  
  // Image operations
  createImage(img: InsertImage): Promise<Image>;
  getImage(id: string): Promise<Image | undefined>;
  getUserImages(userId: string): Promise<Image[]>;
  getAllImages(): Promise<Image[]>;
  deleteImage(id: string): Promise<void>;
  
  // Search history operations
  createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory>;
  getUserSearchHistory(userId: string): Promise<SearchHistory[]>;
  getAllSearchHistory(): Promise<SearchHistory[]>;
  deleteSearchHistory(id: string): Promise<void>;
  deleteAllUserSearchHistory(userId: string): Promise<number>;
  findCachedSearch(userId: string, query: string): Promise<SearchHistory | undefined>;
  
  // API Settings operations
  createApiSetting(setting: InsertApiSetting): Promise<ApiSetting>;
  getApiSetting(keyName: string): Promise<ApiSetting | undefined>;
  getAllApiSettings(): Promise<ApiSetting[]>;
  updateApiSetting(keyName: string, updates: Partial<InsertApiSetting>): Promise<ApiSetting | undefined>;
  
  // Admin log operations
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  getAllAdminLogs(): Promise<AdminLog[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getAllNotifications(): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  clearAllNotifications(): Promise<void>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalUsers: number;
    queriesToday: number;
    apiQueries: number;
    pdfQueries: number;
    imageQueries: number;
    activeSessions: number;
  }>;
  
  // Analytics
  getQueryAnalytics(): Promise<Array<{
    name: string;
    queries: number;
    api: number;
  }>>;
}

export class DbStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(schema.users).values({
      ...user,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  // Document operations
  async createDocument(doc: InsertDocument): Promise<Document> {
    const result = await db.insert(schema.documents).values(doc).returning();
    return result[0];
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
    return result[0];
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return await db.select().from(schema.documents)
      .where(eq(schema.documents.userId, userId))
      .orderBy(desc(schema.documents.uploadDate));
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(schema.documents).orderBy(desc(schema.documents.uploadDate));
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }

  // Image operations
  async createImage(img: InsertImage): Promise<Image> {
    const result = await db.insert(schema.images).values(img).returning();
    return result[0];
  }

  async getImage(id: string): Promise<Image | undefined> {
    const result = await db.select().from(schema.images).where(eq(schema.images.id, id)).limit(1);
    return result[0];
  }

  async getUserImages(userId: string): Promise<Image[]> {
    return await db.select().from(schema.images)
      .where(eq(schema.images.userId, userId))
      .orderBy(desc(schema.images.uploadDate));
  }

  async getAllImages(): Promise<Image[]> {
    return await db.select().from(schema.images).orderBy(desc(schema.images.uploadDate));
  }

  async deleteImage(id: string): Promise<void> {
    await db.delete(schema.images).where(eq(schema.images.id, id));
  }

  // Search history operations
  async createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory> {
    const result = await db.insert(schema.searchHistory).values(history).returning();
    return result[0];
  }

  async getUserSearchHistory(userId: string): Promise<SearchHistory[]> {
    return await db.select().from(schema.searchHistory)
      .where(eq(schema.searchHistory.userId, userId))
      .orderBy(desc(schema.searchHistory.createdAt));
  }

  async getAllSearchHistory(): Promise<SearchHistory[]> {
    return await db.select().from(schema.searchHistory).orderBy(desc(schema.searchHistory.createdAt));
  }

  async deleteSearchHistory(id: string): Promise<void> {
    await db.delete(schema.searchHistory).where(eq(schema.searchHistory.id, id));
  }

  async deleteAllUserSearchHistory(userId: string): Promise<number> {
    const deleted = await db
      .delete(schema.searchHistory)
      .where(eq(schema.searchHistory.userId, userId))
      .returning({ id: schema.searchHistory.id });
    return deleted.length;
  }

  async findCachedSearch(userId: string, query: string): Promise<SearchHistory | undefined> {
    const normalizedQuery = query.trim().toLowerCase();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await db.select().from(schema.searchHistory)
      .where(and(
        eq(schema.searchHistory.userId, userId),
        sql`LOWER(TRIM(${schema.searchHistory.query})) = ${normalizedQuery}`,
        sql`${schema.searchHistory.createdAt} >= ${oneDayAgo}`
      ))
      .orderBy(desc(schema.searchHistory.createdAt))
      .limit(1);
    return results[0];
  }

  // API Settings operations
  async createApiSetting(setting: InsertApiSetting): Promise<ApiSetting> {
    const result = await db.insert(schema.apiSettings).values(setting).returning();
    return result[0];
  }

  async getApiSetting(keyName: string): Promise<ApiSetting | undefined> {
    const result = await db.select().from(schema.apiSettings)
      .where(eq(schema.apiSettings.keyName, keyName))
      .limit(1);
    return result[0];
  }

  async getAllApiSettings(): Promise<ApiSetting[]> {
    return await db.select().from(schema.apiSettings);
  }

  async updateApiSetting(keyName: string, updates: Partial<InsertApiSetting>): Promise<ApiSetting | undefined> {
    const result = await db.update(schema.apiSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.apiSettings.keyName, keyName))
      .returning();
    return result[0];
  }

  // Admin log operations
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const result = await db.insert(schema.adminLogs).values(log).returning();
    return result[0];
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    return await db.select().from(schema.adminLogs).orderBy(desc(schema.adminLogs.createdAt));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, id));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  async clearAllNotifications(): Promise<void> {
    await db.delete(schema.notifications);
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    totalUsers: number;
    queriesToday: number;
    apiQueries: number;
    pdfQueries: number;
    imageQueries: number;
    activeSessions: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await db.select().from(schema.users);
    const activeUsers = users.filter(u => u.isActive);
    const allHistory = await db.select().from(schema.searchHistory);
    const todayHistory = allHistory.filter(h => h.createdAt >= today);

    // Active sessions: users who searched in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentHistory = allHistory.filter(h => h.createdAt >= oneHourAgo);
    const activeSessions = new Set(recentHistory.map(h => h.userId)).size;

    return {
      totalUsers: users.length,
      queriesToday: todayHistory.length,
      apiQueries: allHistory.filter(h => h.sourceType?.includes('API')).length,
      pdfQueries: allHistory.filter(h => h.sourceType?.includes('PDF')).length,
      imageQueries: allHistory.filter(h => h.sourceType?.includes('Image')).length,
      activeSessions,
    };
  }

  async getQueryAnalytics(): Promise<Array<{
    name: string;
    queries: number;
    api: number;
  }>> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const analytics: Array<{ name: string; queries: number; api: number }> = [];
    
    // Get last 7 days data
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayHistory = await db.select().from(schema.searchHistory)
        .where(sql`${schema.searchHistory.createdAt} >= ${date} AND ${schema.searchHistory.createdAt} < ${nextDate}`);
      
      const dayName = dayNames[date.getDay()];
      const totalQueries = dayHistory.length;
      const apiQueries = dayHistory.filter(h => h.sourceType?.includes('API')).length;
      
      analytics.push({
        name: dayName,
        queries: totalQueries,
        api: apiQueries,
      });
    }
    
    return analytics;
  }
}

export const storage = new DbStorage();
