import { Request, Response } from "express";
import { wmsService } from "../services/wms.service.js";

export const wmsController = {
  async getParts(req: Request, res: Response) {
    try {
      const parts = await wmsService.getParts();
      return res.status(200).json(parts);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getWarehouses(req: Request, res: Response) {
    try {
      const warehouses = await wmsService.getWarehouses();
      return res.status(200).json(warehouses);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getManufacturers(req: Request, res: Response) {
    try {
      const manufacturers = await wmsService.getManufacturers();
      return res.status(200).json(manufacturers);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getFarmers(req: Request, res: Response) {
    try {
      const farmers = await wmsService.getFarmers();
      return res.status(200).json(farmers);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getEngineers(req: Request, res: Response) {
    try {
      const engineers = await wmsService.getEngineers();
      return res.status(200).json(engineers);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getPendingRMAs(req: Request, res: Response) {
    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) {
      return res.status(400).json({ detail: "Missing required 'warehouseId' query parameter." });
    }
    try {
      const pending = await wmsService.getPendingRMAReferences(warehouseId);
      return res.status(200).json(pending);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getChallans(req: Request, res: Response) {
    try {
      const challans = await wmsService.getChallans();
      return res.status(200).json(challans);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getStock(req: Request, res: Response) {
    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) {
      return res.status(400).json({ detail: "Missing required 'warehouseId' query parameter." });
    }
    try {
      const stock = await wmsService.getStock(warehouseId);
      return res.status(200).json(stock);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async getMovements(req: Request, res: Response) {
    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) {
      return res.status(400).json({ detail: "Missing required 'warehouseId' query parameter." });
    }
    try {
      const movements = await wmsService.getMovements(warehouseId);
      return res.status(200).json(movements);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async logMovement(req: any, res: Response) {
    const {
      warehouseId,
      stage,
      timestamp,
      partyName,
      referenceNumber,
      vehicleNumber,
      reportedFault,
      conditionReceived,
      lines
    } = req.body;

    if (!warehouseId || !stage || !partyName || !referenceNumber || !lines || lines.length === 0) {
      return res.status(400).json({ detail: "Missing required movement logging fields." });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ detail: "Unauthorized: User ID not found in session." });
      }

      const movement = await wmsService.logMovement({
        warehouseId,
        stage: Number(stage),
        timestamp: timestamp ? new Date(timestamp) : undefined,
        partyName,
        referenceNumber,
        vehicleNumber,
        reportedFault,
        conditionReceived,
        userId,
        lines
      });

      return res.status(201).json(movement);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async deleteMovement(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ detail: "Missing movement ID parameter." });
    }
    try {
      await wmsService.deleteMovement(id);
      return res.status(200).json({ detail: "Movement deleted successfully." });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async clearAll(req: Request, res: Response) {
    try {
      await wmsService.clearAll();
      return res.status(200).json({ detail: "All WMS transaction entries cleared successfully." });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  },

  async syncRequests(req: Request, res: Response) {
    try {
      const result = await wmsService.syncRequests();
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message });
    }
  }
};
