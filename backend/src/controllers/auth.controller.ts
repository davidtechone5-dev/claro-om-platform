import { Request, Response } from "express";
import { prisma } from "../db.js";
import { helpers } from "../utils/helpers.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const authController = {
  /**
   * Register User (Standard Register Endpoint)
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    const { email, password, fullName, roleName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ detail: "Missing required fields: email, password, fullName" });
    }

    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ detail: "A user with this email already exists." });
      }

      // Look up role (default to Viewer role if none matches)
      let role = null;
      if (roleName) {
        role = await prisma.role.findFirst({
          where: { name: roleName, deletedAt: null }
        });
      }

      // If no role found, try finding or creating a default VIEWER role
      if (!role) {
        role = await prisma.role.findFirst({ where: { name: "Viewer" } });
        if (!role) {
          role = await prisma.role.create({
            data: { name: "Viewer", description: "Default Read-only viewer" }
          });
        }
      }

      // Hash password and create user
      const passwordHash = helpers.hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          roleId: role.id
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: {
            select: { name: true }
          }
        }
      });

      return res.status(201).json({
        user,
        detail: "User registered successfully."
      });
    } catch (e: any) {
      console.error("Registration error:", e);
      return res.status(500).json({ detail: `Internal Server Error: ${e.message}` });
    }
  },

  /**
   * User Login
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ detail: "Email and password are required." });
    }

    try {
      const user = await prisma.user.findFirst({
        where: { email, isActive: true, deletedAt: null },
        include: { role: true }
      });

      if (!user) {
        return res.status(401).json({ detail: "Invalid email credentials or user is inactive." });
      }

      const isMatch = helpers.comparePassword(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ detail: "Incorrect password." });
      }

      let engineerId = undefined;
      if (user.role?.name === "Engineer") {
        const eng = await prisma.engineer.findFirst({
          where: { email: user.email, deletedAt: null }
        });
        if (eng) {
          engineerId = eng.id;
        }
      }

      const token = helpers.generateToken({
        id: user.id,
        email: user.email,
        role: user.role?.name || "Viewer",
        engineerId
      });

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role?.name || "Viewer",
          engineerId
        }
      });
    } catch (e: any) {
      console.error("Login error:", e);
      return res.status(500).json({ detail: `Internal Server Error: ${e.message}` });
    }
  },

  /**
   * Get Current Authenticated User Detail
   * GET /api/v1/auth/me
   */
  async me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ detail: "Not authenticated" });
    }
    
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: { select: { name: true } }
        }
      });

      if (!user) {
        return res.status(404).json({ detail: "User not found" });
      }

      let engineerId = undefined;
      if (user.role?.name === "Engineer") {
        const eng = await prisma.engineer.findFirst({
          where: { email: user.email, deletedAt: null }
        });
        if (eng) {
          engineerId = eng.id;
        }
      }

      return res.status(200).json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name || "Viewer",
        engineerId
      });
    } catch (e: any) {
      return res.status(500).json({ detail: e.message });
    }
  }
};
