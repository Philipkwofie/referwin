const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Referral = require('./models/Referral');
const Payment = require('./models/Payment');
const Withdrawal = require('./models/Withdrawal');
const Notification = require('./models/Notification');
const Ad = require('./models/Ad');
const LinkPost = require('./models/LinkPost');

class Database {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  async connect(uri = process.env.MONGO_URI) {
    try {
      // Defensively check and clean the URI
      if (!uri || typeof uri !== 'string') {
        throw new Error('MongoDB connection URI is missing, invalid, or not a string.');
      }
      // Trim whitespace and remove any surrounding quotes (single or double)
      let cleanUri = uri.trim().replace(/^['"]|['"]$/g, '');

      // For development, use in-memory MongoDB if available
      if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_DB) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        // Re-assign the in-memory URI. Changed cleanUri to let.
        cleanUri = mongod.getUri();
        console.log('Using in-memory MongoDB for testing');
      }

      await mongoose.connect(cleanUri);
      this.db = mongoose.connection.db;
      this.isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  // User operations
  async createUser(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await User.create({ ...userData, password: hashedPassword });
    return user;
  }

  async findUserByUsername(username) {
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    return user;
  }

  async findUserById(id) {
    const user = await User.findById(id);
    return user;
  }

  async findUserByEmail(email) {
    const user = await User.findOne({ email });
    return user;
  }

  async updateUser(id, updateData) {
    const user = await User.findByIdAndUpdate(id, updateData, { new: true }); // {new: true} returns the updated document
    return !!user; // Return true if user was found and updated, false otherwise
  }

  async getAllUsers() {
    const users = await User.find({});
    return users;
  }

  async getActivatedUsers() {
    const users = await User.find({ isActivated: true });
    return users;
  }

  async getOnlineUsers() {
    const users = await User.find({ isOnline: true });
    return users;
  }

  // Referral operations
  async createReferral(referralData) {
    const referral = await Referral.create(referralData);
    return referral;
  }

  async findReferralByReferredId(referredId) {
    const referral = await Referral.findOne({ referredId });
    return referral;
  }

  async getUserReferrals(userId) {
    const referrals = await Referral.find({ referrerId: userId });
    return referrals;
  }

  // Payment operations
  async createPayment(paymentData) {
    const payment = await Payment.create(paymentData);
    return payment;
  }

  async getUserPayments(userId) {
    const payments = await Payment.find({ userId });
    return payments;
  }

  // Withdrawal operations
  async createWithdrawal(withdrawalData) {
    const withdrawal = await Withdrawal.create(withdrawalData);
    return withdrawal;
  }

  async findWithdrawalById(id) {
    const withdrawal = await Withdrawal.findById(id);
    return withdrawal;
  }

  async updateWithdrawal(id, updateData) {
    const withdrawal = await Withdrawal.findByIdAndUpdate(id, updateData, { new: true });
    return !!withdrawal;
  }

  async getUserWithdrawals(userId) {
    const withdrawals = await Withdrawal.find({ userId });
    return withdrawals;
  }

  async getAllWithdrawals() {
    const withdrawals = await Withdrawal.find({});
    return withdrawals;
  }

  // Notification operations
  async createNotification(notificationData) {
    const notification = await Notification.create(notificationData);
    return notification;
  }

  async getAllNotifications() {
    const notifications = await Notification.find({}).sort({ date: -1 });
    return notifications;
  }

  async getUserNotifications(userId) {
    const notifications = await Notification.find({ userId }).sort({ date: -1 });
    return notifications;
  }

  async clearOldNotifications(keepCount = 10) {
    // Find the _id of the (keepCount + 1)th oldest notification
    const oldestNotifications = await Notification.find({})
      .sort({ date: 1 }) // Sort by date ascending (oldest first)
      .skip(keepCount) // Skip the 'keepCount' newest notifications
      .select('_id'); // Only select the _id field

    if (oldestNotifications.length > 0) {
      const idsToDelete = oldestNotifications.map(n => n._id);
      await Notification.deleteMany({ _id: { $in: idsToDelete } });
    }
  }

  // Utility methods
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async getStats() {
    const totalUsers = await User.countDocuments();
    const activatedUsers = await User.countDocuments({ isActivated: true });
    const totalPayments = await Payment.countDocuments();
    const totalWithdrawals = await Withdrawal.countDocuments();
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    const usersWithPayments = await this.getUsersWithPaymentsCount();

    return {
      totalUsers,
      activatedUsers,
      unactivatedUsers: totalUsers - activatedUsers,
      totalPayments,
      totalWithdrawals,
      pendingWithdrawals,
      usersWithPayments
    };
  }

  async getLeaderboard() {
    // Use Mongoose aggregation to efficiently calculate activated downlines
    const leaderboard = await User.aggregate([
      {
        $lookup: {
          from: 'users', // The collection to join with (User model's collection name)
          localField: 'referredUsers', // Field from the input documents (User.referredUsers array)
          foreignField: '_id', // Field from the "from" documents (User._id)
          as: 'downlines' // Output array field
        }
      },
      {
        $addFields: {
          activatedDownlines: {
            $size: {
              $filter: {
                input: '$downlines',
                as: 'downline',
                cond: { '$eq': ['$$downline.isActivated', true] }
              }
            }
          },
          totalDownlines: { $size: '$referredUsers' }
        }
      },
      {
        $match: {
          activatedDownlines: { $gt: 0 } // Only include users with activated downlines
        }
      },
      {
        $project: {
          username: 1,
          activatedDownlines: 1,
          totalDownlines: 1,
          earnings: 1,
          _id: 0 // Exclude _id from the final output
        }
      },
      { $sort: { activatedDownlines: -1 } },
      { $limit: 10 }
    ]);
    return leaderboard;
  }

  async getUsersWithPaymentsCount() {
    return (await Payment.distinct('userId')).length;
  }

  // Ad operations
  async createAd(adData) {
    const ad = await Ad.create(adData);
    return ad;
  }

  async getActiveAds() {
    const ads = await Ad.find({ isActive: true }).sort({ createdAt: -1 });
    return ads;
  }

  async getAllAds() {
    const ads = await Ad.find({}).sort({ createdAt: -1 });
    return ads;
  }

  async updateAd(id, updateData) {
    const ad = await Ad.findByIdAndUpdate(id, updateData, { new: true });
    return !!ad;
  }

  async deleteAd(id) {
    const result = await Ad.findByIdAndDelete(id);
    return !!result; // Returns the deleted document, so check if it exists
  }

  // LinkPost operations
  async createLinkPost(linkPostData) {
    const linkPost = await LinkPost.create(linkPostData);
    return linkPost;
  }

  async getLinkPosts() {
    const linkPosts = await LinkPost.find({}).sort({ createdAt: -1 });
    return linkPosts;
  }

  async getLinkPostByDay(day) {
    const linkPost = await LinkPost.findOne({ day });
    return linkPost;
  }

  async updateLinkPost(id, updateData) {
    const linkPost = await LinkPost.findByIdAndUpdate(id, updateData, { new: true });
    return !!linkPost;
  }

  async deleteLinkPost(id) {
    const result = await LinkPost.findByIdAndDelete(id);
    return !!result;
  }

  async getActiveLinkPosts() {
    const linkPosts = await LinkPost.find({ autoPost: true, posted: false });
    return linkPosts;
  }

  async findAdById(id) {
    const ad = await Ad.findById(id);
    return ad;
  }
}

module.exports = Database;
