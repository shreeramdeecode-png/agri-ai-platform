import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import ws from "ws";
import * as schema from "@shared/schema";
import type {
  User, InsertUser,
  Document, InsertDocument,
  DocumentChunk, InsertDocumentChunk,
  Image, InsertImage,
  ChatSession, InsertChatSession,
  ChatMessage, InsertChatMessage,
  SearchHistory, InsertSearchHistory,
  ApiSetting, InsertApiSetting,
  AdminLog, InsertAdminLog,
  Notification, InsertNotification,
} from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export interface IStorage {
  // User
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Document
  createDocument(doc: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getAllDocuments(): Promise<Document[]>;
  deleteDocument(id: string): Promise<void>;

  // Document Chunks
  createDocumentChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]>;
  getChunksByDocument(documentId: string): Promise<DocumentChunk[]>;
  getChunksByUser(userId: string): Promise<DocumentChunk[]>;
  deleteChunksByDocument(documentId: string): Promise<void>;

  // Image
  createImage(img: InsertImage): Promise<Image>;
  getImage(id: string): Promise<Image | undefined>;
  getUserImages(userId: string): Promise<Image[]>;
  getAllImages(): Promise<Image[]>;
  deleteImage(id: string): Promise<void>;

  // Chat Sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  getUserChatSessions(userId: string): Promise<ChatSession[]>;
  updateChatSession(id: string, updates: Partial<InsertChatSession>): Promise<ChatSession | undefined>;
  deleteChatSession(id: string): Promise<void>;

  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getMessagesBySession(sessionId: string): Promise<ChatMessage[]>;
  deleteMessagesBySession(sessionId: string): Promise<void>;

  // Search History
  createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory>;
  getUserSearchHistory(userId: string): Promise<SearchHistory[]>;
  getAllSearchHistory(): Promise<SearchHistory[]>;
  deleteSearchHistory(id: string): Promise<void>;

  // API Settings
  createApiSetting(setting: InsertApiSetting): Promise<ApiSetting>;
  getApiSetting(keyName: string): Promise<ApiSetting | undefined>;
  getAllApiSettings(): Promise<ApiSetting[]>;
  updateApiSetting(keyName: string, updates: Partial<InsertApiSetting>): Promise<ApiSetting | undefined>;

  // Admin Logs
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  getAllAdminLogs(): Promise<AdminLog[]>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getAllNotifications(): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  clearAllNotifications(): Promise<void>;

  // Stats
  getDashboardStats(): Promise<{
    totalUsers: number; queriesToday: number; apiQueries: number;
    pdfQueries: number; imageQueries: number; activeSessions: number;
  }>;
  getQueryAnalytics(): Promise<Array<{ name: string; queries: number; api: number }>>;
}

