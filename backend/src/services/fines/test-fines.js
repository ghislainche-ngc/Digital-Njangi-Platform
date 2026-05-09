const FineService = require('./fines/FineService');
const SocialFundService = require('./socialFund/SocialFundService');

async function generateMemberReport(memberId) {
    const fines = new FineService();
    const social = new SocialFundService();

    console.log(`\n--- 📊 GENERATING REPORT FOR: ${memberId} ---`);

    // 1. Check Fines
    const lateFine = await fines.createFine(memberId, "LATE_ARRIVAL");
    
    // 2. Record Social Fund Payment
    const payment = await social.recordPayment(memberId, 1000);

    // 3. The "Dashboard" View
    console.log("\n--- 📋 MEMBER STATUS ---");
    console.table([
        { Category: "Fines Owed", Value: `${lateFine.amount} XAF` },
        { Category: "Social Fund", Value: `${payment.amount} XAF (Received)` },
        { Category: "Account Status", Value: "✅ Active" }
    ]);
    
    console.log("------------------------------------------\n");
}

generateMemberReport("User_Glory");