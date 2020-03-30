"use-strict";

/* Environment Variables from .env */
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 5000;
const env = process.env.NODE_ENV || "development";

/* Installed Modules */
const express = require("express");
const app = express();
const user = require(__dirname+'/routes/api/user');
const auth = require(__dirname+'/routes/api/auth');
const courses = require(__dirname+'/routes/api/courses');
const problems = require(__dirname+'/routes/api/problems');
const authMiddleware = require(__dirname+'/middlewares/auth.js');
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors")
/* Setup database */
mongoDBUrl = process.env.MONGODB_CONNECT_URL || "mongodb://localhost/code4degree";
mongoose.connect(mongoDBUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});
mongoose.set('useFindAndModify', false);
var db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", function() {
  console.log("Database connected");
});

/* Set up View */
app.set("views", "./views");
app.set("view engine", "pug"); //Can used for quickly testing out the backend

/* Set up body parser to parse json */
app.use(cors({
  exposedHeaders: 'x-auth-token'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

/*Routes*/
app.get("/", (req, res, next) => {
  res.render("welcome", {
    title: "Code4Degree",
    message: "An online assignment submission platform"
  });
});

//TODO: Other routes need to be changed
app.use('/api/login', auth);
app.use('/api/user', user);

app.use('/api/courses', authMiddleware, courses);

// Delete this, router transferred in Course router
// app.use('/api/course/:courseId/problems', (req, res, next) => {
//   res.locals.userId = req.params.userId;
//   res.locals.courseId = req.params.courseId;
//   next();
// }, problems);

app.listen(port, () => console.log(`${env} server listening on port ${port}!`));
