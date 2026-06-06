# UML Diagrams (Mermaid)

Here is the complete set of Eraser.io copy-paste Mermaid code blocks for all 9 diagrams (Use Case, Class, Object, Component, and the 5 Sequence diagrams).

To insert these in Eraser.io:
1. Click the (+) (Insert Menu) on your Eraser canvas.
2. Select Diagram-as-code and choose the diagram type (e.g. Flow chart, Class, Sequence).
3. Paste the corresponding code block into the side code editor panel.

---

## 1. UML Use Case Diagram
- Left Side: Primary Actors (users/officers) with Actor generalization.
- Middle Boundary: Use cases containing `<<include>>`, `<<extend>>` and generalization (incorporating Campay Gateway for OM/MTN).
- Right Side: Secondary Actors (External payment and message providers).

```mermaid
flowchart LR
    %% Primary Actors on the Left
    subgraph PrimaryActors ["Primary Actors (Users)"]
        Member["👤 Member"]
        President["👑 President"]
        Treasurer["💰 Treasurer"]
        Secretary["📝 Secretary"]
        PlatformAdmin["⚙️ Platform Admin"]
        
        %% Actor Generalization (hollow arrow pointing from specific to general)
        President --|> Member
        Treasurer --|> Member
        Secretary --|> Member
    end

    %% System Boundary
    subgraph SystemBoundary ["Njangi As A Service System Boundary"]
        %% Use cases
        UC_Auth(["Authenticate User"])
        UC_Ledger(["View Live Ledger"])
        UC_Pay(["Pay Contribution"])
        UC_PayCampay(["Pay via Campay Gateway"])
        UC_PayOM(["Pay via Orange Money"])
        UC_PayMoMo(["Pay via MTN MoMo"])
        
        %% Generalization between Use Cases (hollow arrowhead pointing to general use case)
        UC_PayCampay --|> UC_Pay
        UC_PayOM --|> UC_PayCampay
        UC_PayMoMo --|> UC_PayCampay

        %% Include Relationships (dashed arrows pointing to included case)
        UC_Pay -. "<<include>>" .-> UC_Auth
        UC_Ledger -. "<<include>>" .-> UC_Auth
        
        %% Base Use Case 2
        UC_Payout(["Approve Payout"])
        UC_VerifySig(["Verify President Password"])
        UC_Payout -. "<<include>>" .-> UC_VerifySig

        %% Base Use Case 3 & Extend
        UC_RecordCash(["Record Offline Cash Payment"])
        UC_ApplyFine(["Apply late Penalty Fine"])
        
        %% Extend (dashed arrow pointing from extending use case to base use case)
        UC_ApplyFine -. "<<extend>> (if payment is late)" .-> UC_RecordCash
        
        %% Other Use Cases
        UC_Invite(["Invite Member via Token"])
        UC_Minutes(["Record Meeting Minutes"])
        UC_Social(["Deposit to Social Fund"])
        UC_Tiers(["Configure SaaS Billing Tiers"])
        UC_Suspend(["Suspend / Unsuspend Group"])
        UC_SendAlerts(["Send Event Notifications"])
    end

    %% Secondary Actors on the Right
    subgraph SecondaryActors ["Secondary Actors (External Systems)"]
        CampayGateway["⚡ Campay Payment Gateway"]
        TelegramAPI["🤖 Telegram Bot API"]
        SMSProvider["💬 SMS Provider Gateway"]
    end

    %% Primary Actor to Use Case Associations
    Member --> UC_Ledger
    Member --> UC_Pay
    
    President --> UC_Invite
    President --> UC_Payout
    
    Treasurer --> UC_RecordCash
    Treasurer --> UC_Social
    
    Secretary --> UC_Minutes
    
    PlatformAdmin --> UC_Tiers
    PlatformAdmin --> UC_Suspend

    %% Use Case to Secondary Actor Associations
    UC_PayCampay --> CampayGateway
    UC_Payout --> CampayGateway
    UC_SendAlerts --> TelegramAPI
    UC_SendAlerts --> SMSProvider
    UC_Auth -.-> SMSProvider
```

---

## 2. UML Class Diagram (Showing All Relationships)
- Displays Visibilities (`+`, `-`, `#`, `~`), Generalization (`<|--`), Realization (`<|..`), Composition (`*--`), Aggregation (`o--`), Dependency (`..>`), and multiplicities.

