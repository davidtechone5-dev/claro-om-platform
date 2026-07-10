import { Request, Response, NextFunction } from "express";
import { helpers } from "../utils/helpers.js";
import { CONFIG } from "../config.js";
import { prisma } from "../db.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = {
  // Verifies User JWT Token for Dashboard API calls
  async authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ detail: "Access Token is missing or invalid" });
    }
    
    const token = authHeader.split(" ")[1];

    // Mock token bypass for local development/testing convenience
    if (token === "mock_token_admin") {
      try {
        const admin = await prisma.user.findFirst({
          where: { role: { name: "Admin" } }
        });
        req.user = {
          id: admin ? admin.id : "admin-default-id",
          email: admin ? admin.email : "admin@claro.com",
          role: "Admin"
        };
        return next();
      } catch (err) {
        // Fallback to offline mock ID if DB is not reachable
        req.user = {
          id: "admin-default-id",
          email: "admin@claro.com",
          role: "Admin"
        };
        return next();
      }
    }
    
    const decoded = helpers.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ detail: "Token is invalid or expired" });
    }
    
    req.user = decoded;
    next();
  },

  // Verifies Secret Header Key for incoming Google Apps Script webhooks
  authenticateIntegration(req: Request, res: Response, next: NextFunction) {
    const secretHeader = req.headers["x-claro-secret"];
    if (!secretHeader || secretHeader !== CONFIG.INTEGRATION_SECRET) {
      return res.status(403).json({ detail: "Forbidden: Invalid integration token" });
    }
    next();
  },

  // RBAC Permission Check
  requireRole(allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ detail: "Unauthorized" });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ detail: "Forbidden: You do not have permission" });
      }
      next();
    };
  }
};
