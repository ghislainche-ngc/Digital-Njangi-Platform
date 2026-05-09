const TelegramService = require('../notification/TelegramNotificationService');

class SocialFundService {
    constructor() {
        this.monthlyDues = 1000; // Example: 1000 XAF per month
        this.notifier = new TelegramService();
    }

    /**
     * Record a payment into the social fund
     */
    async recordPayment(memberId, amount) {
        const payment = {
            memberId,
            amount,
            date: new Date().toISOString(),
            type: 'SOCIAL_FUND'
        };

        console.log(`💰 Social Fund payment recorded: ${amount} XAF for ${memberId}`);

        // Notify the member
        const message = `🤝 *Social Fund Update*\nThank you ${memberId}!\nPayment of ${amount} XAF received.`;
        
        try {
            await this.notifier.sendNotification(memberId, message);
        } catch (err) {
            console.log("Notification skipped for social payment.");
        }

        return payment;
    }
}

module.exports = SocialFundService;