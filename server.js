// Get the module express
const express = require("express");
const expressHandlebars = require("express-handlebars");
const session = require("express-session");
const canvas = require("canvas");
const passport = require("passport");
require('./passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
//
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
app.use(passport.initialize());
app.use(passport.session());
// Replace any of these variables below with constants for your application. These variables
// should be used in your template files.
//
app.use((req, res, next) => {
  res.locals.appName = "FitBlog";
  res.locals.copyrightYear = 2024;
  res.locals.postNeoType = "Post";
  res.locals.loggedIn = req.session.loggedIn || false;
  res.locals.userId = req.session.userId || "";
  next();
});

app.use(express.static("public")); // Serve static files
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//

app.get("/", (req, res) => {
  const posts = getPosts();
  const user = getCurrentUser(req) || {};
  res.render("home", { posts, user, style: "styles.css" });
});
//redirect OAuth 2.0 server response
app.get("/auth/google", (req, res) => {
  passport.authenticate("google", { scope: [ "profile"] });
});
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (user) {
      req.session.userId = user.id;
      req.session.username = user.username;
      
      console.log(user);
      res.redirect("/");
    } else {
      res.redirect("/registerUsername");
    }
  }
);
// Register GET route is used for error response from registration
//
app.get("/register", (req, res) => {
  res.render("loginRegister", {
    regError: req.query.error,
    style: "login.css",
    username: null,
  });
});

// Login route GET route is used for error response from login
//
app.get("/login", (req, res) => {
  res.render("loginRegister", {
    loginError: req.query.error,
    style: "login.css",
  });
});

// Error route: render error page
//
app.get("/error", (req, res) => {
  res.render("error");
});

// Additional routes that you must implement
/**
app.get("/post/:id", (req, res) => {
  // TODO: Render post detail page
  const postId = req.session.id;
  const post = posts.find((post) => post.id === postId);

  if (post) {
    res.render("postDetail", { post, style: "styles.css" });
  } else {
    console.log("no post");
  }
});
 */
