// Get the module express
const express = require("express");
const expressHandlebars = require("express-handlebars");
const session = require("express-session");
const canvas = require("canvas");

// Import sqlite modules
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

// Import and configure dotenv to load environment variables from the .env file
require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const crypto = require("crypto");

// Replace hardcoded client ID and secret values with references to the environment variables.
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//  .all(): Retrieves all rows, resolves to an array of objects.
//  .exec(): Executes a query without returning data, resolves to undefined.
//  .get(): Retrieves the first row, resolves to an object.
//  .run(): Executes a data-changing query, resolves to metadata about the execution.
const dbFileName = "test.db";

async function initializeDB() {
  try {
    // Asynchronously opens a connection to an SQLite database file
    // Using await to wait for the connection to be succesful
    // Now that we have the db object we can use it to execute SQL queries
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");

    // Create tables if they don't exist
    // Using .exec because it a method that returns no data
    // Returns a Prmosie that resolves to undefined
    // Once I have the google autho change it
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL,
            likedAmount TEXT NOT NULL
        );
    `);
    // Insert users
    // Promise.all waits for all the other promises to complete
    // users.map is used to iterate over each user in the users array and perform an asynchronous operation (inserting the user into a database) for each user
    await Promise.all(
      users.map(async (user) => {
        // .run use when INSERT UPDATE or DELETE
        await db.run(
          "INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)",
          [
            user.username,
            user.hashedGoogleId,
            user.avatar_url,
            user.memberSince,
          ]
        );
        console.log("Inserted user:", user); // Log the inserted user
      })
    );

    // Insert posts
    await Promise.all(
      posts.map(async (post) => {
        await db.run(
          "INSERT INTO posts (title, content, username, timestamp, likes, likedAmount) VALUES (?, ?, ?, ?, ?, ?)",
          [
            post.title,
            post.content,
            post.username,
            post.timestamp,
            post.likes,
            JSON.stringify(post.likedAmount),
          ]
        );
        // Check if they are being inserted into the datatbase
        console.log("Inserted post:", post);
      })
    );

    // Close the database connection after all operations
    console.log("Database populated with initial data.");
    await db.close();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}
initializeDB();

// Get access to all the methods of express
const app = express();
const PORT = 3000;

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
app.engine(
  "handlebars",
  expressHandlebars.engine({
    helpers: {
      toLowerCase: function (str) {
        return str.toLowerCase();
      },
      ifCond: function (v1, v2, options) {
        if (v1 === v2) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
    },
  })
);

app.set("view engine", "handlebars");
app.set("views", "./views");

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
  session({
    secret: "oneringtorulethemall", // Secret key to sign the session ID cookie
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: { secure: false }, // True if using https. Set to false for development without https
  })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files.
app.use((req, res, next) => {
  res.locals.appName = "FitBlog";
  res.locals.copyrightYear = 2024;
  res.locals.postNeoType = "Post";
  res.locals.loggedIn = req.session.loggedIn || false;
  res.locals.userId = req.session.userId || "";
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; frame-src 'self' https://accounts.google.com;"
  );
  next();
});

app.use(express.static("public")); // Serve static files
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Configure passport
passport.use(
  new GoogleStrategy(
    {
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: `http://localhost:${PORT}/auth/google/callback`,
    },
    function (accessToken, refreshToken, profile, done) {
      if (!profile) {
        return done(new Error("No profile returned from Google"));
      }
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/",
  }),
  async (req, res) => {
    try {
      const googleId = req.user.id;
      const hashedGoogleId = crypto
        .createHash("sha256")
        .update(googleId)
        .digest("hex");
      req.session.hashedGoogleId = hashedGoogleId;
      let localUser = await findUserByHashedGoogleId(hashedGoogleId);
      if (localUser) {
        req.session.userId = localUser.id;
        req.session.loggedIn = true;
        res.redirect("/");
      } else {
        if (!req.session.Id) {
          res.redirect("/registerUser");
        } else {
          res.redirect("/");
        }
      }
    } catch (err) {
      console.error("Error finding user:", err);
      res.redirect("/error");
    }
  }
);

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
app.get("/", async (req, res) => {
  try {
    // Get all posts
    const posts = await getPosts();
    const user = (await getCurrentUser(req)) || {};
    // Render them
    res.render("home", { posts, user, style: "styles.css" });
  } catch (error) {
    console.error("Error rendering home page:", error);
    // Handle the error appropriately, such as rendering an error page or redirecting
    res.render("error");
  }
});

