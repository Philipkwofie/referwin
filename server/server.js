const path = require('path');
const fs = require('fs');

// Construct an absolute path to the .env file in the project root directory
const envPath = path.resolve(__dirname, '../.env');

// Load environment variables from the .env file.
// It's safe if the file doesn't exist; dotenv will just not load anything.
require('dotenv').config({ path: envPath });

const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const geoip = require('geoip-lite');
const mongoose = require('mongoose');
const { getLinkPreview } = require('link-preview-js');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const Database = require('./database');
const Admin = require('./models/Admin');
const WhatsAppSettings = require('./models/WhatsAppSettings');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { requireAdminAuth, requireMasterAuth } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database();

// --- Vercel DB Connection Middleware ---
// This middleware ensures the database is connected before any API route is handled.
const connectToDb = async (req, res, next) => {
  try {
    await db.connect(process.env.MONGO_URI);
    return next();
  } catch (error) {
    console.error('Database connection failed in middleware:', error);
    return res.status(500).json({ message: 'Database connection error.' });
  }
};
app.use('/api', connectToDb); // Apply middleware to all API routes

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.tiktok.com", "https://www.instagram.com", "https://youtube.com", "https://tiktok.com", "https://instagram.com"],
      connectSrc: ["'self'", "http://localhost:3000"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https://www.youtube.com", "https://www.tiktok.com", "https://www.instagram.com", "https://youtube.com", "https://tiktok.com", "https://instagram.com"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500 // limit each IP to 500 requests per windowMs
});
app.use(limiter);

// Middleware
const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' })); // Limit payload size
app.use(express.static(path.join(__dirname, '../client')));
 
// Session middleware
const sessionStore = process.env.MONGO_URI
  ? MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions'
    })
  : undefined;
 
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production', // Use env var in production
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// API Routes

