# Sequence Diagram 3: Cycle Payout Process

```mermaid
sequenceDiagram
    participant Treasurer
    participant Frontend
    participant PayoutController
    participant PayoutEngine
    participant Supabase
    participant PaymentService

    Treasurer->>Frontend: Initiate payout for current cycle
    Frontend->>PayoutController: POST /payouts
    PayoutController->>PayoutEngine: executePayout(cycleId)
    PayoutEngine->>Supabase: Verify all contributions are complete
    PayoutEngine->>Supabase: Get next recipient by rotation order
    PayoutEngine->>PaymentService: Disburse funds via preferred gateway
    PaymentService->>Supabase: Log payout transaction
    PaymentService-->>PayoutEngine: Success
    PayoutEngine->>Supabase: Mark cycle as completed + create new cycle
    PayoutEngine-->>PayoutController: Payout successful
    PayoutController-->>Frontend: Success notification
    Frontend-->>Treasurer: Payout completed