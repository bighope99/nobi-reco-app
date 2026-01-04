## ADDED Requirements
### Requirement: Password Setup Page
The system SHALL provide a password setup page at `/password/setup` that accepts Supabase magic link parameters and allows a user to set a new password.

#### Scenario: Display setup form when a magic link is present
- **WHEN** the user opens `/password/setup` with valid Supabase magic link parameters
- **THEN** the system displays a password and confirmation form

#### Scenario: Reject invalid magic links
- **WHEN** the user opens `/password/setup` without valid Supabase magic link parameters
- **THEN** the system displays an error state and blocks submission

### Requirement: Password Update Completion
The system SHALL update the user password and redirect to `/dashboard` after a successful submission.

#### Scenario: Successful password update
- **WHEN** the user submits matching passwords that satisfy the password policy
- **THEN** the system updates the password and redirects to `/dashboard`