// controller/servicesController.js
const Services = require("../model/services");

const makeLogoPath = (req) => {
  if (!req.file) return null;
  return `/uploads/logos/${req.file.filename}`;
};

// POST /service/create
exports.createService = async (req, res) => {
  try {
    const { serviceHeading, serviceDescription } = req.body;

    if (!serviceHeading || !serviceDescription) {
      return res.status(400).json({
        message: "serviceHeading and serviceDescription are required",
      });
    }

    const doc = new Services({
      serviceHeading,
      serviceDescription,
      logo: makeLogoPath(req),
    });

    await doc.save();

    return res.status(201).json({
      message: "Service created successfully",
      serviceId: doc.serviceId,
      data: doc,
    });
  } catch (err) {
    console.error("createService error:", err);
    if (err?.code === 11000) return res.status(409).json({ message: "Duplicate key error" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /service/:serviceId/subservice/create
exports.addSubService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { subServiceHeading, subServiceDescription, subServiceContent } = req.body;

    if (!serviceId) return res.status(400).json({ message: "serviceId is required" });
    if (!subServiceHeading || !subServiceDescription) {
      return res.status(400).json({
        message: "subServiceHeading and subServiceDescription are required",
      });
    }

    const service = await Services.findOne({ serviceId });
    if (!service) return res.status(404).json({ message: "Service not found" });

    // form-data sends JSON arrays as string, so parse safely
    let parsedContent = [];
    if (subServiceContent) {
      try {
        parsedContent = typeof subServiceContent === "string"
          ? JSON.parse(subServiceContent)
          : subServiceContent;
      } catch (e) {
        return res.status(400).json({ message: "subServiceContent must be a valid JSON array" });
      }
    }

    service.subServices.push({
      subServiceHeading,
      subServiceDescription,
      logo: makeLogoPath(req),
      subServiceContent: Array.isArray(parsedContent) ? parsedContent : [],
    });

    await service.save();

    const created = service.subServices[service.subServices.length - 1];

    return res.status(201).json({
      message: "SubService added successfully",
      serviceId: service.serviceId,
      subServiceId: created.subServiceId,
      data: created,
    });
  } catch (err) {
    console.error("addSubService error:", err);
    if (err?.code === 11000) return res.status(409).json({ message: "Duplicate subServiceId" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /service/getAll
exports.getAllServices = async (req, res) => {
  try {
    const data = await Services.find().sort({ createdAt: -1 });
    return res.status(200).json({ data });
  } catch (err) {
    console.error("getAllServices error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /service/getById  { serviceId }
exports.getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) return res.status(400).json({ message: "serviceId is required" });

    const data = await Services.findOne({ serviceId });
    if (!data) return res.status(404).json({ message: "Service not found" });

    return res.status(200).json({ data });
  } catch (err) {
    console.error("getServiceById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


// POST /service/subservice/getById  { serviceId, subServiceId }
exports.getSubServiceById = async (req, res) => {
  try {
    const { serviceId, subServiceId } = req.body;

    if (!serviceId || !subServiceId) {
      return res.status(400).json({
        message: "serviceId and subServiceId are required",
      });
    }

    const service = await Services.findOne({ serviceId });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const sub = service.subServices?.find((s) => s.subServiceId === subServiceId);

    if (!sub) {
      return res.status(404).json({ message: "SubService not found" });
    }

    return res.status(200).json({
      message: "SubService fetched successfully",
      serviceId: service.serviceId,
      subServiceId: sub.subServiceId,
      data: sub,
    });
  } catch (err) {
    console.error("getSubServiceById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
