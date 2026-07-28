import express from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { authController } from "./controllers/auth.controller.js";
import { syncController } from "./controllers/sync.controller.js";
import { ticketController } from "./controllers/ticket.controller.js";
import { wmsController } from "./controllers/wms.controller.js";
import { prisma } from "./db.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// API ROUTING DEFINITION
// ==========================================

// 1. Health check & Welcome
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the Claro O&M Platform V2 Backend API",
    health: "/health",
    version: "2.0.0"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

app.get("/api/v1/sync/status", async (req, res) => {
  try {
    const complaints = await prisma.complaint.count();
    const tickets = await prisma.ticket.count();
    const installations = await prisma.masterInstallation.count();
    const assignments = await prisma.ticketAssignment.count();
    const history = await prisma.ticketHistory.count();
    const engineers = await prisma.engineer.count();
    const users = await prisma.user.count();
    res.status(200).json({ complaints, tickets, installations, assignments, history, engineers, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Authentication routes
app.post("/api/v1/auth/register", authController.register);
app.post("/api/v1/auth/login", authController.login);
app.get("/api/v1/auth/me", authMiddleware.authenticateJWT, authController.me);

// 3. Google Form sheets sync endpoints (Secure webhook connection)
app.post(
  "/api/v1/sync/complaint",
  authMiddleware.authenticateIntegration,
  syncController.syncComplaint
);
app.post(
  "/api/v1/sync/visit",
  authMiddleware.authenticateIntegration,
  syncController.syncVisit
);
app.post(
  "/api/v1/sync/material-request",
  authMiddleware.authenticateIntegration,
  syncController.syncMaterialRequest
);
app.post(
  "/api/v1/sync/material-request-live",
  authMiddleware.authenticateIntegration,
  syncController.syncMaterialRequestLive
);
app.post(
  "/api/v1/sync/insurance",
  authMiddleware.authenticateIntegration,
  syncController.syncInsurance
);
app.post(
  "/api/v1/sync/service-report",
  authMiddleware.authenticateIntegration,
  syncController.syncServiceReport
);

app.post(
  "/api/v1/sync/full",
  authMiddleware.authenticateIntegration,
  syncController.syncFullSheet
);

// 4. Ticket management (Dashboard endpoints)
app.get(
  "/api/v1/tickets",
  authMiddleware.authenticateJWT,
  ticketController.listTickets
);
app.get(
  "/api/v1/tickets/:id",
  authMiddleware.authenticateJWT,
  ticketController.getTicketDetails
);
app.post(
  "/api/v1/tickets/:id/assign",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations"]),
  ticketController.assignEngineer
);
app.patch(
  "/api/v1/tickets/:id/status",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations"]),
  ticketController.updateStatus
);

app.get(
  "/api/v1/amc/metrics",
  authMiddleware.authenticateJWT,
  ticketController.getAMCMetrics
);

app.get(
  "/api/v1/engineers",
  authMiddleware.authenticateJWT,
  ticketController.listEngineers
);

app.get(
  "/api/v1/engineers/performance-summary",
  authMiddleware.authenticateJWT,
  ticketController.getAllEngineersPerformance
);

app.get(
  "/api/v1/engineers/:id/performance",
  authMiddleware.authenticateJWT,
  ticketController.getEngineerPerformance
);

app.get(
  "/api/v1/material-requests",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  ticketController.listMaterialRequests
);

app.patch(
  "/api/v1/material-requests/:id/status",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  ticketController.updateMaterialRequestStatus
);

// 5. WMS (Warehouse Management System) endpoints
app.get(
  "/api/v1/wms/parts",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getParts
);

app.get(
  "/api/v1/wms/warehouses",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getWarehouses
);

app.get(
  "/api/v1/wms/manufacturers",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getManufacturers
);

app.get(
  "/api/v1/wms/farmers",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getFarmers
);

app.get(
  "/api/v1/wms/engineers",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getEngineers
);

app.get(
  "/api/v1/wms/pending-rmas",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getPendingRMAs
);

app.get(
  "/api/v1/wms/challans",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getChallans
);

app.get(
  "/api/v1/wms/stock",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getStock
);

app.get(
  "/api/v1/wms/movements",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.getMovements
);

app.post(
  "/api/v1/wms/movements",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.logMovement
);

app.delete(
  "/api/v1/wms/movements/:id",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.deleteMovement
);

app.post(
  "/api/v1/wms/clear-all",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.clearAll
);

app.post(
  "/api/v1/wms/sync-requests",
  authMiddleware.authenticateJWT,
  authMiddleware.requireRole(["Admin", "Operations", "Warehouse"]),
  wmsController.syncRequests
);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(CONFIG.PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Claro O&M Platform Backend running on port ${CONFIG.PORT}`);
  console.log(`📍 Environment URL: http://localhost:${CONFIG.PORT}`);
  console.log(`=================================================`);
});