app.get("/registerUser", (req, res) => {
  res.render("registerUser", {
    regError: req.query.error,
    style: "login.css",
    username: null,
  });
});

// Register GET route is used for error response from registration
app.get("/register", (req, res) => {
  res.render("loginRegister", {
    regError: req.query.error,
    style: "login.css",
    username: null,
  });
});
// Login route GET route is used for error response from login
app.get("/login", (req, res) => {
  res.render("loginRegister", {
    loginError: req.query.error,
    style: "login.css",
  });
});
// Error route: render error page
app.get("/error", (req, res) => {
  res.render("error");
});
app.get("/posts", async (req, res) => {
  const category = req.query.category || "all";
  const posts = await getFilteredPost(category);
  const user = (await getCurrentUser(req)) || {};
  res.render("home", { posts, user, style: "styles.css" });
});
app.post("/posts", async (req, res) => {
  try {
    // Get postr info
    const { title, postInfo } = req.body;
    const userId = req.session.userId;
    // Get the current user from the database
    const user = await findUserById(userId);
    if (!userId || !user) {
      return res.redirect("/login");
    }
    // Add the new post
    await addPost(title, postInfo, user.username);
    // Redirect to home
    res.redirect("/");
  } catch (error) {
    console.error("Error handling post request:", error);
  }
});
app.post("/like/:id", isAuthenticated, (req, res) => {
  // TODO: Update post likes
  updatePostLikes(req, res);
});
app.get("/profile", isAuthenticated, (req, res) => {
  // TODO: Render profile page
  renderProfile(req, res);
});
app.get("/avatar/:username", (req, res) => {
  // TODO: Serve the avatar image for the user
  handleAvatar(req, res);
});
// app.post("/registerUser", async (req, res) => {
//   // TODO: Register a new user
//   // When for register button is clicked call this func
//   const username = req.body.username;
//   console.log(username);
//   registerUser(req, res);
//   res.render("loginRegister", { username, style: "login.css" });
// });

app.post("/registerUser", async (req, res) => {
  try {
    // Get the username from the request body
    const username = req.body.username.trim();
    console.log(username);
    const hashedGoogleId = req.session.hashedGoogleId;
    console.log(hashedGoogleId);
    // Check if the username is empty
    if (!username) {
      return res.redirect("/registerUser?error=Username%20cannot%20be%20empty");
    }
    // Check if the user already exists
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.redirect("/registerUser?error=Username%20already%20exists");
    }
    // Register the user (assuming addUser is synchronous)
    await addUser(username, hashedGoogleId);
    console.log("User registered successfully");
    // Redirect or send response as needed
    const user = await findUserByHashedGoogleId(hashedGoogleId);
    req.session.loggedIn = true;
    req.session.userId = user.id;
    res.redirect("/");
  } catch (error) {
    console.error("Error registering user:", error);
    res.redirect("/error");
  }
});

app.post("/login", (req, res) => {
  // When login button is clicked call this func
  loginUser(req, res);
});
app.get("/logout", async (req, res) => {
  // TODO: Logout the user
  await logoutUser(req, res);
});

app.get("/googleLogout", (req, res) => {
  res.render("googleLogout", {
    message: "You have been successfully logged out.",
  });
});

app.get("/logoutCallback", (req, res) => {
  console.log(req.session.Id, req.session.hashedGoogleId);
  res.redirect("/");
});