```mermaid
classDiagram
    %% Core Classes
    class User {
        +id: UUID
        +email: String
        +phone: String
        +full_name: String
        #password_hash: String
        -telegram_chat_id: String
        +register(): void
        +login(): String
        +updateProfile(): void
    }

    class Group {
        +id: UUID
        +name: String
        +contribution_amount: Number
        +frequency: String
        +status: String
        ~subscription_tier: String
        +create(): void
        +updateSettings(): void
    }

    class Membership {
        +id: UUID
        +user_id: UUID
        +group_id: UUID
        +role: String
        +status: String
        +updateRole(): void
        +terminate(): void
    }

    class Contribution {
        +id: UUID
        +group_id: UUID
        +user_id: UUID
        +amount: Number
        +status: String
        +payment_method: String
        +record(): void
        +verify(): void
    }

    class Payout {
        +id: UUID
        +group_id: UUID
        +recipient_id: UUID
        +amount: Number
        +status: String
        +execute(): void
        +approve(): void
    }

    class SocialFund {
        +id: UUID
        +group_id: UUID
        +balance: Number
        +recordTransaction(): void
    }

    class AuditLog {
        +id: UUID
        +actor_id: UUID
        +action: String
        +entity: String
        +writeLog(): void
    }

    %% Abstract Strategy & Inheritance (Generalization)
    class RotationStrategy {
        <<abstract>>
        +computeNextRecipient(members: List)* String
    }
    class FixedRotationStrategy {
        +computeNextRecipient(members: List) String
    }
    class RandomDrawStrategy {
        +computeNextRecipient(members: List) String
    }
    RotationStrategy <|-- FixedRotationStrategy : Inheritance (Generalization)
    RotationStrategy <|-- RandomDrawStrategy : Inheritance (Generalization)

    %% Interface & Implementation (Realization)
    class INotificationService {
        <<interface>>
        +send(userId: UUID, message: String)* void
    }
    class TelegramNotificationService {
        +send(userId: UUID, message: String) void
    }
    class SMSNotificationService {
        +send(userId: UUID, message: String) void
    }
    INotificationService <|.. TelegramNotificationService : Realization
    INotificationService <|.. SMSNotificationService : Realization

    %% Dependency (dashed arrow)
    class PayoutEngine {
        -db: DBConnect
        -notificationService: INotificationService
        +executePayout(groupId: UUID, recipientId: UUID): void
    }
    PayoutEngine ..> INotificationService : Dependency

    %% Multiplicity and Structural Relationships (diamonds for composition and aggregation)
    User "1" *-- "0..*" Membership : Composition
    Group "1" *-- "0..*" Membership : Composition
    Group "1" *-- "1" SocialFund : Composition
    Group "1" o-- "0..*" Contribution : Aggregation
    Group "1" o-- "0..*" Payout : Aggregation
    User "1" --> "0..*" AuditLog : Directed Association
```

---

## 3. UML Object Diagram
- Snapshot of a live multi-tenant group setup showing 5 concrete User objects linked to memberships and social balances.

```mermaid
flowchart TD
    classDef objectInstance fill:#f9f9f9,stroke:#333,stroke-width:2px;
    classDef groupDef fill:#e8f5e9,stroke:#2e7d32,stroke-width:2.5px;

    GroupInst["<u>lesAmisGroup: Group</u><br/>id = 'group-100'<br/>name = 'Les Amis de Buea'<br/>contribution_amount = 10000<br/>frequency = 'monthly'<br/>status = 'active'"]:::groupDef

    User1["<u>ghislain: User</u><br/>id = 'user-1'<br/>full_name = 'Ghislain Che'<br/>email = 'ghislain@naas.app'"]:::objectInstance
    User2["<u>glory: User</u><br/>id = 'user-2'<br/>full_name = 'Glory PO'<br/>email = 'glory@naas.app'"]:::objectInstance
    User3["<u>member3: User</u><br/>id = 'user-3'<br/>full_name = 'Paul N.'<br/>email = 'paul@naas.app'"]:::objectInstance
    User4["<u>member4: User</u><br/>id = 'user-4'<br/>full_name = 'Ruth A.'<br/>email = 'ruth@naas.app'"]:::objectInstance
    User5["<u>member5: User</u><br/>id = 'user-5'<br/>full_name = 'Eric T.'<br/>email = 'eric@naas.app'"]:::objectInstance

    Mem1["<u>mem1: Membership</u><br/>role = 'president'<br/>status = 'active'"]:::objectInstance
    Mem2["<u>mem2: Membership</u><br/>role = 'treasurer'<br/>status = 'active'"]:::objectInstance
    Mem3["<u>mem3: Membership</u><br/>role = 'secretary'<br/>status = 'active'"]:::objectInstance
    Mem4["<u>mem4: Membership</u><br/>role = 'member'<br/>status = 'active'"]:::objectInstance
    Mem5["<u>mem5: Membership</u><br/>role = 'member'<br/>status = 'active'"]:::objectInstance

    SocialFundInst["<u>solFund: SocialFund</u><br/>id = 'sf-1'<br/>balance = 45000"]:::objectInstance

    %% Relationships
    GroupInst --- Mem1
    GroupInst --- Mem2
    GroupInst --- Mem3
    GroupInst --- Mem4
    GroupInst --- Mem5

    User1 --- Mem1
    User2 --- Mem2
    User3 --- Mem3
    User4 --- Mem4
    User5 --- Mem5

    GroupInst --- SocialFundInst
```

