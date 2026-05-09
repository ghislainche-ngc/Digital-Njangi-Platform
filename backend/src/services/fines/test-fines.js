// 1. Import the Telegram service
const TelegramService = require('../notification/TelegramNotificationService');

const FINE_TYPES = {
    LATE_ARRIVAL: 500,
    MISSING_MEETING: 2000,
    LATE_CONTRIBUTION: 1000
};

class FineService {
    constructor() {
        this.currency = "XAF";
        // 2. Initialize the notification service
        this.notifier = new TelegramService();
    }

    async createFine(memberId, type, customAmount = null) {
        const amount = customAmount || FINE_TYPES[type] || 0;
        
        if (amount === 0) throw new Error("Invalid fine type.");

        const newFine = {
            memberId,
            amount,
            type,
            createdAt: new Date().toISOString()
        };

        // 3. Send the notification!
        const message = `🚨 *New Fine Issued*\nMember: ${memberId}\nAmount: ${amount} ${this.currency}\nReason: ${type.replace('_', ' ')}`;
        
        try {
            await this.notifier.sendNotification(memberId, message);
            console.log("✅ Fine created and Notification sent!");
        } catch (err) {
            console.log("⚠️ Fine created, but notification failed (check your .env/Token).");
        }

        return newFine;
    }
}

module.exports = FineService;