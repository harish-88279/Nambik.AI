import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

// PostgreSQL connection pool
let pool: Pool;
let redisClient: any;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Initialize PostgreSQL connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 20000, // Return an error after 2 seconds if connection could not be established
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');

    // Ensure schema is compatible with current code (lightweight migrations)
    try {
      // Extensions for UUID generation (best-effort)
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

      // Create chat_sessions table if missing (minimal schema based on tables.json)
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID,
          session_type VARCHAR(50) NOT NULL DEFAULT 'ai_chat',
          is_anonymous BOOLEAN DEFAULT true,
          language VARCHAR(10) DEFAULT 'en',
          sentiment_score NUMERIC,
          crisis_risk_level INTEGER DEFAULT 0,
          started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure counselor_id exists
      await client.query('ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS counselor_id UUID');

      // Ensure session_type allows peer_chat (adjust CHECK constraint if present)
      await client.query(`DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'chat_sessions' AND constraint_name = 'chat_sessions_session_type_check'
        ) THEN
          ALTER TABLE chat_sessions DROP CONSTRAINT chat_sessions_session_type_check;
        END IF;
      END $$;`);
      await client.query(`
        ALTER TABLE chat_sessions
        ADD CONSTRAINT chat_sessions_session_type_check
        CHECK (session_type IN ('ai_chat','counselor_chat','peer_chat'))
      `);

      // Conditionally add FKs if referenced tables exist
      await client.query(`DO $$
      BEGIN
        -- Add FK to users(id) for counselor_id only if users table exists and constraint missing
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_counselor_id_fkey'
        ) THEN
          ALTER TABLE chat_sessions
          ADD CONSTRAINT chat_sessions_counselor_id_fkey
          FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Optionally add FK for user_id -> users(id)
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_user_id_fkey'
        ) THEN
          ALTER TABLE chat_sessions
          ADD CONSTRAINT chat_sessions_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;`);

      // Useful indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_counselor ON chat_sessions(counselor_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at ON chat_sessions(started_at)');

      // Create chat_messages table if missing (based on tables.json)
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id UUID,
          sender_type VARCHAR(20) NOT NULL,
          message_text TEXT NOT NULL,
          sentiment_score NUMERIC,
          is_flagged BOOLEAN DEFAULT false,
          flag_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes and FK for messages
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)');
      await client.query(`DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_session_id_fkey'
        ) THEN
          ALTER TABLE chat_messages
          ADD CONSTRAINT chat_messages_session_id_fkey
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
        END IF;
      END $$;`);

    } catch (e) {
      logger.warn('Startup schema check failed (continuing):', e);
    }

    client.release();
    
    logger.info('PostgreSQL connected successfully');
/*
    // Initialize Redis connection (optional for prototype)
    try {
      if (process.env.REDIS_URL) {
        redisClient = createClient({
          url: process.env.REDIS_URL,
          password: process.env.REDIS_PASSWORD,
        });

        redisClient.on('error', (err: Error) => {
          logger.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
          logger.info('Redis connected successfully');
        });

        await redisClient.connect();
      } else {
        logger.info('Redis URL not provided, skipping Redis initialization for prototype');
      }
    } catch (error) {
      logger.warn('Redis initialization failed, continuing without Redis for prototype:', error);
      // For prototype, we'll continue without Redis
    }
*/
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const getRedisClient = () => {
  if (!redisClient) {
    logger.warn('Redis client not initialized');
    return null;
  }
  return redisClient;
};

// Database query helper with connection pooling
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  const pool = getPool();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', { text, error });
    throw error;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Cache helper functions
export const cache = {
  async get(key: string): Promise<string | null> {
    if (!redisClient) return null;
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!redisClient) return;
    try {
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Redis delete error:', error);
    }
  },

  async exists(key: string): Promise<boolean> {
    if (!redisClient) return false;
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }
};

// Graceful shutdown
export const closeConnections = async (): Promise<void> => {
  try {
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL connection pool closed');
    }
    
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};
