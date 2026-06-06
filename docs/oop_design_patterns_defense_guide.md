# NjangiBridge — OOP Pillars & Design Patterns Defense Guide

This guide is designed to help you defend your Object-Oriented Analysis, Design, and Implementation (OOADI) course project. It provides a complete map of how the 4 pillars of Object-Oriented Programming (OOP) and key software design patterns are implemented in the NjangiBridge codebase, complete with file paths and line ranges.

---

## 1. Codebase Folder Structure & Architecture
The project is split into a clean **Frontend PWA Client** and an **Express.js API Backend** interacting with a **Supabase (PostgreSQL) Storage Layer**.

### Key Folders
*   `app/`: Web application page views (HTML files). Contains the role-based dashboard subdirectories:
    *   `app/admin/`: Platform administrator dashboard (groups, users, analytics).
    *   `app/member/`: Member panel (onboarding, group invitation, personal contribution history, ledgers).
    *   `app/president/`: President panel (nominating members, approving payouts, group settings).
    *   `app/treasurer/`: Treasurer panel (recording manual cash contributions, managing social funds, applying fines).
    *   `app/secretary/`: Secretary panel (minutes recorder, announcements publisher).
*   `src/`: Shared frontend assets:
    *   `src/css/`: Vanilla styling stylesheets (`app.css`, UI system tokens).
    *   `src/js/`: Frontend application shell (`app-shell.js`), API interaction scripts (`api/`), state management (`store.js`), and lifecycle controllers.
*   `backend/`: Express.js server codebase:
    *   `backend/src/app.js`: Backend entrypoint registering routes and middleware.
    *   `backend/src/config/`: Configuration setup, database client connection (`DBConnect.js`), and database setup scripts (`schema.sql`).
    *   `backend/src/engines/`: Complex background execution modules, such as the `PayoutEngine` that handles automated payout cycles.
    *   `backend/src/modules/`: REST controllers, service classes, routers, and validators divided logically by domain entities (e.g. `auth/`, `groups/`, `contributions/`, `payouts/`, `fines/`, `minutes/`, `announcements/`).
    *   `backend/src/services/`: Core decoupled systems (notification, payment provider gateways, rotation algorithms).
    *   `backend/tests/`: Automated unit, integration, and security tests.
*   `docs/`: Project documentation, UML diagrams (`uml.md`), requirements specifications, and presentation slide files.

---

## 2. The Four Pillars of OOP in NjangiBridge

### A. Abstraction
**Definition**: Hiding background details and exposing only the essential interface to consumers, preventing direct instantiation of incomplete base classes.

