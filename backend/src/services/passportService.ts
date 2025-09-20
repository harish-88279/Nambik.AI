import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (accessToken, refreshToken, profile, done) => {
      // --- FIX 1: Get the correct name parts from the 'name' object ---
      const { id, emails, name, photos } = profile;
      const email = emails?.[0].value;
      const firstName = name?.givenName || '';
      const lastName = name?.familyName || ''; // <-- Get the last name
      const photoUrl = photos?.[0].value;

      if (!email) {
        return done(new Error('No email found from Google'), undefined);
      }

      try {
        // Check if user already exists
        const existingUserResult = await query('SELECT * FROM users WHERE email = $1', [email]);

        if (existingUserResult.rows.length > 0) {
          const user = existingUserResult.rows[0];
          // Update last login time and potentially the google_id if it's missing
          await query('UPDATE users SET last_login = CURRENT_TIMESTAMP, google_id = $1 WHERE id = $2', [id, user.id]);
          return done(null, user);
        } else {
          // Create a new user
          // --- FIX 2: Add `last_name` to the INSERT query ---
          const newUserResult = await query(
            'INSERT INTO users (google_id, email, first_name, last_name, profile_picture_url, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, email, firstName, lastName, photoUrl, 'student', true]
          );
          const newUser = newUserResult.rows[0];
          return done(null, newUser);
        }
      } catch (error) {
        logger.error('Error in Google Strategy', { error });
        return done(error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
        if (userResult.rows.length > 0) {
            done(null, userResult.rows[0]);
        } else {
            done(new Error('User not found'), undefined);
        }
    } catch (error) {
        done(error, undefined);
    }
});