---

## 4. UML Component Diagram
- Models PWA client artifacts, API components, service layers, DB ports, and schema packages.

```mermaid
flowchart TD
    subgraph FrontendPackage ["Package: Frontend Client Application"]
        PWAComponent["🧩 PWA Web Client Component"]
        ClientJSArtifact["📄 client.js Artifact"]
        PWAComponent --- ClientJSArtifact
    end

    subgraph BackendPackage ["Package: Node.js/Express.js Backend Engine"]
        APIServerComponent["🧩 API Router Component"]
        HTTPPort(("Port: HTTP/REST Port"))
        ProvidedAPIInterface["🔌 Provided Interface: Group & Ledger REST API"]
        HTTPPort --- ProvidedAPIInterface
        APIServerComponent --> HTTPPort

        subgraph ServicePackage ["Package: Core Services Layer"]
            PaymentServiceComponent["🧩 Payment Service Component"]
            NotificationServiceComponent["🧩 Notification Service Component"]
            EngineComponent["🧩 Payout Engine Component"]
        end
    end

    subgraph DatabasePackage ["Package: Supabase Storage Layer"]
        PostgresComponent["🧩 PostgreSQL Database Component"]
        SchemaArtifact["📄 schema.sql Artifact"]
        PostgresComponent --- SchemaArtifact
    end

    %% Provided / Required Interface connectors
    ClientJSArtifact --> RequiredAPIInterface["🔌 Required Interface: API Connection"]
    RequiredAPIInterface -.-> ProvidedAPIInterface

    %% Internal Service Dependencies
    APIServerComponent -.-> Dependency1["Dependency"] .-> EngineComponent
    EngineComponent -.-> Dependency2["Dependency"] .-> PaymentServiceComponent
    EngineComponent -.-> Dependency3["Dependency"] .-> NotificationServiceComponent

    %% Database Ports
    DatabasePort(("Port: DB Connection Port (REST/SQL)"))
    PostgresComponent --> DatabasePort
    PaymentServiceComponent -.-> DatabasePort
    EngineComponent -.-> DatabasePort
```

---

## 5. UML Sequence Diagrams (5 Flows)

### Sequence Diagram 1: User Registration & OTP Verification
```mermaid
sequenceDiagram
    autonumber
    actor User as Member
    participant FE as Frontend Client
    participant BE as Express API Server
    participant DB as Supabase PostgreSQL

    User->>FE: Fill Email, Phone & Password
    activate FE
    FE->>BE: POST /auth/register
    activate BE
    BE->>DB: Check duplicate email/phone
    activate DB
    DB-->>BE: No duplicates
    deactivate DB
    BE->>DB: Insert User with password_hash
    activate DB
    DB-->>BE: User registered
    deactivate DB
    BE->>BE: Generate 6-digit OTP
    BE->>DB: Store OTP Code & Expiration
    activate DB
    DB-->>BE: OTP stored
    deactivate DB
    BE-->>FE: 201 Created (Prompt OTP screen)
    deactivate BE
    FE-->>User: Please verify your phone OTP
    deactivate FE

    User->>FE: Input 6-digit OTP
    activate FE
    FE->>BE: POST /auth/verify-otp
    activate BE
    BE->>DB: Fetch & match OTP code
    activate DB
    DB-->>BE: Valid OTP
    deactivate DB
    BE->>DB: Delete OTP record
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE->>BE: Generate stateless JWT Token
    BE-->>FE: 200 OK (JWT + User Profile details)
    deactivate BE
    FE->>FE: Save JWT & details in LocalStorage
    FE-->>User: Redirect to Member Onboarding
    deactivate FE
```