// User Signup
app.post('/api/signup', [
  // --- Validation Rules ---
  body('username', 'Username must be at least 3 characters long').trim().isLength({ min: 3 }),
  body('email', 'Please provide a valid email address').isEmail().normalizeEmail(),
  body('password', 'Password must be between 8 and 16 characters long').isLength({ min: 8, max: 16 }),
  body('phone', 'Please provide a valid phone number').optional({ checkFalsy: true }).isMobilePhone('any')
], async (req, res) => {
  // --- Handle Validation Results ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, phone, referralCode } = req.body;
    const existingUser = await db.findUserByUsername(username) || await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this username or email already exists.' });
    }

    // Only pass expected fields to prevent mass assignment
    const newUser = await db.createUser({ username, email, password, phone });

    // Handle referral if code is provided
    if (referralCode) {
      const referrer = await db.findUserByUsername(referralCode);
      if (referrer) {
        await db.createReferral({ referrerId: referrer._id, referredId: newUser._id });
        referrer.referredUsers.push(newUser._id);
        await referrer.save();
      }
    }

    // Log the user in immediately after signup
    req.session.userId = newUser._id;

    res.status(201).json({ success: true, message: 'User created successfully', user: { id: newUser._id, username: newUser.username } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup.' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const user = await db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await db.verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Create session
    req.session.userId = user._id;

    res.status(200).json({ success: true, message: 'Logged in successfully', user: { id: user._id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await db.getUserNotifications(req.params.userId);
    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get user dashboard data
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const user = await db.findUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const downlines = await User.find({ '_id': { $in: user.referredUsers } });
    const activatedDownlines = downlines.filter(d => d.isActivated);
    const pendingDownlines = downlines.filter(d => !d.isActivated);

    res.json({
      username: user.username,
      isActivated: user.isActivated,
      activationFee: user.activationFee,
      earnings: user.earnings,
      referredUsers: user.referredUsers.length,
      referralLink: user.isActivated ? `${req.protocol}://${req.get('host')}/signup.html?ref=${user.referralCode}` : null,
      downlines: {
        activated: activatedDownlines,
        pending: pendingDownlines,
      },
      lastLinkViewDate: user.lastLinkViewDate
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get user withdrawals
app.get('/api/withdrawals/:userId', async (req, res) => {
  try {
    const withdrawals = await db.getUserWithdrawals(req.params.userId);
    res.json({ withdrawals });
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// User withdrawal request
app.post('/api/withdraw/:userId', async (req, res) => {
  const { amount } = req.body;
  const userId = req.params.userId;

  try {
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.earnings < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.earnings -= amount;
    await user.save();

    await db.createWithdrawal({ userId, amount });

    res.json({ message: 'Withdrawal request submitted successfully' });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// Change user password
app.post('/api/change-password/:userId', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await db.findUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    user.password = newPassword; // The pre-save hook will hash it
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get active ads for users
app.get('/api/ads', async (req, res) => {
  try {
    const ads = await db.getActiveAds();
    res.json({ ads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// Get today's link post for users
app.get('/api/linkposts/today', async (req, res) => {
  const today = new Date().toLocaleString('en-us', { weekday: 'long' }).toLowerCase();
  const linkPost = await db.getLinkPostByDay(today);
  res.json({ linkPost });
});

// Get link preview
app.get('/api/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const previewData = await getLinkPreview(url);
    res.json(previewData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch link preview' });
  }
});

// User earning from watching an ad
app.post('/api/user/earn-ad/:userId', async (req, res) => {
  const { adId } = req.body;
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has already watched this ad today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasWatched = user.adWatchHistory.some(
      (record) => record.adId.equals(adId) && record.date >= today
    );

    if (hasWatched) {
      return res.status(400).json({ error: 'You have already earned from this ad today.' });
    }

    const ad = await db.findAdById(adId);
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Determine reward amount
    let rewardAmount = 0.15; // Default
    if (ad.platform === 'youtube' || ad.platform === 'instagram') {
      rewardAmount = 0.2;
    }

    user.earnings += rewardAmount;
    user.adWatchHistory.push({ adId });
    await user.save();

    res.json({ message: `Ad watched! You earned GHS ${rewardAmount}!` });
  } catch (error) {
    console.error('Error earning from ad:', error);
    res.status(500).json({ error: 'Error processing earnings.' });
  }
});

// User earning from viewing a link
app.post('/api/user/earn-link/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.earnings += 0.05; // Example fixed earning for link views
    user.lastLinkViewDate = new Date();
    await user.save();

    res.json({ message: 'Link viewed successfully!', earned: 0.05 });
  } catch (error) {
    res.status(500).json({ error: 'Error processing link earnings.' });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Generate a secure, random token
    const token = crypto.randomBytes(32).toString('hex');

    // Save the token to the admin's record
    admin.token = token;
    await admin.save();

    // Return the token and role to the client
    res.status(200).json({ success: true, message: 'Admin logged in successfully', token, role: admin.role });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during admin login.' });
  }
});

// Admin Logout
app.post('/api/admin/logout', requireAdminAuth, async (req, res) => {
  req.admin.token = null; // Invalidate the token
  await req.admin.save();
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// Check admin session status
app.get('/api/admin/session-check', requireAdminAuth, (req, res) => {
  // If requireAdminAuth middleware passes, the session is valid.
  res.status(200).json({ success: true, message: 'Admin session is active.' });
});

// Check admin role
app.get('/api/admin/check-role', requireAdminAuth, (req, res) => {
  // The admin object is attached to the request by the middleware
  res.status(200).json({ role: req.admin.role });
});

// Admin - Get all users for management
app.get('/api/admin/all-users', requireAdminAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    // Map to a format that doesn't expose sensitive data if needed
    const userList = users.map(u => ({
      id: u._id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      isActivated: u.isActivated,
      earnings: u.earnings,
      referredUsers: u.referredUsers,
      signupDate: u.signupDate,
      withdrawals: [] // Placeholder, can be populated if needed
    }));
    res.json({ users: userList });
  } catch (error) {
    console.error('Error fetching all users for admin:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin - Get users (alias for all-users, for client compatibility)
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin - Get dashboard stats
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      totalSignups: stats.totalUsers,
      activated: stats.activatedUsers,
      unactivated: stats.unactivatedUsers,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Admin - Get withdrawals (more efficient)
app.get('/api/admin/withdrawals', requireAdminAuth, async (req, res) => {
  try {
    // Use aggregation to efficiently join user data with withdrawals
    const populatedWithdrawals = await mongoose.model('Withdrawal').aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          id: '$_id',
          username: { $ifNull: ['$user.username', 'Unknown'] },
          phone: { $ifNull: ['$user.phone', 'N/A'] },
          amount: 1,
          date: 1,
          status: 1,
          _id: 0
        }
      },
      { $sort: { date: -1 } }
    ]);
    res.json({ withdrawals: populatedWithdrawals });
  } catch (error) {
    console.error('Error fetching withdrawals for admin:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Admin - Activate a user
app.post('/api/admin/activate/:userId', requireAdminAuth, async (req, res) => {
  try {
    const success = await db.updateUser(req.params.userId, { isActivated: true });
    if (success) {
      res.json({ message: 'User activated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Admin - Deactivate a user
app.post('/api/admin/deactivate/:userId', requireAdminAuth, async (req, res) => {
  try {
    const success = await db.updateUser(req.params.userId, { isActivated: false });
    if (success) {
      res.json({ message: 'User deactivated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Admin - Mark withdrawal as paid
app.post('/api/admin/withdrawals/:withdrawalId/pay', requireAdminAuth, async (req, res) => {
  try {
    const success = await db.updateWithdrawal(req.params.withdrawalId, { status: 'completed' });
    if (success) {
      res.json({ message: 'Withdrawal marked as paid' });
    } else {
      res.status(404).json({ error: 'Withdrawal not found' });
    }
  } catch (error) {
    console.error('Error paying withdrawal:', error);
    res.status(500).json({ error: 'Failed to update withdrawal' });
  }
});

// Admin - Get online users
app.get('/api/admin/online-users', requireAdminAuth, async (req, res) => {
  try {
    const onlineUsers = await db.getOnlineUsers();
    const activatedOnline = onlineUsers.filter(u => u.isActivated).length;
    res.json({
      totalOnline: onlineUsers.length,
      activatedOnline: activatedOnline,
      nonActivatedOnline: onlineUsers.length - activatedOnline,
      onlineUsers: onlineUsers
    });
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

// Admin - Get leaderboard
app.get('/api/admin/leaderboard', requireAdminAuth, async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard();
    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Admin - Get/Update WhatsApp number
app.route('/api/admin/whatsapp')
  .get(async (req, res) => { // Removed requireAdminAuth to make it public
    try {
      let settings = await WhatsAppSettings.findOne();
      if (!settings) {
        settings = await WhatsAppSettings.create({ number: 'Please set a number' });
      }
      res.json({ number: settings.number });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get WhatsApp number' });
    }
  })
  .post(requireMasterAuth, async (req, res) => { // Only master admin can change
    try {
      const { number } = req.body;
      await WhatsAppSettings.findOneAndUpdate({}, { number }, { upsert: true });
      res.json({ message: 'WhatsApp number updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update WhatsApp number' });
    }
  });

// Admin - Send broadcast notification
app.post('/api/admin/send-notification', requireAdminAuth, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  try {
    const users = await db.getAllUsers();
    const notifications = users.map(user => ({
      userId: user._id,
      message: message,
      type: 'broadcast'
    }));
    await Notification.insertMany(notifications);
    res.json({ success: true, message: 'Broadcast notification sent to all users.' });
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Admin - Send individual notification
app.post('/api/admin/send-individual-notification', requireAdminAuth, async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required' });
  }
  try {
    await db.createNotification({ userId, message, type: 'individual' });
    res.json({ success: true, message: 'Individual message sent successfully.' });
  } catch (error) {
    console.error('Error sending individual notification:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Admin - Reward a user
app.post('/api/admin/reward/:username', requireAdminAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid reward amount' });
  }
  try {
    const user = await db.findUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.earnings += amount;
    await user.save();
    res.json({ message: `Successfully rewarded ${user.username} with GHS ${amount}` });
  } catch (error) {
    console.error('Error rewarding user:', error);
    res.status(500).json({ error: 'Failed to reward user' });
  }
});

// Admin - Get a specific user's downlines
app.get('/api/admin/user-downlines/:username', requireAdminAuth, async (req, res) => {
  try {
    const user = await db.findUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const downlines = await User.find({ '_id': { $in: user.referredUsers } });

    res.json({
      user: {
        username: user.username,
        isActivated: user.isActivated,
        totalDownlines: user.referredUsers.length,
        activatedDownlines: downlines.filter(d => d.isActivated).length
      },
      downlines: downlines.map(d => ({
        username: d.username,
        isActivated: d.isActivated,
        signupDate: d.signupDate,
        earnings: d.earnings
      }))
    });
  } catch (error) {
    console.error('Error fetching user downlines:', error);
    res.status(500).json({ error: 'Failed to fetch downlines' });
  }
});

// Admin - Link Post Management
app.route('/api/admin/linkposts')
  .get(requireAdminAuth, async (req, res) => {
    try {
      const linkPosts = await db.getLinkPosts();
      res.json({ linkPosts });
    } catch (error) {
      console.error('Error fetching link posts:', error);
      res.status(500).json({ error: 'Failed to fetch link posts' });
    }
  })
  .post(requireAdminAuth, async (req, res) => {
    try {
      const linkPost = await db.createLinkPost(req.body);
      res.status(201).json({ message: 'Link post created successfully', linkPost });
    } catch (error) {
      console.error('Error creating link post:', error);
      res.status(500).json({ error: 'Failed to create link post' });
    }
  });

app.route('/api/admin/linkposts/:id')
  .put(requireAdminAuth, async (req, res) => {
    const success = await db.updateLinkPost(req.params.id, req.body);
    res.json({ message: success ? 'Link post updated' : 'Link post not found' });
  })
  .delete(requireAdminAuth, async (req, res) => {
    const success = await db.deleteLinkPost(req.params.id);
    res.json({ message: success ? 'Link post deleted' : 'Link post not found' });
  });

// Admin - Get message stats
app.get('/api/admin/message-stats', requireAdminAuth, async (req, res) => {
  try {
    const total = await mongoose.model('Notification').countDocuments();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await mongoose.model('Notification').countDocuments({ date: { $gte: oneDayAgo } });
    res.json({ total, recent, old: total - recent });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({ error: 'Failed to fetch message stats' });
  }
});

// Admin - Admin Management (for master admins)
app.get('/api/admin/admins', requireMasterAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password -token');
    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Admin - Get all messages
app.get('/api/admin/all-messages', requireAdminAuth, async (req, res) => {
  try {
    const notifications = await db.getAllNotifications();
    const users = await db.getAllUsers();
    const userMap = users.reduce((acc, user) => {
      acc[user._id] = user.username;
      return acc;
    }, {});
    const populatedNotifications = notifications.map(n => ({
      ...n.toObject(),
      username: userMap[n.userId] || 'Unknown'
    }));
    res.json({ notifications: populatedNotifications });
  } catch (error) {
    console.error('Error fetching all messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Admin - Clear old notifications
app.post('/api/admin/clear-old-messages', requireAdminAuth, async (req, res) => {
  try {
    // You can adjust the number of recent messages to keep
    const keepCount = req.body.keepCount || 50;
    await db.clearOldNotifications(keepCount);
    res.json({ message: 'Old notifications cleared successfully.' });
  } catch (error) {
    console.error('Error clearing old notifications:', error);
    res.status(500).json({ error: 'Failed to clear old notifications' });
  }
});

// Admin - Serve admin page
app.get('/admin', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin-login.html')); // Assuming admin page is admin-login.html or create a dashboard
});

// --- Server Startup ---
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running locally on http://localhost:${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
