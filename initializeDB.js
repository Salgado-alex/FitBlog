// Import sqlite modules
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

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
            likedAmount TEXT NOT NULL,
            image TEXT
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postId INTEGER NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            FOREIGN KEY (postId) REFERENCES posts(id),
            FOREIGN KEY (username) REFERENCES users(username)
        );
`);
    // Example data for posts and users
    let posts = [
      {
        title: "Unlock Your Potential: Embrace the Fitness Journey!",
        content:
          "Hey FitFam! Today, I'm sharing my journey from couch potato to fitness enthusiast. It wasn't easy, but the results are worth it! Remember, every step forward, no matter how small, is progress. Let's conquer those fitness goals together!",
        username: "FitFreak",
        timestamp: "1/1/2024, 3:55:54 PM",
        likes: 2,
        likedAmount: [],
        image: "",
      },
      {
        title: "Fuel Your Fire: Tips for a Powerful Workout!",
        content:
          "Hey warriors! Need a boost? Try pre-workout snacks like banana with almond butter or Greek yogurt with berries for sustained energy. Keep pushing!",
        username: "GymRat",
        timestamp: "2/16/2024, 1:20:30 PM",
        likes: 5,
        likedAmount: [],
        image: "",
      },
      {
        title: "Mind Over Matter: Cultivating Mental Resilience!",
        content:
          "Hello champions! Fitness isn't just about physical strength; it's about mental toughness too. When you feel like giving up, visualize your success.",
        username: "IronMind",
        timestamp: "2/16/2024, 5:30:30 PM",
        likes: 20,
        likedAmount: [],
        image: "/upload/gym.jpg",
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
          "INSERT INTO posts (title, content, username, timestamp, likes, likedAmount, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            post.title,
            post.content,
            post.username,
            post.timestamp,
            post.likes,
            JSON.stringify(post.likedAmount),
            post.image,
          ]
        );
        // Check if they are being inserted into the datatbase
        console.log("Inserted post:", post);
      })
    );
    await Promise.all(
      comments.map((comment) => {
        return db.run(
          "INSERT INTO comments (postId, username, content, timestamp) VALUES (?, ?, ?, ?)",
          [comment.postId, comment.username, comment.content, comment.timestamp]
        );
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
