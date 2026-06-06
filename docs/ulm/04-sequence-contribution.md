# Sequence Diagram 2: Record Contribution with Mobile Money

```mermaid
sequenceDiagram
    participant Member
    participant Frontend
    participant ContributionController
    participant PaymentService
    participant Supabase
    participant MobileMoneyAPI

    Member->>Frontend: Select group + enter amount
    Frontend->>ContributionController: POST /contributions
    ContributionController->>PaymentService: initiatePayment()
    PaymentService->>MobileMoneyAPI: Request-to-Pay (MTN/Orange)
    MobileMoneyAPI-->>PaymentService: Transaction Reference
    PaymentService->>Supabase: Create pending Contribution + Transaction
    PaymentService-->>Frontend: Payment initiated

    MobileMoneyAPI->>PaymentService: Webhook (Payment Success)
    PaymentService->>Supabase: Update contribution status to "confirmed"
    PaymentService->>NotificationService: Send confirmation
    PaymentService-->>ContributionController: Success
    ContributionController-->>Frontend: Contribution recorded
    Frontend-->>Member: Success message + updated balance