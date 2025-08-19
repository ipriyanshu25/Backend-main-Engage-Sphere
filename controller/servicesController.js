const Service = require('../model/services');
const { v4: uuidv4 } = require('uuid');

// Create a new service
exports.createService = async (req, res) => {
    try {
        const { serviceHeading, serviceDescription, serviceContent } = req.body;

        // Validate and parse serviceContent JSON
        let contentArray;
        try {
            contentArray = JSON.parse(serviceContent);
        } catch {
            return res.status(400).json({ error: 'serviceContent must be valid JSON' });
        }
        if (
            !Array.isArray(contentArray) ||
            !contentArray.every(item =>
                item &&
                typeof item.key === 'string' && item.key.trim()
            )
        ) {
            return res.status(400).json({
                error: 'serviceContent must be an array of { key: string }'
            });
        }

        // Create service document
        const svc = new Service({
            serviceHeading: serviceHeading.trim(),
            serviceDescription: serviceDescription.trim(),
            serviceContent: contentArray.map(item => ({
                contentId: uuidv4(),
                key: item.key.trim()
            }))
        });

        // Attach logo if uploaded
        if (req.file) {
            svc.logo = req.file.buffer.toString('base64');
        }

        await svc.save();
        return res.status(201).json({
            serviceId: svc.serviceId,
            serviceHeading: svc.serviceHeading,
            serviceDescription: svc.serviceDescription,
            serviceContent: svc.serviceContent,
            logo: svc.logo || null
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Get all services (pagination + optional search)
exports.getAllServices = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        const query = {};
        if (search) {
            const regex = { $regex: search, $options: 'i' };
            query.$or = [
                { serviceHeading: regex },
                { serviceDescription: regex },
                { 'serviceContent.key': regex }
            ];
        }

        const total = await Service.countDocuments(query);
        const services = await Service.find(query)
            .select('-_id -__v')
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        if (services.length === 0) {
            // Always 200, with an explicit message
            return res.status(200).json({
                message: 'No services found',
                total: 0,
                page: pageNum,
                totalPages: 0,
                data: []
            });
        }

        return res.status(200).json({
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: services
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Get one service by UUID
exports.getServiceById = async (req, res) => {
    try {
        const { serviceId } = req.body;
        if (!serviceId) {
            return res.status(400).json({ error: 'serviceId is required' });
        }
        const service = await Service.findOne({ serviceId }).select('-_id -__v');
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        return res.status(200).json(service);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Update an existing service (with optional logo replacement)
exports.updateService = async (req, res) => {
    try {
        const { serviceId, serviceHeading, serviceDescription, serviceContent } = req.body;
        if (!serviceId) return res.status(400).json({ error: 'serviceId is required' });

        const svc = await Service.findOne({ serviceId });
        if (!svc) return res.status(404).json({ error: 'Service not found' });

        if (typeof serviceHeading === 'string') {
            svc.serviceHeading = serviceHeading.trim();
        }
        if (typeof serviceDescription === 'string') {
            svc.serviceDescription = serviceDescription.trim();
        }

        if (serviceContent) {
            let contentArray;
            try {
                contentArray = JSON.parse(serviceContent);
            } catch {
                return res.status(400).json({ error: 'serviceContent must be valid JSON' });
            }
            if (
                !Array.isArray(contentArray) ||
                !contentArray.every(item =>
                    item &&
                    typeof item.key === 'string' && item.key.trim() &&
                    (item.contentId === undefined || typeof item.contentId === 'string')
                )
            ) {
                return res.status(400).json({
                    error: 'serviceContent must be an array of { contentId?: string, key: string }'
                });
            }

            contentArray.forEach(({ contentId, key }) => {
                const k = key.trim();
                if (contentId) {
                    const existing = svc.serviceContent.find(c => c.contentId === contentId);
                    if (existing) {
                        existing.key = k;
                    }
                } else {
                    svc.serviceContent.push({ contentId: uuidv4(), key: k });
                }
            });
        }

        // Replace logo if a new file is uploaded
        if (req.file) {
            svc.logo = req.file.buffer.toString('base64');
        }

        await svc.save();
        return res.status(200).json({
            serviceId: svc.serviceId,
            serviceHeading: svc.serviceHeading,
            serviceDescription: svc.serviceDescription,
            serviceContent: svc.serviceContent,
            logo: svc.logo || null
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Delete entire service
exports.deleteService = async (req, res) => {
    try {
        const { serviceId } = req.body;
        if (!serviceId) return res.status(400).json({ error: 'serviceId is required' });

        const deleted = await Service.findOneAndDelete({ serviceId });
        if (!deleted) return res.status(404).json({ error: 'Service not found' });

        return res.status(200).json({ message: 'Service deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Delete a single content item
exports.deleteServiceContent = async (req, res) => {
    try {
        const { serviceId, contentId } = req.body;
        if (!serviceId || !contentId) {
            return res.status(400).json({ error: 'serviceId and contentId are required' });
        }

        const svc = await Service.findOne({ serviceId });
        if (!svc) return res.status(404).json({ error: 'Service not found' });

        const origLen = svc.serviceContent.length;
        svc.serviceContent = svc.serviceContent.filter(c => c.contentId !== contentId);
        if (svc.serviceContent.length === origLen) {
            return res.status(404).json({ error: 'Content not found' });
        }

        await svc.save();
        const out = svc.toObject();
        delete out._id; delete out.__v;
        return res.status(200).json({
            message: 'Content deleted successfully',
            service: out
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
