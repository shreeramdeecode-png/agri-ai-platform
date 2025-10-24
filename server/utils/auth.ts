import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}
