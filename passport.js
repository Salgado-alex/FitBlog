const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Express app setup
const app = express();
const PORT = 3000;

// Use environment variables for client ID and secret
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
//pasport
passport.use(
  new GoogleStrategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: `http://localhost:${PORT}/auth/google/callback`,
    },
    (token, tokenSecret, profile, done) => {
      return done(null, profile);
    }
  )
);
passport.serializeUser((user, done) => {
  const hashedGoogleId = createHash(user.id);
  done(null, hashedGoogleId); // Store hashed Google ID in session
});

passport.deserializeUser(async (hashedGoogleId, done) => {
  try {
    const user = await db.get("SELECT * FROM users WHERE hashedGoogleId = ?", [
      hashedGoogleId,
    ]);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
