import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";

export const helpers = {
  hashPassword(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  },

  comparePassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  },

  generateToken(payload: object): string {
    return jwt.sign(payload, CONFIG.JWT_SECRET, {
      expiresIn: CONFIG.JWT_EXPIRATION as any
    });
  },

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, CONFIG.JWT_SECRET);
    } catch (e) {
      return null;
    }
  }
};
