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
        database: process.env.RDS_DB_NAME || ebdb,
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

app.get("/budget", (req, res) => {
  res.render('budget');
});

app.get("/stocks", (req, res) => {
  res.render('stocks');
});

app.get("/realestate", (req, res) => {
  res.render('realestate');
});

app.get("/savingaccount", (req, res) => {
  res.render('savingaccount');
});


// Shows the register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Gets inputs from the register page
app.post("/register", async (req, res) => {
  try {
    await knex.transaction(async (trx) => {
      const existingUser = await trx("login").where({ email: req.body.email }).first();

      if (existingUser) {
        return res.status(400).json({ error: 'Email address is already in use' });
      }

      // Username doesn't exist, proceed with registration
      await trx("login").insert({
        email: req.body.email,
        password: req.body.password
      })

      await trx("users").insert({
        email: req.body.email,
        first_name: req.body.first,
        last_name: req.body.last,
        income_id: req.body.income
      });
      res.redirect("/login");
    });
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
    const user = await knex("login").where("email", "=", email).first();

    if (!user || password !== user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Query the database to get user ID associated with the email
    const userID = await knex
      .select("u.user_id")
      .from({ u: "users" })
      .where("u.email", "=", email)
      .first();

    if (!userID) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    req.session.authenticated = true;
    req.session.userID = userID.user_id;

    res.redirect("/");
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
    amount: req.body.expenseAmount,
    user_id: req.session.userID
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

//Page to view all transactions based on user id
app.get("/viewTransactions", authenticateMiddleware, async (req, res) => {
  try {
    const transactions = await knex
      .select("u.user_id", "t.amount", "tt.transaction_category")
      .from({ u: "users" })
      .join({ t: "transactions" }, "t.user_id", "=", "u.user_id")
      .join({ tt: "transaction_type" }, "tt.transaction_type_id", "=", "t.transaction_type_id")
      .where("u.user_id", "=", req.session.userID);

    res.render("viewTransactions", { myuser: transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});