-- PsyHelp Database Schema for Neon PostgreSQL
-- This schema supports the mental health platform with proper security and anonymization

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Institutions table (Colleges and NGOs)
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('college', 'ngo')),
    domain VARCHAR(255) UNIQUE, -- For email domain validation
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For admin email/password auth
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'volunteer', 'counselor', 'college_admin', 'ngo_admin')),
    institution_id UUID REFERENCES institutions(id),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    profile_picture_url TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Student-specific information
CREATE TABLE student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50), -- University student ID
    year_of_study INTEGER,
    major VARCHAR(100),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    consent_to_treatment BOOLEAN DEFAULT false,
    consent_to_data_collection BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Counselor-specific information
CREATE TABLE counselor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(100),
    specialization TEXT[],
    experience_years INTEGER,
    languages_spoken TEXT[],
    availability_schedule JSONB, -- Store weekly availability
    hourly_rate DECIMAL(10,2),
    bio TEXT,
    qualifications TEXT[],
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Counselor availability (IST)
CREATE TABLE counselor_settings (
    counselor_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 180),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE counselor_availability_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    counselor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

CREATE INDEX idx_caw_counselor_weekday ON counselor_availability_windows(counselor_id, weekday);

CREATE TABLE counselor_time_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    counselor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_at > start_at)
);

CREATE INDEX idx_time_off_counselor ON counselor_time_off(counselor_id, start_at, end_at);

-- Apply updated_at triggers
CREATE TRIGGER update_counselor_settings_updated_at BEFORE UPDATE ON counselor_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caw_updated_at BEFORE UPDATE ON counselor_availability_windows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    counselor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_type VARCHAR(50) NOT NULL CHECK (appointment_type IN ('virtual', 'in_person')),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT, -- For virtual appointments
    location TEXT, -- For in-person appointments
    notes TEXT, -- Counselor notes (encrypted)
    student_notes TEXT, -- Student's concerns/notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat Sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL DEFAULT 'ai_chat' CHECK (session_type IN ('ai_chat', 'crisis_support', 'peer_chat', 'counselor_chat')),
    is_anonymous BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'en',
    sentiment_score DECIMAL(3,2), -- -1 to 1 scale
    crisis_risk_level INTEGER DEFAULT 0 CHECK (crisis_risk_level BETWEEN 0 AND 10),
    counselor_id UUID REFERENCES users(id), -- New column
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'ai', 'counselor')),
    message_text TEXT NOT NULL,
    sentiment_score DECIMAL(3,2),
    is_flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Peer Support Forums
CREATE TABLE forum_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forum_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES forum_categories(id),
    title VARCHAR(255) NOT NULL,
    is_anonymous BOOLEAN DEFAULT true,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forum_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous posts
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT true,
    is_moderated BOOLEAN DEFAULT false,
    moderator_id UUID REFERENCES users(id),
    moderation_notes TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resources (Articles, Videos, etc.)
CREATE TABLE resource_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES resource_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('article', 'video', 'audio', 'document', 'link')),
    category_id UUID REFERENCES resource_categories(id),
    language VARCHAR(10) DEFAULT 'en',
    file_url TEXT UNIQUE,
    thumbnail_url TEXT,
    duration_minutes INTEGER, -- For videos/audio
    tags TEXT[],
    is_featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wellness Surveys (PHQ-9, GAD-7, etc.)
CREATE TABLE survey_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    survey_type VARCHAR(50) NOT NULL CHECK (survey_type IN ('phq9', 'gad7', 'custom')),
    questions JSONB NOT NULL, -- Store questions and scoring logic
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wellness_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES survey_templates(id),
    responses JSONB NOT NULL, -- Store anonymized responses
    total_score INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'moderate', 'high', 'severe')),
    is_anonymous BOOLEAN DEFAULT true,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crisis Alerts
CREATE TABLE crisis_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('self_reported', 'ai_detected', 'peer_reported', 'survey_triggered')),
    severity_level INTEGER NOT NULL CHECK (severity_level BETWEEN 1 AND 10),
    description TEXT,
    source_session_id UUID REFERENCES chat_sessions(id),
    source_survey_id UUID REFERENCES wellness_surveys(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_positive')),
    assigned_counselor_id UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_by UUID REFERENCES users(id), -- New column
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional data for the notification
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log for security and compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_institution ON users(institution_id);
CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_appointments_counselor ON appointments(counselor_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX idx_crisis_alerts_user ON crisis_alerts(user_id);
CREATE INDEX idx_crisis_alerts_status ON crisis_alerts(status);
CREATE INDEX idx_wellness_surveys_user ON wellness_surveys(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Insert default data
INSERT INTO institutions (name, type, domain, contact_email) VALUES 
('Default College', 'college', 'college.edu', 'admin@college.edu'),
('Mental Health NGO', 'ngo', 'mentalhealthngo.org', 'contact@mentalhealthngo.org');

INSERT INTO resource_categories (name, description) VALUES 
('Anxiety Management', 'Resources for managing anxiety and stress'),
('Depression Support', 'Information and tools for depression'),
('Academic Stress', 'Coping strategies for academic pressure'),
('Crisis Resources', 'Emergency contacts and crisis intervention'),
('Self-Care', 'General wellness and self-care practices');

INSERT INTO forum_categories (name, description) VALUES 
('General Discussion', 'General mental health discussions'),
('Academic Stress', 'Sharing experiences about academic pressure'),
('Anxiety & Panic', 'Support for anxiety-related concerns'),
('Depression Support', 'Community support for depression'),
('Success Stories', 'Sharing positive experiences and recovery');

-- Insert default admin user (password will be hashed in application)
INSERT INTO users (email, password_hash, first_name, last_name, role, institution_id, is_verified) VALUES 
('admin@gmail.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8Kz8KzK', 'System', 'Administrator', 'college_admin', 
 (SELECT id FROM institutions WHERE type = 'college' LIMIT 1), true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Feedback table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
