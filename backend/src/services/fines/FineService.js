/**
 * FineService - Handles disciplinary financial records for the Njangi group.
 */

const FINE_TYPES = {
    LATE_ARRIVAL: 500,        // 500 XAF fine
    MISSING_MEETING: 2000,    // 2000 XAF fine
    LATE_CONTRIBUTION: 1000   // 1000 XAF fine
};

class FineService {
    constructor() {
        this.currency = "XAF";
    }

    /**
     * Creates a new fine record for a member
     */
    async createFine(memberId, type, customAmount = null) {
        const amount = customAmount || FINE_TYPES[type] || 0;
        
        if (amount === 0) {
            throw new Error("Invalid fine type or amount.");
        }

        const newFine = {
            memberId,
            amount: amount,
            type: type,
            status: 'UNPAID',
            createdAt: new Date().toISOString(),
            description: `Fine issued for ${type.replace('_', ' ').toLowerCase()}`
        };

        console.log("Fine successfully created:", newFine);
        return newFine;
    }

    /**
     * Calculates total outstanding fines for a member
     */
    async getTotalOwed(memberId, finesList = []) {
        return finesList
            .filter(f => f.memberId === memberId && f.status === 'UNPAID')
            .reduce((total, f) => total + f.amount, 0);
    }
}

module.exports = FineService;