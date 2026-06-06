# SEN2241 — Final Examination Project Specification

> **Authoritative source for grading.** Converted from the lecturer's PDF for project reference.
> Any decision about scope, deliverables, or grading must trace back to this document.

## Course metadata

| Field           | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Faculty         | Information and Communication Technologies (ICT University) |
| Term            | Spring 2026                                              |
| Course title    | Object Oriented Analysis Design and Implementation       |
| Course code     | SEN2241                                                  |
| Instructor      | Tekoh Palma Achu                                         |
| Start date      | 1st week after written exams                             |
| Duration        | 4 weeks                                                  |
| Presentation    | 1st week of June 2026 (exact date announced by lecturer) |
| Weight          | 70% of final grade                                       |

## Deliverables and weighting

| Deliverable                                                                  | Weight |
| ---------------------------------------------------------------------------- | ------ |
| Comprehensive project report (hard and soft copy, Word or PDF)               | 20%    |
| Full functional application built with OOP paradigm (desktop, mobile or web) | 60%    |
| PowerPoint presentation (≤ 20 pages)                                         | 20%    |

## Phase plan

### Phase 1 — Team organization and workflow management (¼ week)
- Form cross-functional Scrum teams of **5 members**.
- Apply team-organization and workflow-management techniques from class.
- Each team **must have a GitHub repository** with every member contributing actively.
- **Grading is based on each member's commit history.**

### Phase 2 — Project selection and requirements analysis (¼ week)
- Define system requirements clearly.
- Analyse feasibility of each requirement.
- Produce a **product backlog** and **sprint backlog**.

### Phase 3 — Object-oriented design / UML (¼ week)
Required diagrams:
- Comprehensive **use case** diagram
- **Class** diagram
- A sample **object** diagram of the system
- **At least 5 sequence diagrams** depicting message flow in different use cases

### Phase 4 — Implementation (3 weeks)
- Use any OOP technology stack of choice — "Build, Build, Build More!"
- Realize **database, backend, frontend, and API server**.
- Students **must implement an API service** for their application.
- Use **Swagger** (or similar) to auto-generate API documentation.

### Phase 5 — Deployment and presentation (¼ week)
- **Desktop:** package for distribution.
- **Web applications: deploy online.** *Not deployed → graded at 50% of overall score.*
- **Mobile:** publish to the appropriate marketplace (Play Store / App Store / etc.).

## Project report template

Required cover-page fields:

- Course Code / Course Title
- Group Number
- Project Topic
- Link to GitHub Repository
- Group Leader
- Group Information table (Name, Reg. Number, Team Role, % Participation) for all 5 members

Required chapter structure (minimum — may be expanded):

- **Chapter One: Introduction**
  - General introduction
  - Aim and objectives
  - Problem statement
- **Chapter Two: Literature Review**
  - Software development methodologies
  - Comparison between methodologies
  - Reason for the choice of Scrum
  - General review of related concepts
  - Review of related literature
- **Chapter Three: Methodology and Materials**
  - Research methodology
  - System requirements (functional and non-functional)
  - System design — high-level architecture, UML diagrams
  - Application of Scrum — team organization, workflow, conflict resolution, challenges
  - Scrum artifacts (product and sprint backlogs)
  - Test case document
  - Proposed algorithms
  - Materials and technologies used
- **Chapter Three: Results and Discussions** *(numbering as given in source)*
  - Application screenshots
  - API request/response screenshots
- **Chapter Four: Recommendations and Conclusion** (≤ 3 paragraphs)

## Grading rubric

> "Grading will strictly be based on **Individual active contribution**."

Each member is evaluated on:

- **Active GitHub commits and commit volume**
- Remark from the Scrum Master
- Ability to respond to questions during presentation
- **Demonstrated mastery of OOP concepts and their implementation in the project**

Each group **must use an Object-Oriented Programming language** for implementation.

## NAAS project compliance notes

| Lecturer requirement                               | NAAS status                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| OOP language for implementation                    | Node.js (JavaScript classes), Express                                                             |
| Database, backend, frontend, API server            | Supabase PostgreSQL + Express REST API + HTML/Tailwind PWA                                        |
| API service with Swagger docs                      | Done — Swagger/OpenAPI annotations on all routes (PR #19, commit `de26724`)                       |
| Use case / class / object / 5+ sequence diagrams   | Drafted in `docs/supplementary/uml-diagrams.html`                                                  |
| Active GitHub commits per member                   | Branching rule: one feature per branch per PR (`feature/dev-<a-d>/<feature>`), conventional commits |
| OOP mastery (4 pillars)                            | Abstract base classes: `PaymentProvider`, `NotificationService`, `RotationStrategy`, `DBConnect`  |
| Web app deployed online                            | Contabo VPS (1-month subscription) provisioned for hosting                                        |
| Report (20%) + functional app (60%) + slides (20%) | Functional app + Swagger live; report and slides pending                                          |

---

*Last updated: 2026-05-23. Source: lecturer's PDF "Final Exams Object Oriented Analysis Design and Implementation Project Specification."*
