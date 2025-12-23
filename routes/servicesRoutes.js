// routes/servicesRoutes.js
const express = require("express");
const router = express.Router();

const sc = require("../controller/servicesController");
const uploadLogo = require("../middleware/uploadLogo");

router.post("/create", uploadLogo.single("logo"), sc.createService);
router.post("/:serviceId/subservice/create", uploadLogo.single("logo"), sc.addSubService);

router.get("/getAll", sc.getAllServices);
router.post("/getById", sc.getServiceById);
router.post("/subservice/getById", sc.getSubServiceById);

router.post("/update", uploadLogo.single("logo"), sc.updateService);
router.post("/subservice/update", uploadLogo.single("logo"), sc.updateSubService);


module.exports = router;
