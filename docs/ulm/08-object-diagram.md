# Object Diagram - Example Snapshot (One Active Njangi Group)

```mermaid
classDiagram
    class NjangiGroup {
        id = "grp_abc123"
        name = "Family Njangi 2026"
        contribution_amount = 50000
        frequency = "weekly"
        status = "active"
    }

    class User {
        id = "user_alice"
        full_name = "Alice Mbi"
        phone = "+237 677 123 456"
        role_in_system = "member"
    }

    class Membership {
        id = "mem_001"
        user_id = "user_alice"
        group_id = "grp_abc123"
        role = "president"
        rotation_position = 1
        status = "active"
    }

    class Cycle {
        id = "cyc_005"
        group_id = "grp_abc123"
        cycle_number = 5
        start_date = "2026-05-01"
        status = "active"
    }

    class Contribution {
        id = "cont_045"
        cycle_id = "cyc_005"
        user_id = "user_alice"
        amount = 50000
        status = "confirmed"
        payment_method = "mtn_momo"
    }

    NjangiGroup --> Membership
    Membership --> User
    NjangiGroup --> Cycle
    Cycle --> Contribution