const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
let mongoose;
try {
  mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

let exerciseSessionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String
});

let userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSessionSchema]
});

let Session = mongoose.model("Session", exerciseSessionSchema);
let User = mongoose.model("User", userSchema);

app.post(
  "/api/exercise/new-user",
  bodyParser.urlencoded({ extended: false }),
  (request, response) => {
    let responseObject = {};
    let user = request.body.username;
    //check if user is an empty string
    if (user != "") {
      //check if the user already exists in the database
      let query = User.where({ username: user });
      query.findOne(function(err, existingUser) {
        //create new user
        if (!existingUser && !err) {
          let newUser = User({ username: user });
          newUser.save((error, savedUser) => {
            if (!error) {
              responseObject["username"] = savedUser.username;
              responseObject["_id"] = savedUser.id;
              response.json(responseObject);
            } else {
              responseObject = { error: error };
              response.json(responseObject);
            }
          });
        } else if (existingUser && !err) {
          responseObject = {
            error: "User " + existingUser.username + " already exists"
          };
          response.json(responseObject);
        } else {
          responseObject = { error: err };
          response.json(responseObject);
        }
      });
    } else {
      responseObject = { error: "User field has not been completed" };
      response.json(responseObject);
    }
  }
);

app.get("/api/exercise/users", (request, response) => {
  User.find({}, (error, arrayOfUsers) => {
    if (!error) {
      response.json(arrayOfUsers);
    }
  });
});

app.post(
  "/api/exercise/add",
  bodyParser.urlencoded({ extended: false }),
  (request, response) => {
    let responseObject = {};
    let newSession = new Session({
      description: request.body.description,
      duration: parseInt(request.body.duration),
      date: request.body.date
    });
    if (request.body.date == "") {
      newSession.date = new Date().toISOString().split("T")[0];
    }
    //check if session fields are empty
    if (newSession.description != "" && newSession.duration != "") {
      User.findByIdAndUpdate(
        request.body.userId, //selection criteria
        { $push: { log: newSession } },
        { new: true },
        (error, updatedUser) => {
          responseObject["_id"] = updatedUser.id;
          responseObject["username"] = updatedUser.username;
          responseObject["date"] = new Date(newSession.date).toDateString();
          responseObject["description"] = newSession.description;
          responseObject["duration"] = newSession.duration;
          response.json(responseObject);
        }
      );
    } else if (newSession.description == "") {
      responseObject = { error: "Session description field is empty" };
      response.json(responseObject);
    } else if (newSession.duration == "") {
      responseObject = { error: "Session duration field is empty" };
      response.json(responseObject);
    }
  }
);

app.get("/api/exercise/log", (request, response) => {
  User.findById(request.query.userId, (error, result) => {
    let responseObject = {}
    if(result != undefined){
      responseObject = result;
      if (!error) {      

        if (request.query.from || request.query.to) {
          let fromDate = request.query.from
            ? new Date(request.query.from)
            : new Date(0);
          fromDate = fromDate.getTime();
          let toDate = request.query.to ? new Date(request.query.to) : new Date();
          toDate = toDate.getTime();

          responseObject.log = responseObject.log.filter((session) => {
            let sessionDate = new Date(session.date).getTime();
            return sessionDate >= fromDate && sessionDate <= toDate;
          });
        }

        if (request.query.limit) {
          responseObject.log = responseObject.log.slice(0, request.query.limit);
        }

        responseObject = responseObject.toJSON();
        responseObject["count"] = result.log.length;
        response.json(responseObject);
      } else {
        responseObject = {error: error}
        response.json(responseObject);
      }
    } else {
      responseObject = {error: "Supplied ID doesn't exist"}
      response.json(responseObject);
    }
  });
});