app.post("/delete/:id", isAuthenticated, async (req, res) => {
  try {
    // Get the post ID from the request parameters
    const postId = req.params.id;
    const currUser = await getCurrentUser(req);
    // Check if user is authenticated
    if (!currUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    // Delete the post
    const result = await deletePostById(postId, currUser);
    // Check if deletion was successful
    if (result.error) {
      return res.status(403).json({ error: result.error });
    }
    // Fetch the updated list of posts
    const posts = await getPosts();
    res.status(200).json({ message: result.success, posts });
  } catch (error) {
    // Handle errors
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users
let posts = [
  {
    title: "Unlock Your Potential: Embrace the Fitness Journey!",
    content:
      "Hey FitFam! Today, I'm sharing my journey from couch potato to fitness enthusiast. It wasn't easy, but the results are worth it! Remember, every step forward, no matter how small, is progress. Let's conquer those fitness goals together!",
    username: "FitFreak",
    timestamp: "2024-01-01M3:55:54 PM",
    likes: 2,
    likedAmount: [],
  },
  {
    title: "Fuel Your Fire: Tips for a Powerful Workout!",
    content:
      "Hey warriors! Need a boost? Try pre-workout snacks like banana with almond butter or Greek yogurt with berries for sustained energy. Keep pushing!",
    username: "GymRat",
    timestamp: "2024-02-16M1:20:30 PM",
    likes: 5,
    likedAmount: [],
  },
  {
    title: "Mind Over Matter: Cultivating Mental Resilience!",
    content:
      "Hello champions! Fitness isn't just about physical strength; it's about mental toughness too. When you feel like giving up, visualize your success.",
    username: "IronMind",
    timestamp: "2024-02-16M5:30:30 PM",
    likes: 20,
    likedAmount: [],
  },
];

let users = [
  {
    username: "FitFreak",
    hashedGoogleId: undefined,
    avatar_url: undefined,
    memberSince: "1/1/2024, 8:30:54 AM",
  },
  {
    username: "GymRat",
    hashedGoogleId: undefined,
    avatar_url: undefined,
    memberSince: "2/12/2024, 1:20:30 AM",
  },
  {
    username: "IronMind",
    hashedGoogleId: undefined,
    avatar_url: undefined,
    memberSince: "4/20/2024, 2:00:00 PM",
  },
];

async function findUserByUsername(username) {
  try {
    // Open the database connection
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Use the User model to find a user with the given username
    const user = await db.get("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    await db.close();
    return user; // Returns null if user is not found
  } catch (error) {
    console.error("Error finding user by username:", error);
    throw error; // Rethrow the error for handling elsewhere
  }
}

async function findUserById(userId) {
  //TODO: Return the user object if the session user ID matches
  try {
    // Open the database connection
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Retrieve the user ID from the session
    if (!userId) {
      return null;
    }
    // Query the database for the user with the matching ID
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    // Close the database connection
    await db.close();
    // Return the user if found
    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// async function addUser(username, hashedGoogleIds) {
//   try {
//     // Open a connection to the database
//     const db = await sqlite.open({
//       filename: dbFileName,
//       driver: sqlite3.Database,
//     });
//     console.log("Connected to the SQLite database.");

//     // Insert the user into the users table
//     // Once I have the goog autho add it
//     await db.run("INSERT INTO users (username, memberSince) VALUES (?, ?)", [
//       username,
//       new Date().toISOString(),
//     ]);
//     console.log(`User '${username}' added successfully`);
//     // Close the database connection
//     await db.close();
//   } catch (error) {
//     throw error;
//   }
// }

async function addUser(username, hashedGoogleId) {
  try {
    // Open a connection to the database
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");

    // Insert the user into the users table
    // Once I have the goog autho add it
    await db.run(
      "INSERT INTO users (username, hashedGoogleId, memberSince) VALUES (?, ?, ?)",
      [username, hashedGoogleId, new Date().toISOString()]
    );
    console.log(`User '${username}' added successfully`);
    // Close the database connection
    await db.close();
  } catch (error) {
    throw error;
  }
}

// Middleware to check if user is authenticated
// If req.session.userId exist it calls the next func for the next authentication
function isAuthenticated(req, res, next) {
  console.log(req.session.userId);
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}

// // Function to register a user
// async function registerUser(req, res) {
//   try {
//     // Get the username from the request body
//     const username = req.body.username.trim();
//     console.log(username);
//     const hashedGoogleId = req.session.hashedGoogleId;
//     console.log(hashedGoogleId);
//     // Check if the username is empty
//     if (!username) {
//       return res.redirect("/registerUser?error=Username%20cannot%20be%20empty");
//     }
//     // Check if the user already exists
//     const existingUser = await findUserByUsername(username);
//     if (existingUser) {
//       return res.redirect("/registerUser?error=Username%20already%20exists");
//     }
//     // Register the user (assuming addUser is synchronous)
//     await addUser(username, hashedGoogleId);
//     console.log("User registered successfully");
//     // Redirect or send response as needed
//     const user = await findUserByHashedGoogleId(hashedGoogleId);
//     req.session.loggedIn = true;
//     req.session.userId = user.id;
//     res.redirect("/");
//   } catch (error) {
//     console.error("Error registering user:", error);
//     res.redirect("/error");
//   }
// }

async function loginUser(req, res) {
  try {
    // Get user name being inputed
    const username = req.body.username;
    // Open connection to database
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Looks in the database for username and if it matches it attaches it to user
    const user = await db.get("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    // Close the database connection
    await db.close();
    //  If found log in
    if (user) {
      // indcates the user is logged in
      req.session.loggedIn = true;
      // sets userID
      req.session.userId = user.id;
      console.log(user.id);
      // redirects to the main page
      res.redirect("/");
      console.log("User logged in:", user.username);
    }
    // User not in the system
    else {
      console.log("no user found");
      return res.redirect("/login?error=Username%20not%20found");
    }
  } catch (error) {
    // Handle any errors
    console.error("Error logging in:", error);
    res.redirect("/error");
  }
}

// // Function to logout a user
// function logoutUser(req, res) {
//   // TODO: Destroy session and redirect appropriately
//   req.session.destroy((err) => {
//     if (err) {
//       console.error("Error destroying session: ", err);
//       res.redirect("/error");
//     } else {
//       // res.sendFile(path.join(__dirname, "public", "googleLogout.html"));
//       // res.redirect("/");
//       // res.sendFile(__dirname + "/views/logout.html");
//       res.redirect("/googleLogout");
//       console.log("logout!");
//     }
//   });
// }

async function logoutUser(req, res) {
  try {
    await req.session.destroy();
    await res.redirect("/googleLogout");
    // res.sendFile(__dirname + "/views/logout.html");
    // // res.sendFile(path.join(__dirname, "public", "logout.html"));
  } catch (err) {
    console.error("Error destroying session: ", err);
    res.redirect("/error");
  }
}

// Function to render the profile page
// Function to render the profile page
async function renderProfile(req, res) {
  try {
    // Get the current user based on the session
    const currentUser = await getCurrentUser(req);
    // Fetch all posts from the database
    const allPosts = await getPosts();
    // Filter posts
    const userPosts = allPosts.filter(
      (post) => post.username === currentUser.username
    );
    // Render the profile page with user information and posts
    res.render("profile", {
      user: currentUser,
      posts: userPosts,
      style: "profile.css",
    });
    console.log("In profile of ", currentUser);
  } catch (error) {
    console.error("Error rendering profile page:", error);
    res.redirect("/error");
  }
}

// Function to update post likes
async function updatePostLikes(req, res) {
  try {
    // Open connection to database
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");

    const postId = req.params.id;
    const userId = req.session.userId;

    // Retrieve the post from the database
    const post = await db.get("SELECT * FROM posts WHERE id = ?", [postId]);

    if (!post) {
      // Close the database connection
      await db.close();
      return res.status(404).json({ error: "Post not found" });
    }

    // Parse likedAmount from JSON to array
    let likedAmountArray = [];
    try {
      likedAmountArray = JSON.parse(post.likedAmount);
    } catch (error) {
      console.error("Error parsing likedAmount:", error);
    }

    // Check if the user has already liked the post
    if (likedAmountArray.includes(userId)) {
      // Close the database connection
      await db.close();
      return res.status(403).json({ error: "You already liked this post" });
    }

    // Update likes and likedAmount
    post.likes++;
    likedAmountArray.push(userId);

    // Update the likedAmount field in the database with the new array
    await db.run("UPDATE posts SET likes = ?, likedAmount = ? WHERE id = ?", [
      post.likes,
      JSON.stringify(likedAmountArray),
      postId,
    ]);

    // Close the database connection
    await db.close();

    res
      .status(200)
      .json({ message: "Post liked successfully", likes: post.likes });
  } catch (error) {
    console.error("Error updating post likes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

function handleAvatar(req, res) {
  // TODO: Generate and serve the user's avatar image
  const username = req.params.username;
  // Get first letter and make it uppercase
  const firstLetter = username.charAt(0).toUpperCase();
  // Call generateAvatar with the first letter
  const avatarData = generateAvatar(firstLetter);
  // Set Content-Type header to indicate image type and send the avatar image as a response
  res.setHeader("Content-Type", "image/png");
  res.send(avatarData);
}

// Function to get the current user from session
async function getCurrentUser(req) {
  try {
    // Retrieve the user ID from the session
    const userId = req.session.userId;
    if (!userId) {
      return null; // No user ID in session
    }
    // Open the database connection
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");

    // Query the database for the user with the matching ID
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    // Close the database connection
    await db.close();
    // Return the user object if found
    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

async function getPosts() {
  try {
    // Open the database connection
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Query all posts from the database
    // Get them by decsdeing order of time stamp
    const posts = await db.all("SELECT * FROM posts ORDER BY timestamp DESC");

    // Close the DB
    await db.close();
    // Return the posts
    return posts;
  } catch (error) {
    console.error("Error getting posts:", error);
    return null;
  }
}

async function getPostById(postId) {
  try {
    // Open the database connection
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Query the database to retrieve the post with the specified ID
    const post = await db.get("SELECT * FROM posts WHERE id = ?", [postId]);
    // Close the database connection
    await db.close();
    // Return the retrieved post
    return post;
  } catch (error) {
    // Handle any errors that occur during the database operation
    console.error("Error retrieving post by ID:", error);
    return null;
  }
}

// Function to add a new post
async function addPost(title, content, username) {
  // data that is always inserted into post
  const timestamp = new Date().toISOString();
  const likes = 0;
  const likedAmount = [];
  try {
    // Open connection to database
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Inseert data to datbase
    await db.run(
      "INSERT INTO posts (title, content, username, timestamp, likes, likedAmount) VALUES (?, ?, ?, ?, ?, ?)",
      [title, content, username, timestamp, likes, JSON.stringify(likedAmount)]
    );
    // Check if they are being inserted into the datatbase
    console.log("Inserted post:", {
      title,
      content,
      username,
      timestamp,
      likes,
      likedAmount,
    });
    // Close the database connection after all operations
    await db.close();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Define a function to delete a post by ID
async function deletePostById(postId, currentUser) {
  try {
    console.log(postId, currentUser);
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Connected to the SQLite database.");
    // Check if the post exists
    const post = await db.get("SELECT username FROM posts WHERE id = ?", [
      postId,
    ]);
    if (!post) {
      console.error("Post not found");
      await db.close();
      return { error: "Post not found" };
    }
    // Check if the current user is the owner of the post or an admin
    if (post.username !== currentUser.username && !currentUser.isAdmin) {
      console.error("User is not authorized to delete this post");
      await db.close();
      return { error: "User is not authorized to delete this post" };
    }
    console.log("Deleting post ID:", postId);
    // Delete the post from the database
    await db.run("DELETE FROM posts WHERE id = ?", [postId]);
    await db.close();
    return { success: "Post deleted successfully" };
  } catch (error) {
    console.error("Error deleting post:", error);
    return { error: "Failed to delete post" };
  }
}
// async function findUserByHashedGoogleId(hashedGoogleId) {
//   try {
//     const currUser = await db.get(
//       "SELECT * FROM users WHERE hashedGoogleId = ?",
//       [hashedGoogleId]
//     );
//     return currUser;
//   } catch (err) {
//     throw err;
//   }
// }

async function findUserByHashedGoogleId(hashedGoogleId) {
  try {
    // Connect to DB
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    // Get hashedGoogleId
    const user = await db.get("SELECT * FROM users WHERE hashedGoogleId = ?", [
      hashedGoogleId,
    ]);
    console.log(user);
    // Close DB
    await db.close();
    // Return user object
    return user;
  } catch (error) {
    console.error("Error finding user by hashed Google ID:", error);
    throw error;
  }
}

async function getFilteredPost(category) {
  try {
    const db = await sqlite.open({
      filename: dbFileName,
      driver: sqlite3.Database,
    });
    console.log("Database connection established for filtering");

    let query;
    switch (category) {
      case "mostlikes":
        query = "SELECT * FROM posts ORDER BY likes DESC";
        break;
      case "Oldest":
        query = "SELECT * FROM posts ORDER BY timestamp ASC";
        break;
      default:
        query = "SELECT * FROM posts ORDER BY timestamp DESC";
        break;
    }

    console.log(`Executing query: ${query}`);
    const posts = await db.all(query);
    await db.close();
    console.log("Database connection closed after filtering");

    return posts;
  } catch (error) {
    console.error("Error in getFilteredPost function:", error);
    throw new Error("Failed to fetch filtered posts");
  }
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
  // TODO: Generate an avatar image with a letter
  // Steps:
  // 1. Choose a color scheme based on the letter
  const color = "#008B8B";
  // 2. Create a canvas with the specified width and height
  const canvas = require("canvas").createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  // 3. Draw the background color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  // 4. Draw the letter in the center
  ctx.fillStyle = "#fff";
  ctx.font = `${height * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, width / 2, height / 2);
  // 5. Return the avatar as a PNG buffer
  return canvas.toBuffer();
}
