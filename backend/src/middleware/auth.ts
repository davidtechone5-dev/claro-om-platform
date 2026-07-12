import { Request, Response, NextFunction } from "express";
import { helpers } from "../utils/helpers.js";
import { CONFIG } from "../config.js";
import { prisma } from "../db.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    engineerId?: string;
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

    if (token === "mock_token_engineer") {
      try {
        const engineer = await prisma.engineer.findFirst({
          where: { deletedAt: null }
        });
        const user = engineer ? await prisma.user.findUnique({ where: { email: engineer.email } }) : null;
        req.user = {
          id: user ? user.id : "engineer-default-id",
          email: engineer ? engineer.email : "engineer@claro.com",
          role: "Engineer",
          engineerId: engineer ? engineer.id : "engineer-default-profile-id"
        };
        return next();
      } catch (err) {
        req.user = {
          id: "engineer-default-id",
          email: "engineer@claro.com",
          role: "Engineer",
          engineerId: "engineer-default-profile-id"
        };
        return next();
      }
    }
    
    const decoded = helpers.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ detail: "Token is invalid or expired" });
    }
    
    req.user = decoded;

    // Attach engineer profile if the role is Engineer
    if (req.user && req.user.role === "Engineer") {
      try {
        const engineer = await prisma.engineer.findFirst({
          where: {
            OR: [
              { userId: req.user.id },
              { email: req.user.email }
            ],
            deletedAt: null
          }
        });
        if (engineer) {
          req.user.engineerId = engineer.id;
        }
      } catch (err) {
        console.error("Error looking up engineer in auth middleware:", err);
      }
    }
    
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
