## UML Diagrams

Below are polished Mermaid definitions for a set of UML diagrams representing the Digital Njangi Platform.

### Class Diagram

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#f8f0e3','edgeLabelBackground':'#ffffff','tertiaryColor':'#efdfb6'}}}%%
classDiagram
    direction LR
    class User {
      +String id
      +String name
      +String email
      +register()
      +login()
    }
    class Group {
      +String id
      +String name
      +createRotation()
    }
    class Contribution {
      +String id
      +Decimal amount
      +Date date
      +status
    }
    class Payout {
      +String id
      +Decimal amount
      +Date date
      +processPayout()
    }
    class Notification {
      +String id
      +String type
      +send()
    }
    User "1" o-- "*" Group : memberOf
    User --> Contribution : makes
    Contribution --> Group : for
    Group --> Payout : schedules
    Payout --> User : pays
    User --> Notification : receives
```

### Use Case Diagram

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#eef7f2','edgeLabelBackground':'#ffffff','tertiaryColor':'#c6e5d0'}}}%%
graph LR
    actor_M(Member)
    actor_P(President)
    actor_T(Treasurer)
    actor_A(Admin)

    Register((Register))
    Contribute((Make Contribution))
    RequestPayout((Request Payout))
    ApprovePayout((Approve Payout))
    ViewReports((View Reports))
    ManageMembers((Manage Members))

    actor_M --> Register
    actor_M --> Contribute
    actor_M --> RequestPayout
    actor_P --> ApprovePayout
    actor_T --> ApprovePayout
    actor_A --> ManageMembers
    actor_P --> ViewReports
```

### Object Diagram (runtime snapshot)

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#fef6e4','edgeLabelBackground':'#ffffff','tertiaryColor':'#f6e2ac'}}}%%
graph LR
    user1["user1 : User\n{id='u123', name='Alice', role='Member'}"]
    group1["group1 : Group\n{id='g1', name='Market St Njangi'}"]
    contrib1["contrib1 : Contribution\n{id='c456', amount=5000, date='2026-06-01'}"]

    user1 --> group1
    user1 --> contrib1
    contrib1 --> group1
```

### Sequence Diagram — Registration

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#f0f8ff','edgeLabelBackground':'#ffffff','tertiaryColor':'#c2dff9'}}}%%
sequenceDiagram
    autonumber
    participant U as Member
    participant FE as Frontend
    participant BE as Backend
    participant Auth as AuthService

    U->>FE: submit registration form
    FE->>BE: POST /api/auth/register
    BE->>Auth: createUser(email,password)
    Auth-->>BE: userCreated
    BE-->>FE: 201 Created
    FE-->>U: show success
```

### Sequence Diagram — Contribution Payment

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#f7f3f2','edgeLabelBackground':'#ffffff','tertiaryColor':'#d9c7c2'}}}%%
sequenceDiagram
    autonumber
    participant U as Member
    participant FE as Frontend
    participant BE as Backend
    participant Payment as PaymentService
    participant Notif as NotificationService

    U->>FE: submit contribution
    FE->>BE: POST /api/contributions
    BE->>Payment: chargeCard()
    Payment-->>BE: paymentSuccess
    BE->>DB: saveContribution(status:confirmed)
    BE->>Notif: sendReceipt()
    Notif-->>U: emailReceipt
```

### Sequence Diagram — Payout Flow

```mermaid
%%{init: {'theme':'forest', 'themeVariables': {'primaryColor':'#eef7fb','edgeLabelBackground':'#ffffff','tertiaryColor':'#c7def3'}}}%%
sequenceDiagram
    autonumber
    participant M as Member
    participant FE as Frontend
    participant BE as Backend
    participant Payout as PayoutEngine
    participant Bank as BankService
    participant Notif as NotificationService

    M->>FE: request payout
    FE->>BE: POST /api/payouts
    BE->>Payout: calculateShare(userId)
    Payout-->>BE: payoutDetails
    BE->>Bank: transfer(amount)
    Bank-->>BE: transferSuccess
    BE->>Notif: sendPayoutNotice()
    Notif-->>M: payout notification
```
