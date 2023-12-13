//Section 03, Group 11
//Jacob Bigler, Andrew Hunsaker, Javier De los Reyes, Joseph Flake
//This page handles requests and responses to and from the server.

//Define Constants:
const port = process.env.PORT || 3000;
const path = require("path");
const session = require('express-session');
const ejs = require("ejs");

//middleware function that checks the authenticated variable
const authenticateMiddleware = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    // User is authenticated, allow access to the next middleware or route
    next();
  } else {
    // User is not authenticated, redirect to a login page or send an error response
    res.status(401).json({ error: 'Authentication required' });
  }
};

//Define & Configure Express:
let express = require("express");
let app = express();

// Serve static files from the "content" directory
app.use(express.static('assets'));

// Parse incoming requests:
app.use(express.urlencoded({ extended: true }));

//use the session
app.use(
  session({
    secret: 'proj3',
    resave: true,
    saveUninitialized: true,
  })
);

// Custom middleware to set authenticated and admin variables
app.use((req, res, next) => {
  const isAuthenticated = req.session && req.session.authenticated;
  const isAdmin = req.session && req.session.admin;

  // Make the authenticated and admin variables available to all views
  res.locals.authenticated = isAuthenticated;
  res.locals.admin = isAdmin;

  // Continue to the next middleware
  next();
});

//Define EJS location:
app.set("view engine", "ejs");
//Define views location
app.set('views', __dirname + '/views');


console.log("Server is running.");

//Activate listener:
app.listen(port, () => console.log("Server is running."));


//Connect to database using knex
const knex = require("knex")({
    client: "pg",
    connection: { //RDS is for connecting to the DB in Elastic Beanstalk
        host: process.env.RDS_HOSTNAME,
        user: process.env.RDS_USERNAME || "project3",
        password: process.env.RDS_PASSWORD || "password123",
        database: process.env.RDS_DB_NAME || budgetbuddy,
        port: process.env.RDS_PORT || 5432,
        ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false
    }
})

// Function to get unique user IDs
async function getUniqueAndSortedUserIds() {
  const userIds = await knex.select('user_id').from('user_inputs');
  const uniqueUserIds = [...new Set(userIds.map(entry => entry.user_id))];
  const sortedUserIds = uniqueUserIds.sort((a, b) => a - b);
  return sortedUserIds;
}

//Get requests below:

// Shows landing page
app.get("/", (req, res) => {
  res.render('index');
});

// Shows the register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Gets inputs from the register page
app.post("/register", async (req, res) => {
  try {
    const existingUser = await knex("login").where({ email: req.body.username }).first();

    if (existingUser) {
      // If email already exists, return an error response
      return res.status(400).json({ error: 'Email address is already in use' });
    }

    // Username doesn't exist, proceed with registration
    await knex("login").insert({
      email: req.body.email,
      password: req.body.password
    });

    res.redirect("/login");

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shows the login page
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Query the database to get user information
    const user = await knex("login").where({ email }).first();


    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare the provided password with the stored password from the database
    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    };

    req.session.authenticated = true;

    res.redirect("/")
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//transaction page, only available to those who are logged in
app.get("/transaction", authenticateMiddleware, (req, res) => {
  res.render("transaction");
});

app.post("/transaction", async (req, res) => {
  await knex("transactions").insert({
    transaction_type_id: req.body.transactionType,
    amount: req.body.expenseAmount
  })
  res.redirect("/");
});


//to logout and invalidate the authentication
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
    } else {
      res.redirect('/');
    }
  });
});