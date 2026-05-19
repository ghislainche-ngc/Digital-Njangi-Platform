import { TelegramNotificationService } from './TelegramNotificationService.js';
import { SMSNotificationService } from './SMSNotificationService.js';
// Mock service for local development
class MockNotificationService {
    async send(to, message) {
        console.log(`🛠️ [MOCK ONLY] Message to ${to}: ${message}`);
        return { success: true };
    }
}

export class NotificationFactory {
    static getService() {
        const mode = process.env.NODE_ENV || 'development';

        if (mode === 'production') {
            // Week 4: Using real Telegram service
            return new TelegramNotificationService();
        } else if (mode === 'sms') {
            return new SMSNotificationService();
        } else {
            // Default to mock so you don't waste SMS credits/API calls during dev
            return new MockNotificationService();
        }
    }
}