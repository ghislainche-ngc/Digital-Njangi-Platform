console.log("🚀 INITIALIZING NJANGI REPORT...");

class ReportService {
    async displayTest() {
        console.log("\n================================");
        console.log("💰 NJANGI LEDGER - WEEK 3");
        console.log("================================");
        
        const data = {
            GroupName: "Digital Njangi",
            Balance: "150,000 XAF",
            Status: "Immutable Ledger Active"
        };

        console.table(data);
        console.log("✅ REPORT GENERATED SUCCESSFULLY");
    }
}

// These lines are the 'Engine Start' button
const reporter = new ReportService();
reporter.displayTest();