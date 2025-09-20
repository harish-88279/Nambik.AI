// Constants and type-like structures for the application
// Since we're using JavaScript, we'll define these as constants and use JSDoc for documentation

/**
 * User roles available in the system
 */
export const USER_ROLES = {
  STUDENT: 'student',
  VOLUNTEER: 'volunteer',
  COUNSELOR: 'counselor',
  COLLEGE_ADMIN: 'college_admin',
  NGO_ADMIN: 'ngo_admin'
};

/**
 * Institution types
 */
export const INSTITUTION_TYPES = {
  COLLEGE: 'college',
  NGO: 'ngo'
};

/**
 * Appointment types
 */
export const APPOINTMENT_TYPES = {
  VIRTUAL: 'virtual',
  IN_PERSON: 'in_person'
};

/**
 * Appointment statuses
 */
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

/**
 * Chat session types
 */
export const CHAT_SESSION_TYPES = {
  AI_CHAT: 'ai_chat',
  CRISIS_SUPPORT: 'crisis_support'
};

/**
 * Chat message sender types
 */
export const MESSAGE_SENDER_TYPES = {
  USER: 'user',
  AI: 'ai',
  COUNSELOR: 'counselor'
};

/**
 * Resource types
 */
export const RESOURCE_TYPES = {
  ARTICLE: 'article',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  LINK: 'link'
};

/**
 * Survey types
 */
export const SURVEY_TYPES = {
  PHQ9: 'phq9',
  GAD7: 'gad7',
  CUSTOM: 'custom'
};

/**
 * Risk levels
 */
export const RISK_LEVELS = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  SEVERE: 'severe'
};

/**
 * Crisis alert types
 */
export const CRISIS_ALERT_TYPES = {
  SELF_REPORTED: 'self_reported',
  AI_DETECTED: 'ai_detected',
  PEER_REPORTED: 'peer_reported',
  SURVEY_TRIGGERED: 'survey_triggered'
};

/**
 * Crisis alert statuses
 */
export const CRISIS_ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  FALSE_POSITIVE: 'false_positive'
};

/**
 * Default pagination settings
 */
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 10
};

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    GOOGLE: '/api/auth/google',
    CURRENT_USER: '/api/auth/me'
  },
  USERS: '/api/users',
  APPOINTMENTS: '/api/appointments',
  CHAT: '/api/chat',
  FORUM: '/api/forum',
  RESOURCES: '/api/resources',
  SURVEYS: '/api/surveys',
  ADMIN: '/api/admin'
};

/**
 * Socket event types
 */
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  CRISIS_ALERT: 'crisis_alert',
  NOTIFICATION: 'notification'
};