app.post("/posts", (req, res) => {
  // TODO: Add a new post and redirect to home
  const { title, postInfo } = req.body;
  const userId = req.session.userId;
  const user = findUserById(userId);
  if (!userId || !user) {
    return res.redirect("/login");
  }
  addPost(title, postInfo, user);
  res.redirect("/");
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

app.post("/register", (req, res) => {
  // TODO: Register a new user
  // When for register button is clicked call this func
  const username = req.body.username;
  registerUser(req, res);
  res.render("loginRegister", { username, style: "login.css" });
});

// app.post('/register, registerUser')

app.post("/login", (req, res) => {
  // When login button is clicked call this func
  loginUser(req, res);
});

app.get("/logout", (req, res) => {
  // TODO: Logout the user
  logoutUser(req, res);
});
app.post("/delete/:id", isAuthenticated, (req, res) => {
  // TODO: Delete a post if the current user is the owner
  //Get the post ID from the request parameters
  const postId = parseInt(req.params.id);
  // Find the index of the post in the posts array
  const postIndex = posts.findIndex((post) => post.id === postId);
  // If the post exists and the current user is the owner of the post, delete it
  if (
    postIndex !== -1 &&
    posts[postIndex].username === getCurrentUser(req).username
  ) {
    posts.splice(postIndex, 1);
    res.status(200).json({ message: "Post deleted successfully" });
  } else {
    // If the post doesn't exist or the current user is not the owner, send an error response
    res
      .status(403)
      .json({ error: "You are not authorized to delete this post" });
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
    id: 1,
    title: "Unlock Your Potential: Embrace the Fitness Journey!",
    content:
      "Hey FitFam! Today, I'm sharing my journey from couch potato to fitness enthusiast. It wasn't easy, but the results are worth it! Remember, every step forward, no matter how small, is progress. Let's conquer those fitness goals together!",
    username: "FitFreak",
    timestamp: "1/1/2024, 3:55:54 PM",
    likes: 0,
    likedAmount: [],
  },
  {
    id: 2,
    title: "Fuel Your Fire: Tips for a Powerful Workout!",
    content:
      "Hey warriors! Need a boost? Try pre-workout snacks like banana with almond butter or Greek yogurt with berries for sustained energy. Keep pushing!",
    username: "GymRat",
    timestamp: "2/16/2024, 1:20:30 AM",
    likes: 0,
    likedAmount: [],
  },
  {
    id: 3,
    title: "Mind Over Matter: Cultivating Mental Resilience!",
    content:
      "Hello champions! Fitness isn't just about physical strength; it's about mental toughness too. When you feel like giving up, visualize your success.",
    username: "IronMind",
    timestamp: "4/20/2024, 4:20: PM",
    likes: 0,
    likedAmount: [],
  },
];

let users = [
  {
    id: 1,
    username: "FitFreak",
    avatar_url: undefined,
    memberSince: "1/1/2024, 8:30:54 AM",
  },
  {
    id: 2,
    username: "GymRat",
    avatar_url: undefined,
    memberSince: "2/12/2024, 1:20:30 AM",
  },
  {
    id: 3,
    username: "IronMind",
    avatar_url: undefined,
    memberSince: "4/20/2024, 2:00:00 PM",
  },
];

// Function to find a user by username
function findUserByUsername(username) {
  // TODO: Return user object if found, otherwise return undefined
  const existingUser = users.find((user) => user.username === username);
  if (existingUser) {
    return existingUser;
  } else {
    return undefined;
  }
}

// Function to find a user by user ID
function findUserById(userId) {
  // TODO: Return user object if found, otherwise return undefined
  // const existingID =  users.find(user => user.id === userId);
  // if(existingUser){
  //     return existingUser;
  // }
  // else{
  //     return undefined
  // }
  return users.find((user) => user.id === userId);
}

// Function to add a new user
function addUser(username) {
  // TODO: Create a new user object and add to users array
  // We need to access the last id
  let idNum = users[users.length - 1].id;
  // New object
  let newUser = {
    id: ++idNum,
    username: username,
    avatar_url: undefined,
    memberSince: new Date().toLocaleString(),
  };
  // Adds the user to the end of the users array
  users.push(newUser);
  console.log(users);
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

// Function to register a user
function registerUser(req, res) {
  // TODO: Register a new user and redirect appropriately
  // Get the user name that was typed by req.body
  const username = req.body.username;
  // If user name already exist dont let user register
  const existingUser = findUserByUsername(username);
  if (existingUser) {
    // Username already exists, redirect back to registration page with an error message
    return res.redirect("/register?error=Username%20already%20exists");
  }
  // Let them register and send call func adduser to add him into the array of Users
  else {
    console.log("Got username " + username);
    addUser(username);
    console.log("You have succesfully registered");
  }
}

// Function to login a user
function loginUser(req, res) {
  // TODO: Login a user and redirect appropriately
  // Get the user name that was typed by req.body
  const username = req.body.username;
  const existingUser = findUserByUsername(username);
  // Check for existing username
  // const userid = req.session.userId
  // const existingUser = findUserByUsername(userid)
  // If found log in
  if (existingUser) {
    // indcates the user is logged in
    req.session.loggedIn = true;
    // sets userID
    req.session.userId = existingUser.id;
    console.log(existingUser.id);
    // redirects to the main page
    res.redirect("/");
    console.log("logging in");
  }
  // User not in the system
  else {
    console.log("no user found");
    return res.redirect("/login?error=Username%20not%20found");
  }
}

// Function to logout a user
function logoutUser(req, res) {
  // TODO: Destroy session and redirect appropriately
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session: ", err);
      res.redirect("/error");
    } else {
      res.redirect("/");
      console.log("logout!");
    }
  });
}

// Function to render the profile page
function renderProfile(req, res) {
  // TODO: Fetch user posts and render the profile page
  const currentUser = getCurrentUser(req);

  if (currentUser) {
    // Fetch user posts filters post to only currentuser
    const userPosts = getPosts().filter(
      (post) => post.username === currentUser.username
    );
    res.render("profile", {
      user: currentUser,
      posts: userPosts,
      style: "profile.css",
    });
    console.log("In profile of ", currentUser);
  } else {
    // If the current user is not found, redirect to login page
    res.redirect("/login");
  }
}

// Function to update post likes
function updatePostLikes(req, res) {
  // TODO: Increment post likes if conditions are met
  // Get id beening passed in
  const postId = req.params.id;
  // Get current userid
  const userId = req.session.userId;
  // Find the post
  const post = posts.find((post) => post.id === parseInt(postId));
  console.log("postId");
  console.log(post);
  // If doesnt equal post
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  // Dont allow to like the same post
  if (post.likedAmount.includes(userId)) {
    return res.status(403).json({ error: "You already liked this post" });
  }
  // Increment likes
  post.likes++;
  post.likedAmount.push(userId);
  res
    .status(200)
    .json({ message: "Post liked successfully", likes: post.likes });
}
// Function to handle avatar generation and serving
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
function getCurrentUser(req) {
  // TODO: Return the user object if the session user ID matches
  return users.find((user) => user.id === req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
  return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, postInfo, user) {
  // TODO: Create a new post object and add to posts array
  let idNum = posts.length > 0 ? posts[posts.length - 1].id + 1 : 1;
  let newPost = {
    id: idNum,
    title: title,
    content: postInfo,
    username: user.username,
    timestamp: new Date().toLocaleString(),
    likes: 0,
    likedAmount: [],
  };
  posts.push(newPost);
  console.log(posts);
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
