## UML Diagrams

Below are Mermaid definitions for a set of UML diagrams for the Digital Njangi Platform.

### Class Diagram

```mermaid
classDiagram
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
objectDiagram
    object user1 {
      id: "u123"
      name: "Alice"
      role: Member
    }
    object group1 {
      id: "g1"
      name: "Market St Njangi"
    }
    object contrib1 {
      id: "c456"
      amount: 5000
      date: "2026-06-01"
    }
    user1 --> group1
    user1 --> contrib1
    contrib1 --> group1
```

### Sequence Diagram — Registration

```mermaid
sequenceDiagram
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
sequenceDiagram
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
