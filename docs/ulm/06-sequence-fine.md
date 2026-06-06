# Sequence Diagram 4: Apply Fine

```mermaid
sequenceDiagram
    participant Officer
    participant Frontend
    participant FineController
    participant Supabase
    participant NotificationService

    Officer->>Frontend: Select member + fine reason + amount
    Frontend->>FineController: POST /fines
    FineController->>Supabase: Create new Fine record
    Supabase-->>FineController: Fine created successfully
    FineController->>NotificationService: Send notification to member
    FineController-->>Frontend: Fine applied
    Frontend-->>Officer: Success confirmation