*   **Implementation 1 (Payment Providers)**: [PaymentProvider.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/payment/PaymentProvider.js#L12-L53)
    *   *Abstract Guard* (Lines 13–18): Uses `new.target` checks in the constructor. If someone attempts to call `new PaymentProvider()`, JS throws an error.
    *   *Abstract Methods* (Lines 26–52): Methods like `charge()`, `disburse()`, `getStatus()`, and `refund()` throw errors by default, forcing concrete subclasses to override them.
*   **Implementation 2 (Rotation Strategies)**: [RotationStrategy.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/RotationStrategy.js#L11-L27)
    *   Enforces abstract behavior via `new.target` checks and defines the `selectNextRecipient()` abstract stub.
*   **Implementation 3 (Notification Services)**: [NotificationService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/notification/NotificationService.js#L11-L37)
    *   Exposes a high-level `sendBulk()` utility while keeping the driver-specific `send()` method abstract.

### B. Inheritance
**Definition**: Creating a hierarchical relationship where subclasses inherit and extend properties and methods from a parent class, promoting code reuse.

*   **Implementation 1 (Mobile Money Gateways)**:
    *   [MTNMoMoService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/payment/MTNMoMoService.js#L19): `class MTNMoMoService extends PaymentProvider { ... }`
    *   [OrangeMoneyService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/payment/OrangeMoneyService.js#L14): `class OrangeMoneyService extends PaymentProvider { ... }`
    *   [CampayService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/payment/CampayService.js#L16): `class CampayService extends PaymentProvider { ... }`
*   **Implementation 2 (Rotation Rules)**:
    *   [FixedRotationStrategy.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/FixedRotationStrategy.js#L13): `class FixedRotationStrategy extends RotationStrategy { ... }`
    *   [RandomDrawStrategy.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/RandomDrawStrategy.js#L11): `class RandomDrawStrategy extends RotationStrategy { ... }`
    *   [PresidentDecisionStrategy.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/PresidentDecisionStrategy.js#L14): `class PresidentDecisionStrategy extends RotationStrategy { ... }`
*   **Implementation 3 (Multi-Channel Alerts)**:
    *   [TelegramNotificationService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/notification/TelegramNotificationService.js#L14): `class TelegramNotificationService extends NotificationService { ... }`
    *   [SMSNotificationService.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/notification/SMSNotificationService.js#L14): `class SMSNotificationService extends NotificationService { ... }`

### C. Polymorphism
**Definition**: The ability of different classes to respond to the same method call in unique ways. In JS, this is achieved by overriding methods inherited from abstract parents.

*   **Implementation 1 (Payment Execution)**:
    *   Callers invoke `provider.charge(phone, amount)`. Depending on the class resolved, the program polymorphically executes either:
        *   MTN MoMo's Request-To-Pay XML API,
        *   Orange Money's WebPay token authorization, or
        *   Campay's JSON gateway request.
*   **Implementation 2 (Dynamic Rotation)**:
    *   [RotationEngine.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/RotationEngine.js#L22-L24): The engine calls `this.strategy.selectNextRecipient(members, payoutHistory)`. The code dynamically resolves at runtime to Fixed, Random, or President decisions.

### D. Encapsulation
**Definition**: Bundling data and code into a single unit (class) while restricting direct access to internal fields (information hiding).

*   **Implementation 1 (Database Client)**: [DBConnect.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/config/DBConnect.js#L29-L58)
    *   Stores connection credentials and raw clients in private variables: `this._url`, `this._serviceKey`, and `this._client`.
    *   These variables are locked down using `Object.freeze(this._url)` and are hidden from external callers, who interact solely through public query methods (`findOne`, `findAll`, etc.).
*   **Implementation 2 (Domain Services)**:
    *   All system endpoints delegate database and business logic to dedicated class instances (e.g. `AuthService`, `GroupService`, `PayoutService`). These service classes encapsulate error handling, database triggers, and business validations, exposing simple public interfaces to route controllers.

---

## 3. Design Patterns Implemented

### 1. Singleton Pattern
*   **Purpose**: Restrict instantiation of a class to a single object, ensuring a global point of access.
*   **Where**: [DBConnect.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/config/DBConnect.js#L30-L73)
*   **How**:
    *   Declares a private static instance holder: `static _instance = null;`
    *   Defines a static access method: `static getInstance(username, password)` which instantiates the connection on the first call and returns the existing instance thereafter.

### 2. Strategy Pattern
*   **Purpose**: Define a family of algorithms, encapsulate each one, and make them interchangeable at runtime.
*   **Where**: [RotationEngine.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/rotation/RotationEngine.js)
*   **How**:
    *   `RotationStrategy` serves as the Strategy Interface.
    *   `FixedRotationStrategy`, `RandomDrawStrategy`, and `PresidentDecisionStrategy` represent the Concrete Strategies.
    *   `RotationEngine` acts as the Context. The correct strategy is injected into the engine's constructor and executed dynamically.

### 3. Factory Pattern (Simple Factory & Factory Method)
*   **Purpose**: Define an interface for creating objects, delegating instantiation logic away from the caller.
*   **Where**:
    *   **Payment Providers**: [services/payment/index.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/payment/index.js#L31-L43) — The `getProvider(gateway)` method acts as a simple factory, resolving the gateway string to a concrete provider (`MTNMoMoService`, `OrangeMoneyService`, or `CampayService`).
    *   **Notification Drivers**: [services/notification/index.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/services/notification/index.js#L59-L70) — `getNotificationService(channel)` instantiates different communication subclasses or swaps in the `MockNotificationService` automatically during tests.
    *   **Rotation Strategies**: [payout.service.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/modules/payouts/payout.service.js#L458-L465) — `_resolveRotationStrategy(rotationType, cycleNumber)` acts as a factory method instantiating Fixed, Random, or President strategy classes.

### 4. Adapter Pattern
*   **Purpose**: Wrap an existing interface to translate it into a unified, expected interface.
*   **Where**: [DBConnect.js](file:///c:/Users/ghisl/Documents/Digital_Njangi_Platform/backend/src/config/DBConnect.js#L115-L220)
*   **How**:
    *   `DBConnect` acts as an Adapter. It wraps the raw Supabase client SDK (PostgREST API builder syntax like `.insert().select().single()`) behind standard, unified CRUD method signatures: `create()`, `findOne()`, `findAll()`, `update()`, and `remove()`.

---

## 4. Key Defense Tips for your Presentation
*   **Why use Singleton for DBConnect?**
    *   *Defense*: Creating a new Supabase client or DB connection pool on every API request consumes server memory and database ports. The Singleton pattern limits connection overhead, maintaining exactly one pool instance.
*   **Why use Strategy for Payout Rotations?**
    *   *Defense*: Different Njangi groups choose different rotation models (Fixed order, Random raffle draw, or President selection). Instead of writing complex, nested `if/else` checks throughout the payout logic, we encapsulate each rule in its own strategy class. This adheres to the **Open/Closed Principle** (we can add a new rotation model, e.g., "bidding/auction rotation", by simply adding a new strategy class without editing existing code).
*   **Why Abstraction for Payments and Notifications?**
    *   *Defense*: This decouples our business logic (e.g. contributing to a cycle) from third-party APIs (e.g. MTN or Twilio). If we want to change payment gateways or expand to another country, we only write a new subclass that implements `PaymentProvider`. The rest of the codebase remains untouched.
