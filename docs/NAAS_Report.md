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
