const FineService = require('./FineService');
const fines = new FineService();

async function runTest() {
    console.log("--- Starting Fine Module Test ---");
    
    // Simulate creating a fine for a member
    const lateFine = await fines.createFine("Member_001", "LATE_ARRIVAL");
    console.log(`Success! Amount: ${lateFine.amount} ${fines.currency}`);

    // Check total owed
    const total = await fines.getTotalOwed("Member_001", [lateFine]);
    console.log(`Total Owed for Member_001: ${total} ${fines.currency}`);
}

runTest();