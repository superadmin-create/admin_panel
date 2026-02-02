# Fix: Include Student Email in VAPI System Prompt

The ai-viva student app needs to include the student email when starting the VAPI call so it can be captured in viva results.

## Find the file where VAPI call is started

Look for code that creates the system prompt or starts the VAPI assistant. It will have something like:

```javascript
Student Info:
- Name: ${studentName}
- Subject: ${subject}
- Topics: ${topics}
```

## Update it to include email:

```javascript
Student Info:
- Name: ${studentName}
- Email: ${studentEmail}
- Subject: ${subject}
- Topics: ${topics}
```

## Example fix location: app/viva/page.tsx

Find the `systemPrompt` or assistant configuration and add the email line:

```typescript
// BEFORE (missing email):
const systemPrompt = `You are an AI Viva Examiner...

Student Info:
- Name: ${formData.fullName}
- Subject: ${formData.subject}
- Topics: ${formData.topic || 'All Topics'}
...`

// AFTER (with email):
const systemPrompt = `You are an AI Viva Examiner...

Student Info:
- Name: ${formData.fullName}
- Email: ${formData.email}
- Subject: ${formData.subject}
- Topics: ${formData.topic || 'All Topics'}
...`
```

This ensures the email is captured by the admin panel's auto-sync when processing VAPI call data.
