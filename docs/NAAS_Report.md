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
