# NAAS — Njangi As A Service

## Object-Oriented Analysis, Design and Implementation Project Report

**Course Code / Title:** SEN2241 / Object-Oriented Analysis, Design and Implementation
**Group Number:** Group 4
**Project Topic:** Digital Njangi Platform (NAAS)
**GitHub Repository:** [https://github.com/ghislainche-ngc/Digital-Njangi-Platform](https://github.com/ghislainche-ngc/Digital-Njangi-Platform)
**Group Leader:** Ghislain Che Ngwateh
**Instructor:** TEKOH PALMA ACHU
**Date:** Spring 2026

---

### Group Information
| SN | Member's Name | Registration Number | Team Role | % Participation |
|---|---|---|---|---|
| 1 | Ghislain Che Ngwateh | ICTU-2023-SEN-089 | Scrum Master / Group Leader / Backend Dev | 35% |
| 2 | Glory [LastName] | ICTU-2023-SEN-045 | Product Owner / Frontend Developer | 25% |
| 3 | [Member 3 Name] | ICTU-2023-SEN-102 | Developer / Notification & Webhook Specialist | 15% |
| 4 | [Member 4 Name] | ICTU-2023-SEN-011 | QA Engineer / Automated Test Developer | 15% |
| 5 | [Member 5 Name] | ICTU-2023-SEN-067 | DevOps Engineer / Deployment Specialist | 10% |

---

# CHAPTER ONE: INTRODUCTION

## 1.1 General Introduction
In Cameroon and across much of West and Central Africa, informal rotating savings and credit associations (ROSCAs), locally known as **Njangis** or *Tontines*, play a critical role in the financial lives of millions of people. These community-based groups bring together members who contribute a fixed amount of money at regular intervals (weekly or monthly). At each cycle, the pooled contributions (the "pot") are disbursed to one member of the group, rotating until every member has received it once.

Despite their widespread adoption, the vast majority of Njangis operate using entirely manual methods. Contributions are collected in cash at physical meetings, records are kept in handwritten notebooks, and rotations are tracked on paper. This manual approach suffers from serious operational vulnerabilities: records can be lost or altered, cash handling invites theft, and disputes about who paid what are frequent.

**NAAS (Njangi As A Service)** is a multi-tenant web platform designed to digitise the entire lifecycle of Njangi groups while preserving their social trust. It provides a secure, digital workspace where groups can automate MTN Mobile Money and Orange Money collections, schedule rotations with configurable rules, enforce fines, build emergency solidarity funds, and view a transparent, immutable ledger in real time.

<!-- APPEND_MARKER -->
### 3.5.2 Sprint Backlog
The table below illustrates the allocation of user stories across our development releases.

| Release | Sprint | ID of User Stories | Period |
|---|---|---|---|
| **Release 1: Core Scaffolding** | Sprint 1 | Project Scaffolding, DB Schemas, SQL tables | Week 1 |
| **Release 1: Core Scaffolding** | Sprint 2 | 2 (Auth & SMS OTP verification) | Week 2 |
| **Release 1: Core Scaffolding** | Sprint 3 | 1, 3 (Group Creation & Invitation links) | Week 3 |
| **Release 2: Settings & Roles** | Sprint 4 | 4, 5 (Role assignments & config settings) | Week 4 |
| **Release 2: Settings & Roles** | Sprint 5 | 6, 7 (Live Ledger & Rotation scheduler) | Week 5 |
| **Release 3: Gateway Integrations** | Sprint 6 | 8, 9 (MoMo/Orange integration & Campay webhooks) | Week 6 |
| **Release 3: Gateway Integrations** | Sprint 7 | 10, 11 (Payout Engine & Telegram notification bot) | Week 7 |
| **Release 4: Admin & Social Funds** | Sprint 8 | 12, 13, 14, 15 (Fines, Social Fund, Admin controls & VPS deploy) | Week 8 |

---

## 3.6 Test Case Document
Our automated test suite validated system behaviors across 20 distinct use cases.

* **TC-01**: User registration with valid data (POST `/auth/register`) -> Returns `201 Created` with JWT.
* **TC-02**: Duplicate email registration -> Returns `409 Conflict`.
* **TC-03**: Login with correct credentials (POST `/auth/login`) -> Returns `200 OK` with JWT.
* **TC-04**: Login with wrong password -> Returns `401 Unauthorized`.
* **TC-05**: Create Njangi group with valid payload (POST `/groups`) -> Returns `201 Created` with tenant ID.
* **TC-06**: Non-president attempts to delete group -> Returns `403 Forbidden` (RLS isolations block).
* **TC-07**: Record valid contribution (POST `/groups/:id/contributions`) -> Returns `201 Created` (appended to ledger).

<!-- APPEND_MARKER -->
| **6** | As a member, I want to view the live group contribution ledger showing everyone's status, so that I can monitor payments without relying on manual records. | When the ledger page opens, it displays all contributions for the current cycle with real-time status. | 2 | 13 | 1.0 | 13.0 |
| **7** | As a member, I want to see the rotation calendar from the start of the cycle, so that I know exactly when I am due to receive the payout pot. | When the calendar page is accessed, the rotation list shows the exact cycle dates and the assigned recipient. | 2 | 8 | 1.0 | 8.0 |
| **8** | As a treasurer, I want the system to automatically initiate MoMo requests-to-pay on the contribution date, to reduce the need for manual follow-ups. | When the contribution date arrives, pending transaction entries are generated and gateway requests are dispatched. | 3 | 20 | 2.0 | 40.0 |
| **9** | As a treasurer, I want to manually record cash payments for members who cannot use mobile money, so that records remain accurate. | Given a cash payment, when recorded by the treasurer, the status is marked SUCCESS with a "Cash" label. | 3 | 8 | 1.5 | 12.0 |
| **10** | As a president, I want the system to check that eligibility criteria (no arrears, no unpaid fines) are met before payouts are sent. | When a payout is triggered, eligibility checks are evaluated; the payout is blocked if checks fail. | 3 | 15 | 1.5 | 22.5 |
| **11** | As a member, I want to receive notifications (Telegram/SMS) after a payout is executed, so that I can track group progress. | When a payout transitions to COMPLETED, notification dispatches are sent to all linked communication channels. | 3 | 13 | 1.5 | 19.5 |
| **12** | As a treasurer, I want to record late fees and fines against members who miss deadlines, to enforce compliance with rules. | Given a late transaction, a fine record is generated with a specified reason, amount, and deadline. | 4 | 8 | 1.0 | 8.0 |
| **13** | As a president, I want fine waivers to be logged with a reason, to maintain transparency in group decisions. | When a president waives a fine, the system updates the fine status and writes the decision to the audit log. | 4 | 5 | 1.0 | 5.0 |
| **14** | As a treasurer, I want to manage a separate solidarity social fund to track deposits and withdrawals for weddings, births, and funerals. | Deposits and withdrawals to the solidarity fund are logged separately from the main tontine savings pot. | 4 | 10 | 1.5 | 15.0 |
| **15** | As a platform admin, I want to monitor overall group statistics, modify billing configurations, and suspend groups if needed. | When the admin logs in, a dashboard displays MRR, active users, group status summaries, and action triggers. | 4 | 13 | 1.0 | 13.0 |

<!-- APPEND_MARKER -->
## 3.5 Scrum Artifacts

### 3.5.1 Product Backlog
The Product Backlog below contains the estimated user stories, priority values, and effort estimations using Fibonacci planning points.

| ID | Requirement (User Story) | Acceptance Criteria | Priority | Initial Estimate (hrs) | Adjustment Factor | Adjusted Estimate (hrs) |
|---|---|---|---|---|---|---|
| **1** | As a group president, I want to register my Njangi on the platform by providing the name, contribution amount, and frequency, so that my group has a digital space to operate. | Given valid group fields, when the president clicks submit, then the group is created and the user is assigned the President role. | 1 | 15 | 1.5 | 22.5 |
| **2** | As a user, I want to register with my phone number and email and verify via SMS OTP, so that I can securely access the platform. | Given details, when submitted, a 6-digit OTP is sent and must be validated before the account transitions to verified. | 1 | 13 | 1.0 | 13.0 |
| **3** | As a president, I want to invite members by generating invitation links so that I can easily add them to the Njangi group. | Given an active group, when the president clicks generate, a tokenized invitation link is created with a 48-hour expiration. | 1 | 10 | 1.5 | 15.0 |
| **4** | As a president, I want to assign the Treasurer and Secretary roles to existing members, so that the group has designated officers with appropriate permissions. | When a role is updated, the user's membership entry changes role status and they receive a notification. | 1 | 8 | 1.0 | 8.0 |
| **5** | As a president, I want to configure the contribution details, schedules, and fines so that they reflect the group's agreement. | When settings are updated, they are logged in the audit trail and applied to all future contribution cycles. | 1 | 10 | 1.5 | 15.0 |

<!-- APPEND_MARKER -->
### 3.4.2 Workflow Management
Sprints were planned weekly using a **GitHub Projects Kanban Board**. Task sizes were estimated using Planning Poker with Fibonacci points (1, 2, 3, 5, 8, 13). Daily standup ceremonies were run asynchronously in a dedicated WhatsApp group to maximize flexibility under academic schedules. At the end of each week, a retrospective was conducted.

### 3.4.3 Conflict Resolution
The team resolved disagreements through a structured three-step escalation process:
1. **Direct Bilateral Discussion**: Developers discussed technical tradeoffs together.
2. **Scrum Master Facilitation**: If unresolved in 24 hours, the Scrum Master led a session using the "disagree and commit" principle.
3. **Time-Boxed Spike**: For technical blocks, a 2-hour research spike was conducted to compare options objectively.

### 3.4.4 Challenges Encountered and Solutions
* **MTN MoMo API Sandbox Instability**: The sandbox API was frequently offline. **Solution**: We built a complete local mock provider in `PaymentProvider.js` to isolate testing from network dropouts.
* **Complex RLS Policies**: Enforcing tenant isolation resulted in database performance loops. **Solution**: We simplified RLS rules and built a dedicated automated test suite.
* **Vite/Alpine Race Conditions**: In production bundles, Alpine initialized before pages bound dynamic window methods. **Solution**: Deferred `Alpine.start()` using `setTimeout(..., 0)` inside `boot.js`.

<!-- APPEND_MARKER -->
##### Activity Diagram 3: Mobile Money Contribution Collection Flow (Push & Webhooks)
Describes request-to-pay initiation, pending contribution state, polling vs webhook reconciliation, signature verification and ledger append.

##### Activity Diagram 4: Payout Nominee Eligibility Checks & Approval Flow
Describes parallel eligibility audits (contributions, fines, history), manual approval for large amounts, signature verification and disbursement orchestration.

##### Activity Diagram 5: Late Fine Waiving & Solidarity Social Fund Transaction Flow
Describes role-guarded fine waivers and solidarity fund transactions with audits, balance checks, and write-audit operations.

---

## 3.4 Application of Scrum

### 3.4.1 Team Organisation
Our team comprised 5 cross-functional roles:
1. **Ghislain Che Ngwateh (Scrum Master / Group Leader / Backend Dev)**: Managed sprint boards, led system architecture design, backend API routing, database schema definitions, and MTNMomo payment gateway integration.
2. **Glory (Product Owner / Frontend Dev)**: Prioritized user stories, designed mockups, and built authentication, invitation routing, and group management screens.
3. **[Member 3 Name] (Developer)**: Integrated webhook handlers, configured Orange Money payment APIs, and set up PDFkit document rendering engines.
4. **[Member 4 Name] (QA Engineer)**: Wrote automated unit and integration tests using Jest and Supertest, ensuring RLS data isolation was fully tested.
5. **[Member 5 Name] (DevOps Engineer)**: Managed VPS environment settings, PM2 process daemons, Nginx reverse proxies, and configured the Telegram bot webhook tunnels.

<!-- APPEND_MARKER -->
##### Activity Diagram 1: User Sign-Up & Phone OTP Verification Flow
Describes the flow from user registration to OTP generation, SMS dispatch, OTP verification, JWT generation and final redirect.

##### Activity Diagram 2: Group Creation & Subscription Limit Enforcement Flow
Describes President input, tier selection, server-side validation, group initialization, membership creation, and audit logging including tier-limit checks and error handling.

<!-- APPEND_MARKER -->
#### 2. Class Diagram
Describes core classes: `User`, `Group`, `Membership`, `Contribution`, `Payout`, `SocialFund`, rotation strategies, notification interfaces, and `PayoutEngine` dependencies. Shows composition, aggregation, multiplicity and inheritance among strategies.

#### 3. Object Diagram
Provides example runtime instances for a sample group (`lesAmisGroup`) and associated user membership objects to illustrate current state relationships.

#### 4. Component Diagram
Outlines high-level components: PWA client, API server, Payment/Notification/Payout services, and the PostgreSQL datastore along with artifacts such as `client.js` and `schema.sql`.

#### 5. Activity Diagrams
Defines workflows for: Sign-Up & OTP, Group Creation, Mobile Money Collection, Payout Approval, and Fine Waiving & Social Fund transactions.

<!-- APPEND_MARKER -->
## 3.2 System Requirements

### 3.2.1 Functional Requirements
* **FR-01 [High]**: User Registration & Multi-Tenant Onboarding. Users can register and create or join a group.
* **FR-02 [High]**: Role-Based Access Control. Supports Member, President, Treasurer, Secretary, and Platform Admin roles.
* **FR-03 [High]**: Group Profile Management. Setting contribution amounts, frequency, penalties, and plans.
* **FR-04 [High]**: Member Invitation & Approval. Inviting members via unique tokenized signup links.
* **FR-05 [High]**: MTN MoMo & Orange Money Integration. Automating contribution collection and payouts via API.
* **FR-06 [High]**: Transparent Ledger. Real-time, append-only financial ledger visible to all members.
* **FR-07 [High]**: Rotation Scheduling. Automating rotation calendar calculations.
* **FR-08 [Medium]**: Fine & Penalty Management. Recording late contribution fines and daily fees.
* **FR-09 [Medium]**: Solidarity Social Fund. Separate accounting for births, weddings, and bereavement.
* **FR-10 [Medium]**: Multi-Channel Notifications. Bot integration for Telegram and SMS alerts.
* **FR-11 [Medium]**: Meeting Minutes Recording. Logging meeting summaries and attendance by the Secretary.
* **FR-12 [Medium]**: PDF Report Generation. Downloading formal receipt details and group summaries.
* **FR-13 [High]**: Admin Dashboard. Global system overrides (tiers, status), user directories, and audit logs.

### 3.2.2 Non-Functional Requirements
* **NFR-01 (Performance)**: Key pages must load in under 3 seconds on a 3G network.
* **NFR-02 (Security)**: Database multi-tenancy enforced using Supabase Row Level Security (RLS) policies.
* **NFR-03 (Security)**: Payouts above a configurable limit require explicit, multi-criteria President approval.
* **NFR-04 (Usability)**: Interface must support English and French with manual toggle overrides.
* **NFR-05 (Availability)**: Maintain a 99.5% uptime target outside scheduled maintenance windows.
* **NFR-06 (Maintainability)**: Service classes must follow clean Object-Oriented design with clear business separation.

---

## 3.3 System Design

### 3.3.1 High-Level Architecture (HLD)
NAAS utilizes a four-tier architecture separating concerns:
1. **Presentation Tier (PWA)**: Desktop/mobile responsive client built with HTML5, Vanilla CSS, and Alpine.js. Caches assets using Service Workers.
2. **Application Tier (REST API)**: Node.js/Express.js web server exposing JSON endpoints. Automates API docs via Swagger.
3. **Business Logic Tier (Services)**: Domain-driven service classes (`GroupService`, `PaymentService`, `PayoutEngine`) encapsulating object models and rules.
4. **Data Tier (Supabase PostgreSQL)**: Handles data storage and enforces strict isolation policies (RLS).

---

### 3.3.2 UML Diagrams
The system design includes a set of UML diagrams to describe static and dynamic aspects (Use Case, Class, Object, Component, Sequence, and Activity diagrams).

#### 1. Use Case Diagram
Demonstrates actors, generalization, include/extend relationships and system boundary for core features like authenticate, pay, payout, invite, and minutes.

<!-- APPEND_MARKER -->
## 2.2 Comparison between Methodologies
| Criterion | Waterfall | Spiral | Scrum | Kanban |
|---|---|---|---|---|
| **Approach** | Linear, sequential | Iterative, risk-driven | Iterative sprints | Continuous flow |
| **Flexibility** | Very low | Medium-high | High | Very high |
| **Requirement Changes** | Not allowed mid-project | Checked at loop end | Per sprint | Any time |
| **Team Roles** | Functional departments | Specialized roles | Product Owner, SM, Devs | No prescribed roles |
| **Delivery** | Single final release | Incremental prototypes | Every sprint | Continuous flow |
| **Documentation** | Extensive | Moderate | Minimal, clean | Minimal |
| **Client Involvement** | Low (start/end) | Moderate | High | High |
| **Best For** | Stable, fixed specs | Highly risky projects | Dynamic, evolving specs | Ongoing maintenance |

## 2.3 Reason for the Choice of Scrum Methodology
Scrum was selected as the development framework for NAAS for the following reasons:
1. **Evolving Requirements**: Integration with mobile money gateways and payment webhooks required rapid prototyping and feedback. Scrum allowed us to adjust requirements per sprint.
2. **Team Size**: Our five-member team fit squarely within the recommended Scrum team size (3–9 members), enabling efficient, direct daily communication.
3. **Time-Boxed cadence**: The academic timeline mapped naturally to eight one-week sprints, each delivering a concrete, working increment of the application.
4. **Scrum Ceremonies**: Daily asynchronous standups via WhatsApp and weekly sprint planning/review sessions maintained high focus and accountability.

## 2.4 General Review of Related Concepts
* **Rotating Savings and Credit Associations (ROSCAs)**: Informal financial institutions where a group of individuals agree to contribute fixed amounts to a common pool. Njangis are Cameroonian ROSCAs.
* **Mobile Money (MoMo)**: Digital payment services operated by telecom networks (MTN MoMo, Orange Money) dominant in Sub-Saharan Africa, enabling wallet-to-wallet transfers.
* **Object-Oriented Programming (OOP)**: A paradigm based on "objects" containing data (attributes) and code (methods). It is structured around four pillars: **Encapsulation**, **Inheritance**, **Polymorphism**, and **Abstraction**.
* **Progressive Web Applications (PWAs)**: Web apps that act like native mobile apps. They are installable from the browser, cache assets via Service Workers, and function in low or offline network conditions.
* **Multi-Tenant SaaS**: An architecture where a single app instance serves multiple groups (tenants), with strict data isolation enforced at the database level.

## 2.5 Review of Related Literature
Prior studies on ROSCA digitisation in Africa (e.g., Fomba et al., 2021) show that ROSCA adoption depends heavily on **trust**, **preservation of social elements**, and **accessibility on low-end devices**. Platforms that attempt to replace social interaction with pure automation struggle to gain traction, whereas platforms that digitize manual ledgers while leaving decision-making (e.g. fine waivers, manual approvals) in the hands of the group officers succeed. Furthermore, research by Kabbedijk et al. (2018) indicates that multi-tenant architectures utilizing row-level database security are highly effective at isolating group financial data.

---

# CHAPTER THREE: METHODOLOGY AND MATERIALS

## 3.1 Research Methodology
We used a mixed-methods research approach combining primary field research with literature reviews. The primary research phase involved administering a structured questionnaire to **14 active Njangi groups** across four cities in Cameroon (Yaoundé, Douala, Buea, and Bafoussam) to map their meeting structures, contribution amounts, rotation methods, and usage of mobile money.

<!-- APPEND_MARKER -->
## 1.2 Aim and Objectives
**Aim:** To design and implement a fully functional, object-oriented multi-tenant web platform that digitises Njangi group management in Cameroon, improving transparency, reducing fraud, and increasing financial inclusion.

**Specific Objectives:**
1. Conduct field research with 14 active Njangi groups in Cameroon to map real-world workflows, pain points, and user expectations.
2. Design a complete object-oriented system architecture using a comprehensive suite of UML diagrams (Use Case, Class, Object, Sequence, Activity, and Component diagrams).
3. Implement a multi-tenant Progressive Web Application (PWA) with role-based access control supporting 5 distinct roles: Member, President, Treasurer, Secretary, and Platform Administrator.
4. Integrate MTN Mobile Money and Orange Money APIs for automated contribution collection and payout disbursement.
5. Create a transparent, append-only financial ledger accessible to all group members.
6. Build a smart rotation scheduling engine with configurable rotation strategies (Fixed, Random, President-Decision) and anti-fraud eligibility checks.
7. Deploy the platform online with automated testing and CI/CD pipelines to guarantee high availability and code quality.

## 1.3 Problem Statement
Our team conducted field research by administering a structured questionnaire survey to 14 active Njangi groups across Cameroon. This study highlighted several critical operational vulnerabilities:
* **Single Point of Failure**: 86% of surveyed groups maintain financial records exclusively in handwritten ledgers, which are vulnerable to damage, loss, or alteration.
* **Financial Disputes**: 100% of groups reported experiencing at least one financial dispute in the previous 12 months, directly attributable to the absence of a shared, verifiable transaction history.
* **Inefficient Reminders**: Manual WhatsApp reminders for contribution deadlines are inconsistent and easily missed, leading to payment delays.
* **Unchecked Power**: The Treasurer role concentrates unchecked financial power, creating structural conditions for fraud.
* **Inefficient Calculations**: Payout rotations and fine calculations are done manually, often taking hours at physical meetings.
* **Lack of Audit Trails**: There is no systematic mechanism to track fines, manage a solidarity fund, record meeting minutes, or audit historical financial data.

---

# CHAPTER TWO: LITERATURE REVIEW

## 2.1 Software Development Methodologies
Software development methodologies guide the planning, execution, and management of software projects. The most widely discussed frameworks include:
* **Waterfall Model**: A sequential, linear methodology in which each phase (Requirements, Design, Implementation, Testing, Deployment) must be completed before the next begins. It is simple to understand but rigid and poorly suited for projects with evolving requirements.
* **Spiral Model**: An iterative, risk-driven model that combines elements of linear and iterative development, focusing heavily on prototyping and risk analysis.
* **Agile Scrum**: An iterative, incremental framework where cross-functional teams deliver working software in short cycles called "sprints" (usually 1–4 weeks). It emphasizes collaboration, flexibility, and customer feedback.
* **Kanban**: A visual workflow management method that focuses on continuous delivery, limiting work-in-progress (WIP), and optimizing flow.
* **DevOps**: A culture and practice that integrates software development (Dev) and IT operations (Ops) to automate pipelines (CI/CD) and ensure rapid, reliable releases.

<!-- APPEND_MARKER -->
