const fs = require('fs');
const path = require('path');
// Load environment variables from the root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Database = require('./database');

async function migrateData() {
  const db = new Database();

  try {
    await db.connect();

    // Load existing JSON data
    const dataPath = path.join(__dirname, 'data.json');
    if (!fs.existsSync(dataPath)) {
      console.log('No data.json file found, skipping migration');
      return;
    }

    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Starting data migration from JSON to MongoDB...');

    // Migrate users
    console.log('Migrating users...');
    for (const userData of jsonData.users) {
      try {
        const existingUser = await db.findUserByUsername(userData.username);
        if (!existingUser) {
          await db.createUser(userData);
          console.log(`Migrated user: ${userData.username}`);
        } else {
          console.log(`User ${userData.username} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating user ${userData.username}:`, error);
      }
    }

    // Migrate referrals
    console.log('Migrating referrals...');
    for (const referralData of jsonData.referrals) {
      try {
        const existingReferral = await db.findReferralByReferredId(referralData.referredId);
        if (!existingReferral) {
          await db.createReferral(referralData);
          console.log(`Migrated referral: ${referralData.referrerId} -> ${referralData.referredId}`);
        } else {
          console.log(`Referral for ${referralData.referredId} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating referral ${referralData.referredId}:`, error);
      }
    }

    // Migrate payments
    console.log('Migrating payments...');
    for (const paymentData of jsonData.payments) {
      try {
        const existingPayments = await db.getUserPayments(paymentData.userId);
        const exists = existingPayments.some(p => p.id === paymentData.id);
        if (!exists) {
          await db.createPayment(paymentData);
          console.log(`Migrated payment: ${paymentData.id}`);
        } else {
          console.log(`Payment ${paymentData.id} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating payment ${paymentData.id}:`, error);
      }
    }

    // Migrate withdrawals
    console.log('Migrating withdrawals...');
    for (const withdrawalData of jsonData.withdrawals) {
      try {
        const existingWithdrawal = await db.findWithdrawalById(withdrawalData.id);
        if (!existingWithdrawal) {
          await db.createWithdrawal(withdrawalData);
          console.log(`Migrated withdrawal: ${withdrawalData.id}`);
        } else {
          console.log(`Withdrawal ${withdrawalData.id} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating withdrawal ${withdrawalData.id}:`, error);
      }
    }

    // Migrate notifications
    console.log('Migrating notifications...');
    for (const notificationData of jsonData.notifications) {
      try {
        // Check if notification already exists by checking userId and message
        const userNotifications = await db.getUserNotifications(notificationData.userId);
        const exists = userNotifications.some(n =>
          n.message === notificationData.message &&
          n.date === notificationData.date
        );
        if (!exists) {
          await db.createNotification(notificationData);
          console.log(`Migrated notification for user: ${notificationData.userId}`);
        } else {
          console.log(`Notification for user ${notificationData.userId} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating notification for user ${notificationData.userId}:`, error);
      }
    }

    console.log('Migration completed successfully!');

    // Backup the original data.json
    const backupPath = path.join(__dirname, 'data.json.backup');
    fs.copyFileSync(dataPath, backupPath);
    console.log('Original data.json backed up to data.json.backup');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateData;
