require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//not need to require pasport-local
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

//setup session
app.use(
  session({
    secret: "Our little secret",
    resave: false,
    saveUninitialized: false,
  })
); //use express-session

//initalize passport and use passport to manage session
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true); //due to depreciation warning

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId:String,
  secret:String
});

//set up passportLocalMongoose as plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

//create a strategy and serialize and deserialize
passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID:process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  //userProfileURL:"http://www.googleapis.com/oauth2/v3/userinfo"
},      
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);

  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

app.get("/", function (req, res) {
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app
  .route("/register")
  .get(function (req, res) {
    res.render("register");
  })
  .post(function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (
      err,
      user
    ) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    });
  });

app.get("/secrets", function (req, res) {
  //now to see all the secrets on secrets page
  User.find({"secret":{$ne:null}},function(err,foundUsers){
    if(err){
      console.log(err);
    }else{
      if(foundUsers){
        res.render("secrets",{userWithSecrets:foundUsers});
      }
    }
  });
  //this was only to take the authicated user to seccret page
  // if (req.isAuthenticated()) {
  //   res.render("secrets");
  // } else {
  //   res.redirect("/login");
  // }
});

app.route("/submit")
.get(function(req,res){
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
})
.post(function(req,res){
  const submittedSecret = req.body.secret;

  console.log(req.user.id);  

  User.findById(req.user.id,function(err,foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser)
      foundUser.secret = submittedSecret;
      foundUser.save(function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});
app
  .route("/login")
  .get(function (req, res) {
    res.render("login");
  })
  .post(function (req, res) {
    const user = new User({
      username: req.body.username,
      password: req.body.password,
    });
    //this method comes from passport
    req.login(user, function (err) {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    });
  });

app.listen(3000, function (req, res) {
  console.log("port started successfully on port 3000");
});

// const encrypt = require("mongoose-encryption");
// userSchema.plugin(encrypt, {
//   secret: process.env.SECRET,
//   encryptedFields: ["password"],
// }); //for mongoose-encyption method
//we used process.env.password method and we also have to mention the plugin
//instead we will use hash function by md5

// const md5 = require("md5");will be using bcrypt
//in md5 we used md5(req.body.password );in login as well as register route

// const bcrypt = require("bcrypt");
// const saltRounds = 10; instead we will use passport authentication
//in this we used a method of bcrypt. etc mentioned below

//app.post("/register",function (req, res) {
// bcrypt.hash(req.body.password, saltRounds, function (err, hash) {

// });
// const newUser = new User({
//   email: req.body.username,
//   password:req.body.password,
// });
// newUser.save(function (err) {
//   if (err) {
//     console.log(err);
//   } else {
//     res.render("secrets");
//   }
// });
//});

//app.post("/login",function (req, res) {
// const username = req.body.username;
// const password = req.body.password;

// User.findOne({ email: username }, function (err, foundUser) {
//   if (err) {
//     console.log(err);
//   } else {
//     if (foundUser) {
//       bcrypt.compare(password, foundUser.password, function (err, result) {
//         if (result === true) {
//           res.render("secrets");
//         }
//       });
//       // if (foundUser.password === password) {}instead used bcrypt compare method
//     }
//   }
// });
//});
