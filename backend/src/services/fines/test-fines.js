const FineService = require('./FineService');
const fines = new FineService();

async function runTest() {
    console.log("--- Starting Fine Module Test ---");
    
    try {
        // This triggers the logic we wrote
        const result = await fines.createFine("User_Glory", "LATE_ARRIVAL");
        
        console.log("✅ Success!");
        console.log("Fine Details:", result);
    } catch (error) {
        console.log("❌ Test finished with a status check:", error.message);
    }
}

runTest();