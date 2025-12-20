// routes/servicesRoutes.js
const express = require("express");
const router = express.Router();

const sc = require("../controller/servicesController");
const uploadLogo = require("../middleware/uploadLogo");

router.post("/create", uploadLogo.single("logo"), sc.createService);
router.post("/:serviceId/subservice/create", uploadLogo.single("logo"), sc.addSubService);

router.get("/getAll", sc.getAllServices);
router.post("/service/getById", sc.getServiceById);
router.post("/subservice/getById", sc.getSubServiceById);

module.exports = router;
