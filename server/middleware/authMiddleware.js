const Admin = require('../models/Admin');

const requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Find an admin with the provided token
    const admin = await Admin.findOne({ token });

    if (!admin || !admin.token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach the admin to the request object for use in other routes
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const requireMasterAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const admin = await Admin.findOne({ token });

    if (!admin || admin.role !== 'master') {
      return res.status(403).json({ error: 'Access denied. Master admin required.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Master auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { requireAdminAuth, requireMasterAuth };