### Sequence Diagram 2: Group Creation & Subscription Onboarding
```mermaid
sequenceDiagram
    autonumber
    actor Pres as President
    participant FE as Frontend Client
    participant BE as Express API Server
    participant DB as Supabase PostgreSQL

    Pres->>FE: Input Group Name, Amount & Select Plan (e.g. Basic)
    activate FE
    FE->>BE: POST /groups
    activate BE
    BE->>BE: Enforce plan parameters check (e.g., Basic limit <= 50,000 FCFA)
    
    alt Guard: [Contribution exceeds Plan Limit]
        BE-->>FE: 400 Bad Request (TIER_LIMIT_BREACHED)
        FE-->>Pres: Display plan upgrade error
    else Guard: [Contribution is within limits]
        BE->>DB: Create Group record with tier and active status
        activate DB
        DB-->>BE: Group created
        deactivate DB
        BE->>DB: Create President Membership
        activate DB
        DB-->>BE: Membership initialized
        deactivate DB
        BE-->>FE: 201 Created
        FE-->>Pres: Redirect to Dashboard (President view)
    end
    deactivate BE
    deactivate FE
```

### Sequence Diagram 3: MoMo Contribution Collection (via Campay Gateway)
```mermaid
sequenceDiagram
    autonumber
    actor Mem as Member
    participant FE as Frontend Client
    participant BE as Express API Server
    participant Gateway as Campay Payment Gateway
    participant DB as Supabase PostgreSQL

    Mem->>FE: Click "Pay Contribution"
    activate FE
    FE->>BE: POST /groups/:id/contributions
    activate BE
    BE->>DB: Record contribution state as PENDING
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE->>Gateway: Initiate Request-To-Pay (Push USSD API)
    activate Gateway
    Gateway-->>BE: 202 Accepted (Transaction token)
    deactivate Gateway
    BE-->>FE: 202 Accepted (Payment initiated, start status polling)
    deactivate BE
    
    Note over FE,BE: Real-Time Checkout Polling (Every 3 seconds)
    loop Active Check
        FE->>BE: GET /groups/:id/my-contributions
        activate BE
        BE->>DB: Query contribution status
        activate DB
        DB-->>BE: Status (pending/success)
        deactivate DB
        BE-->>FE: Return payment status
        deactivate BE
    end

    Note over Gateway,BE: Async Callback Webhook Execution
    Gateway->>BE: POST /webhooks/campay (SUCCESS)
    activate BE
    BE->>BE: Verify cryptographic webhook signature
    BE->>DB: Update contribution status to SUCCESS
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE->>DB: Update Group Ledger (Append-only record)
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE->>BE: Trigger Multi-Channel Notifications (Telegram / SMS)
    deactivate BE
    
    FE-->>Mem: Show Success Receipt Card & Reload Dashboard
    deactivate FE
```

### Sequence Diagram 4: Payout Execution & Approvals
```mermaid
sequenceDiagram
    autonumber
    actor Pres as President
    participant FE as Frontend Client
    participant BE as Express API Server
    participant Engine as PayoutEngine
    participant Gateway as Campay API (Disbursement)
    participant DB as Supabase PostgreSQL

    Pres->>FE: Nominate Payout Recipient & Click "Approve Payout"
    activate FE
    FE->>BE: POST /groups/:id/payouts/execute
    activate BE
    BE->>Engine: Run parallel eligibility checks (Arrears, Fines, Duplicates)
    activate Engine
    Engine-->>BE: Payout Eligibility check passed
    deactivate Engine
    BE->>DB: Insert Payout record as PENDING_APPROVAL
    activate DB
    DB-->>BE: Done
    deactivate DB
    
    alt Guard: [Payout requires manual approval - Large Amount]
        BE-->>FE: 200 OK (Pending President signature)
        FE-->>Pres: Display manual approval panel
        Pres->>FE: Click "Approve Payout" (Confirms signature)
        FE->>BE: POST /groups/:id/payouts/approve
    end
    
    BE->>Gateway: Trigger Disbursement (Credit wallet)
    activate Gateway
    Gateway-->>BE: 200 OK (Disbursed)
    deactivate Gateway
    BE->>DB: Update Payout status to COMPLETED
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE->>DB: Append transaction to Ledger
    activate DB
    DB-->>BE: Done
    deactivate DB
    BE-->>FE: 200 OK (Payout disbursed successfully)
    deactivate BE
    FE-->>Pres: Show success card & reload ledger
    deactivate FE
```

### Sequence Diagram 5: Telegram Notification Handshake
```mermaid
sequenceDiagram
    autonumber
    actor User as Member
    participant TG as Telegram Bot Chat
    participant BE as Express API Server
    participant DB as Supabase PostgreSQL

    User->>TG: Message `/start user-123` (Deep link)
    activate TG
    TG->>BE: Telegram Bot API update (Webhooks / Polling)
    activate BE
    BE->>BE: Extract user-123 from start arguments
    BE->>DB: Update user.telegram_chat_id = chat.id
    activate DB
    DB-->>BE: User updated
    deactivate DB
    BE->>TG: Send confirmation message: "Linked successfully! 🎉"
    deactivate BE
    TG-->>User: Message displays on user's Telegram
    deactivate TG
```
