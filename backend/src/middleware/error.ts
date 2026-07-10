import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler Catch:", err);
  
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(status).json({
    detail: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
};
