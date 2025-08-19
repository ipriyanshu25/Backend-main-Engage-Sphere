// routes/serviceRoutes.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteServiceContent,
  deleteService
} = require('../controller/servicesController');

// Multer in‐memory storage for logo
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// attach `req.file` for create & update
router.post('/create', upload.single('logo'), createService);
router.get('/getAll',       getAllServices);
router.post('/getById',     getServiceById);
router.post('/update',      upload.single('logo'), updateService);
router.post('/deleteContent', deleteServiceContent);
router.post('/delete',      deleteService);

module.exports = router;
