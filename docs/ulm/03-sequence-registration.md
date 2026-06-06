# Sequence Diagram 1: User Registration & OTP Verification

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant AuthController
    participant AuthService
    participant Database
    participant SMS_Gateway

    User->>Frontend: Enter phone number and details
    Frontend->>AuthController: POST /auth/register
    AuthController->>AuthService: registerUser()
    AuthService->>Database: Check if phone exists
    Database-->>AuthService: No duplicate
    AuthService->>AuthService: Generate OTP
    AuthService->>Database: Save user (pending) + OTP
    AuthService->>SMS_Gateway: Send OTP via SMS
    SMS_Gateway-->>User: OTP Code Sent

    User->>Frontend: Enter received OTP
    Frontend->>AuthController: POST /auth/verify-otp
    AuthController->>AuthService: verifyOTP(phone, code)
    AuthService->>Database: Validate OTP & expiry
    Database-->>AuthService: Valid
    AuthService->>Database: Activate user account
    AuthService-->>AuthController: Success + JWT Token
    AuthController-->>Frontend: User registered & logged in
    Frontend-->>User: Show Dashboard