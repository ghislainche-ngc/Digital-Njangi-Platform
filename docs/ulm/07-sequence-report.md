# Sequence Diagram 5: Generate PDF Report

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant ReportController
    participant ReportService
    participant Supabase
    participant PDFGenerator

    User->>Frontend: Click "Generate Report" button
    Frontend->>ReportController: GET /reports/contributions?groupId=xxx
    ReportController->>Supabase: Fetch group members, contributions & payouts
    ReportController->>ReportService: prepareReportData()
    ReportService->>PDFGenerator: generateContributionsPDF(data)
    PDFGenerator-->>ReportService: PDF buffer created
    ReportService-->>ReportController: Report ready
    ReportController-->>Frontend: Return PDF file
    Frontend-->>User: Download PDF report