export class DbStorage implements IStorage {
  // ─── Users ────────────────────────────────────────────────────────────────
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
    const result = await db.insert(schema.users).values({ ...user, password: hashedPassword }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.password) updateData.password = await bcrypt.hash(updates.password, 10);
    const result = await db.update(schema.users).set(updateData).where(eq(schema.users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  // ─── Documents ────────────────────────────────────────────────────────────
  async createDocument(doc: InsertDocument): Promise<Document> {
    const result = await db.insert(schema.documents).values(doc).returning();
    return result[0];
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
    return result[0];
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(eq(schema.documents.userId, userId))
      .orderBy(desc(schema.documents.uploadDate));
  }

  async getAllDocuments(): Promise<Document[]> {
    return db.select().from(schema.documents).orderBy(desc(schema.documents.uploadDate));
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }

  // ─── Document Chunks ──────────────────────────────────────────────────────
  async createDocumentChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]> {
    if (chunks.length === 0) return [];
    const result = await db.insert(schema.documentChunks).values(chunks).returning();
    return result;
  }

  async getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
    return db.select().from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId))
      .orderBy(schema.documentChunks.chunkIndex);
  }

  async getChunksByUser(userId: string): Promise<DocumentChunk[]> {
    return db.select().from(schema.documentChunks)
      .where(eq(schema.documentChunks.userId, userId))
      .orderBy(schema.documentChunks.chunkIndex);
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await db.delete(schema.documentChunks).where(eq(schema.documentChunks.documentId, documentId));
  }

  // ─── Images ───────────────────────────────────────────────────────────────
  async createImage(img: InsertImage): Promise<Image> {
    const result = await db.insert(schema.images).values(img).returning();
    return result[0];
  }

  async getImage(id: string): Promise<Image | undefined> {
    const result = await db.select().from(schema.images).where(eq(schema.images.id, id)).limit(1);
    return result[0];
  }

  async getUserImages(userId: string): Promise<Image[]> {
    return db.select().from(schema.images)
      .where(eq(schema.images.userId, userId))
      .orderBy(desc(schema.images.uploadDate));
  }

  async getAllImages(): Promise<Image[]> {
    return db.select().from(schema.images).orderBy(desc(schema.images.uploadDate));
  }

  async deleteImage(id: string): Promise<void> {
    await db.delete(schema.images).where(eq(schema.images.id, id));
  }

  // ─── Chat Sessions ────────────────────────────────────────────────────────
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const result = await db.insert(schema.chatSessions).values(session).returning();
    return result[0];
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const result = await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, id)).limit(1);
    return result[0];
  }

  async getUserChatSessions(userId: string): Promise<ChatSession[]> {
    return db.select().from(schema.chatSessions)
      .where(eq(schema.chatSessions.userId, userId))
      .orderBy(desc(schema.chatSessions.updatedAt));
  }

  async updateChatSession(id: string, updates: Partial<InsertChatSession>): Promise<ChatSession | undefined> {
    const result = await db.update(schema.chatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.chatSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteChatSession(id: string): Promise<void> {
    await db.delete(schema.chatSessions).where(eq(schema.chatSessions.id, id));
  }

  // ─── Chat Messages ────────────────────────────────────────────────────────
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(schema.chatMessages).values(message).returning();
    return result[0];
  }

  async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId))
      .orderBy(schema.chatMessages.createdAt);
  }

  async deleteMessagesBySession(sessionId: string): Promise<void> {
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.sessionId, sessionId));
  }

  // ─── Search History ───────────────────────────────────────────────────────
  async createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory> {
    const result = await db.insert(schema.searchHistory).values(history).returning();
    return result[0];
  }

  async getUserSearchHistory(userId: string): Promise<SearchHistory[]> {
    return db.select().from(schema.searchHistory)
      .where(eq(schema.searchHistory.userId, userId))
      .orderBy(desc(schema.searchHistory.createdAt));
  }

  async getAllSearchHistory(): Promise<SearchHistory[]> {
    return db.select().from(schema.searchHistory).orderBy(desc(schema.searchHistory.createdAt));
  }

  async deleteSearchHistory(id: string): Promise<void> {
    await db.delete(schema.searchHistory).where(eq(schema.searchHistory.id, id));
  }

  // ─── API Settings ─────────────────────────────────────────────────────────
  async createApiSetting(setting: InsertApiSetting): Promise<ApiSetting> {
    const result = await db.insert(schema.apiSettings).values(setting).returning();
    return result[0];
  }

  async getApiSetting(keyName: string): Promise<ApiSetting | undefined> {
    const result = await db.select().from(schema.apiSettings)
      .where(eq(schema.apiSettings.keyName, keyName)).limit(1);
    return result[0];
  }

  async getAllApiSettings(): Promise<ApiSetting[]> {
    return db.select().from(schema.apiSettings);
  }

  async updateApiSetting(keyName: string, updates: Partial<InsertApiSetting>): Promise<ApiSetting | undefined> {
    const result = await db.update(schema.apiSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.apiSettings.keyName, keyName))
      .returning();
    return result[0];
  }

  // ─── Admin Logs ───────────────────────────────────────────────────────────
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const result = await db.insert(schema.adminLogs).values(log).returning();
    return result[0];
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    return db.select().from(schema.adminLogs).orderBy(desc(schema.adminLogs.createdAt));
  }

  // ─── Notifications ────────────────────────────────────────────────────────
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async getAllNotifications(): Promise<Notification[]> {
    return db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, id));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  async clearAllNotifications(): Promise<void> {
    await db.delete(schema.notifications);
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [users, allHistory] = await Promise.all([
      db.select().from(schema.users),
      db.select().from(schema.searchHistory),
    ]);

    const todayHistory = allHistory.filter((h) => h.createdAt >= today);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentHistory = allHistory.filter((h) => h.createdAt >= oneHourAgo);
    const activeSessions = new Set(recentHistory.map((h) => h.userId)).size;

    return {
      totalUsers: users.length,
      queriesToday: todayHistory.length,
      apiQueries: allHistory.filter((h) => h.sourceType?.includes("API")).length,
      pdfQueries: allHistory.filter((h) => h.sourceType?.includes("PDF")).length,
      imageQueries: allHistory.filter((h) => h.sourceType?.includes("Image")).length,
      activeSessions,
    };
  }

  async getQueryAnalytics(): Promise<Array<{ name: string; queries: number; api: number }>> {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const analytics = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayHistory = await db.select().from(schema.searchHistory)
        .where(sql`${schema.searchHistory.createdAt} >= ${date} AND ${schema.searchHistory.createdAt} < ${nextDate}`);

      analytics.push({
        name: dayNames[date.getDay()],
        queries: dayHistory.length,
        api: dayHistory.filter((h) => h.sourceType?.includes("API")).length,
      });
    }

    return analytics;
  }
}

export const storage = new DbStorage();
