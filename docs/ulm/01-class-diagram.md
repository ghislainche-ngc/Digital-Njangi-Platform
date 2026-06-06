# Class Diagram - Digital Njangi Platform

```mermaid
classDiagram
    direction TB

    class User {
        +UUID id
        +String email
        +String phone
        +String full_name
        +String password_hash
        +String language
        +String telegram_chat_id
        +Boolean is_admin
        +String two_factor_secret
        +Boolean two_factor_enabled
        +DateTime created_at
        +DateTime updated_at
        +register()
        +verifyOTP(phone, code)
        +login()
        +generate2FASecret()
    }

    class NjangiGroup {
        +UUID id
        +String name
        +Numeric contribution_amount
        +String frequency
        +String rotation_type
        +Numeric penalty_per_day
        +Numeric payout_threshold_pct
        +String preferred_gateway
        +String subscription_tier
        +String subscription_status
        +DateTime subscription_expires_at
        +UUID created_by
        +DateTime created_at
        +createGroup()
        +updateSettings()
        +suspendGroup()
    }

    class Membership {
        +UUID id
        +UUID user_id
        +UUID group_id
        +String role ["member", "president", "treasurer", "secretary"]
        +Integer rotation_position
        +String status
        +DateTime joined_at
    }

    class Cycle {
        +UUID id
        +UUID group_id
        +Integer cycle_number
        +Date start_date
        +Date end_date
        +String status ["active", "completed", "pending"]
    }

    class Contribution {
        +UUID id
        +UUID cycle_id
        +UUID user_id
        +UUID group_id
        +Numeric amount
        +String status ["pending", "confirmed", "failed"]
        +String payment_method
        +String transaction_ref
        +DateTime confirmed_at
        +recordContribution()
        +confirmPayment()
    }

    class Payout {
        +UUID id
        +UUID cycle_id
        +UUID recipient_id
        +UUID group_id
        +Numeric amount
        +String delivery_method
        +String status
        +UUID approved_by
        +DateTime executed_at
        +initiatePayout()
        +approvePayout()
        +executePayout()
    }

    class Fine {
        +UUID id
        +UUID user_id
        +UUID group_id
        +Numeric amount
        +String reason
        +String status
        +applyFine()
    }

    User "1" --> "0..*" NjangiGroup : creates
    User "1" --> "0..*" Membership : has
    NjangiGroup "1" --> "1..*" Membership : has
    NjangiGroup "1" --> "0..*" Cycle : runs
    Cycle "1" --> "0..*" Contribution : contains
    Cycle "1" --> "0..1" Payout : produces
    User "1" --> "0..*" Contribution : makes
    User "1" --> "0..*" Payout : receives
    NjangiGroup "1" --> "0..*" Fine : applies