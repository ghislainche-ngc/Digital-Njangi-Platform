# Use Case Diagram - Digital Njangi Platform

```mermaid
usecaseDiagram

    actor "Member" as Member
    actor "Group Officer\n(President/Treasurer/Secretary)" as Officer
    actor "Platform Admin" as Admin
    actor "Payment Gateway" as Gateway

    rectangle "Digital Njangi Platform" {
        usecase "Register Account & Verify OTP" as UC1
        usecase "Login (Email/Phone + 2FA)" as UC2
        usecase "Create New Njangi Group" as UC3
        usecase "Join Existing Group" as UC4
        usecase "Record Contribution" as UC5
        usecase "View Contributions & History" as UC6
        usecase "Request/Receive Payout" as UC7
        usecase "Approve Payout" as UC8
        usecase "Apply & Manage Fines" as UC9
        usecase "Generate PDF Reports" as UC10
        usecase "Manage Group Settings" as UC11
        usecase "System Administration" as UC12
    }

    Member --> UC1
    Member --> UC2
    Member --> UC4
    Member --> UC5
    Member --> UC6
    Member --> UC7
    Member --> UC10

    Officer --> UC3
    Officer --> UC5
    Officer --> UC8
    Officer --> UC9
    Officer --> UC10
    Officer --> UC11

    Admin --> UC12
    Admin --> UC10

    Gateway --> UC5
    Gateway --> UC7

    UC3 ..> UC4 : <<extend>>
    UC5 ..> UC1 : <<include>>
    UC8 ..> UC5 : <<include>>
    UC9 ..> UC5 : <<extend>>