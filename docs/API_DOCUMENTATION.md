# PsyHelp API Documentation (MVP)

Base URL: `/api`

Authentication: Bearer JWT in `Authorization` header unless noted.

## Auth

POST `/auth/admin/login`
- Body: `{ email, password }`
- 200: `{ success, token, user }`

GET `/auth/google`
- Redirects to Google OAuth

GET `/auth/google/callback`
- Redirects to frontend with `?token=`

GET `/auth/me`
- 200: `{ success, user }`

POST `/auth/refresh`
- Body: `{ token }`
- 200: `{ success, token }`

POST `/auth/logout`
- 200: `{ success }`

## Users

GET `/users`
- Admin only
- Query: `role?, institution_id?, page?, limit?`
- 200: `{ success, users, pagination }`

GET `/users/profile`
- 200: `{ success, user }`

PUT `/users/profile`
- Body: `{ firstName?, lastName?, phone?, preferredLanguage?, timezone? }`
- 200: `{ success, message }`

GET `/users/:userId`
- Admin only
- 200: `{ success, user }`

PATCH `/users/:userId/status`
- Admin only
- Body: `{ isActive, isVerified? }`
- 200: `{ success, message }`

DELETE `/users/:userId`
- Admin only (soft delete)
- 200: `{ success, message }`

## Appointments

GET `/appointments`
- Returns current user appointments
- Query: `status?, page?, limit?`
- 200: `{ success, appointments, pagination }`

POST `/appointments`
- Student only
- Body: `{ counselorId, appointmentType, scheduledAt, durationMinutes?, studentNotes? }`
- 201: `{ success, appointment }`

GET `/appointments/:appointmentId`
- 200: `{ success, appointment }`

PATCH `/appointments/:appointmentId/status`
- Body: `{ status, notes? }`
- 200: `{ success, message }`

PATCH `/appointments/:appointmentId/cancel`
- Body: `{ reason? }`
- 200: `{ success, message }`

GET `/appointments/counselors/available`
- Query: `date (YYYY-MM-DD) required, time? (HH:mm)`
- 200: `{ success, counselors }`

## Chat & AI

POST `/chat/sessions`
- Body: `{ sessionType?, isAnonymous?, language? }`
- 201: `{ success, session }`

POST `/chat/sessions/:sessionId/messages`
- Body: `{ messageText, senderType }`
- 201: `{ success, message, aiResponse? }`

GET `/chat/sessions/:sessionId/messages`
- Query: `page?, limit?`
- 200: `{ success, messages }`

GET `/chat/sessions`
- Query: `page?, limit?`
- 200: `{ success, sessions, pagination }`

PATCH `/chat/sessions/:sessionId/end`
- 200: `{ success, message }`

GET `/chat/flagged`
- Counselor/Admin only
- 200: `{ success, messages, pagination }`

PATCH `/chat/messages/:messageId/flag`
- Counselor/Admin only
- Body: `{ isFlagged, flagReason? }`
- 200: `{ success, message }`

## Forum

GET `/forum/categories`
- 200: `{ success, categories }`

GET `/forum/threads`
- Query: `categoryId?, page?, limit?`
- 200: `{ success, threads, pagination }`

POST `/forum/threads`
- Body: `{ title, categoryId, isAnonymous? }`
- 201: `{ success, thread }`

GET `/forum/threads/:threadId/posts`
- Query: `page?, limit?`
- 200: `{ success, posts, pagination }`

POST `/forum/threads/:threadId/posts`
- Body: `{ content, isAnonymous? }`
- 201: `{ success, post }`

POST `/forum/posts/:postId/vote`
- Body: `{ voteType: 'upvote'|'downvote' }`
- 200: `{ success, message }`

GET `/forum/moderation/posts`
- Volunteer/Admin only
- 200: `{ success, posts, pagination }`

PATCH `/forum/posts/:postId/moderate`
- Volunteer/Admin only
- Body: `{ action: 'approve'|'reject', moderationNotes? }`
- 200: `{ success, message }`

POST `/forum/posts/:postId/report`
- Body: `{ reason }`
- 200: `{ success, message }`

## Resources

GET `/resources/categories`
- 200: `{ success, categories }`

GET `/resources`
- Query: `categoryId?, language?, resourceType?, featured?, page?, limit?`
- 200: `{ success, resources, pagination }`

GET `/resources/:resourceId`
- 200: `{ success, resource }`

POST `/resources`
- Admin only
- Body: `{ title, description, content?, resourceType, categoryId, language?, fileUrl?, thumbnailUrl?, durationMinutes?, tags?, isFeatured? }`
- 201: `{ success, resource }`

PUT `/resources/:resourceId`
- Admin only
- Body: any updatable fields
- 200: `{ success, message }`

DELETE `/resources/:resourceId`
- Admin only (soft delete)
- 200: `{ success, message }`

GET `/resources/search`
- Query: `q (min 2 chars), categoryId?, language?, resourceType?, page?, limit?`
- 200: `{ success, resources, pagination }`

## Surveys

GET `/surveys/templates`
- 200: `{ success, templates }`

GET `/surveys/templates/:templateId`
- 200: `{ success, template }`

POST `/surveys/submit`
- Body: `{ templateId, responses, isAnonymous? }`
- 201: `{ success, survey, assessment }`

GET `/surveys/history`
- Query: `page?, limit?`
- 200: `{ success, surveys, pagination }`

GET `/surveys/:surveyId`
- 200: `{ success, survey }`

POST `/surveys/templates`
- Admin only
- Body: `{ name, description?, surveyType, questions }`
- 201: `{ success, template }`

PUT `/surveys/templates/:templateId`
- Admin only
- Body: updatable fields
- 200: `{ success, message }`

## Admin & Analytics

GET `/admin/dashboard`
- Admin only
- 200: `{ success, dashboard }`

GET `/admin/crisis-alerts`
- Counselor/Admin only
- Query: `status?, severity?, page?, limit?`
- 200: `{ success, alerts, pagination }`

PATCH `/admin/crisis-alerts/:alertId`
- Counselor/Admin only
- Body: `{ status, resolutionNotes? }`
- 200: `{ success, message }`

GET `/admin/institutions`
- Admin only
- 200: `{ success, institutions }`

POST `/admin/institutions`
- Admin only
- Body: `{ name, type, domain?, contactEmail?, contactPhone?, address? }`
- 201: `{ success, institution }`

PUT `/admin/institutions/:institutionId`
- Admin only
- Body: updatable fields
- 200: `{ success, message }`

GET `/analytics/wellness`
- Admin only
- Query: `startDate?, endDate?, institutionId?`
- 200: `{ success, analytics }`

GET `/analytics/appointments`
- Admin only
- Query: `startDate?, endDate?, institutionId?`
- 200: `{ success, analytics }`

GET `/analytics/crisis`
- Admin only
- Query: `startDate?, endDate?, institutionId?`
- 200: `{ success, analytics }`

GET `/analytics/engagement`
- Admin only
- Query: `startDate?, endDate?, institutionId?`
- 200: `{ success, analytics }`

## Errors

Standard error response:
```json
{
  "success": false,
  "message": "Error message"
}
```


