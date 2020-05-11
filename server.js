var path = require('path');
var fetch = require("node-fetch");
var express = require('express');
var multer = require('multer');
var jo = require('jpeg-autorotate');
var fs = require('fs');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var moment = require('moment');

var teams = require('./teams.js');
var config = require('./config.json');


var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, 'client', 'img', 'uploads'));
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
})
var upload = multer({storage: storage, dest: 'client/img/uploads/'});

var store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: 'sessions'
});

store.on('error', function(error) {
  throw error;
});

var sessionMiddle = session({
    secret: 'Super secret dot com',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 1 // 1 day
    },
    store: store,
    resave: true,
    saveUninitialized: true
});

app.use(sessionMiddle);
io.use(function(socket, next) {
  sessionMiddle(socket.request, socket.request.res, next);  
});

var quiz = {
  questions: require('./questions.js')
};

var answers = [];

var STATES = {
  SIGNUP: 1,
  STARTED: 2,
  WAITING: 3
};
var state = STATES.SIGNUP;
var current_question = -1;

app.get('/', function(req, res) {
  
  var startTime = moment('2020-05-11T20:30:00');
  var now = moment();

  if (now.isBefore(startTime)) {
    res.sendFile(path.join(__dirname, 'client/timer.html'));
  } else {
  if (!req.session.team_id)
    res.sendFile(path.join(__dirname, 'client/signup.html'));
  else
    res.sendFile(path.join(__dirname, 'client/index.html'));
  }
});

app.get('/admin', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/admin.html'));
});

app.get('/tv', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/tv.html'));
});

app.post('/upload', upload.single('image'), function(req, res, next) {
  
  var path = 'img/uploads/' + req.file.filename;
  var realPath = './client/' + path;
  
  /* iOS stores image as landscape alwayds, and adds exif orientation. this fixes that */
  jo.rotate(realPath, {quality: 85}, function(error, buffer, orientation) {
    if (error) {
       console.log('An error occurred when rotating the file: ' + error.message);
       res.send(path);
    } else {
      fs.writeFile(realPath, buffer);
      res.send(path);
    };
  });
});

app.use(express.static(path.join(__dirname, 'client')));

var quote = [];

async function getJoke(type){
  let url = 'http://jokes.guyliangilsing.me/retrieveJokes.php?type=' + type;
  let data = await(await fetch(url)).json();
  quote = data
}

function updateAdminStatus() {
  io.emit('admin-status', { teams: teams, state: state, current_question: current_question, answers: answers, questions: quiz.questions, info: config });
  getJoke("random")
  io.emit('quote-update', { quote: quote});
}

function getTeamById(id) {
  return teams.filter(function(t) {
    return (t.id == id);
  })[0];
}

function orderChecker(rightOrder, answerClient, options){

  for (var i = 0; i < rightOrder.length; i++)
    if (answerClient.indexOf(options[i]) !== rightOrder[i]) return false

  return true;
}

function getClosestAnswer(currAnswers, userAnswer){
  
  let answersList = []
  
  currAnswers.forEach(function (a, i) {
    answersList[i] = a.answer_id 
  }); 

  const output = answersList.reduce((prev, curr) => Math.abs(curr - userAnswer) < Math.abs(prev - userAnswer) ? curr : prev);

  return currAnswers.filter(a => {return a.answer_id === output})
}

var interval = null;

io.on('connection', function(socket) {    
    var t = getTeamById(socket.request.session.team_id);
    if (t) {
      t.connections++;
      console.log('User connected - ', t.name);

    }
    updateAdminStatus();

    socket.on('disconnect', function() {
        var t = getTeamById(socket.request.session.team_id);
        if (t)
          t.connections--;
        updateAdminStatus();
        console.log('User diconnected');

    });

    socket.on('quiz', function(data) {
      if (state == STATES.STARTED) {
          var t = getTeamById(socket.request.session.team_id);
          var answer = answers.filter(function(a) {
            return (a.question_id == current_question && a.team_id == t.id);
          });

          if(answer.length == 0)
            var quiz_msg = {...quiz.questions[current_question].data, ...{question_id: current_question}}
            socket.emit('quiz', quiz_msg);
      }
    });
    
    socket.on('submit', function(data) {
      socket.emit('ack', {});
      const  t = getTeamById(socket.request.session.team_id);
      const time = moment().format();

      if (t) {
        var q = quiz.questions[current_question];

        if (q.data.order && data.order) {
          if (orderChecker(q.data.order, data.order, q.data.options))
            t.score += 1;
          answers.push({ team_id: t.id, question_id: current_question, answer_id: data.order, time, score: t.score });
        } else if (data.input) {

          // has to be pushed before, because the answers object is used to award the point
          answers.push({ team_id: t.id, question_id: current_question, answer_id: data.input, time, score: t.score });

          var currAnswers = answers.filter(a => a.question_id === current_question);
          if (currAnswers.length == teams.length) {
            for (winner of getClosestAnswer(currAnswers, q.correct_id))
              getTeamById(winner.team_id).score += 1;
          }

        } else  {
          if (data.answer_id == q.correct_id)
            t.score += 1;
          answers.push({ team_id: t.id, question_id: current_question, answer_id: data.answer_id, time, score: t.score });
        }
      }
      updateAdminStatus();
    });
    
    socket.on('admin', function(data) {
        switch (data.action) {
            case 'next-question':
              if (interval)
                clearInterval(interval);
              var question = quiz.questions[++current_question];
              var quiz_msg = {...question.data, ...{question_id: current_question}}

              io.emit('quiz', quiz_msg);
                
              var timer = 10 * 60; // TODO: Make timer optional
              interval = setInterval(function() {
                timer--;
                io.emit('timer', { timeLeft: timer });
                if (timer == 0) {
                  clearInterval(interval);
                }
              }, 1000);
              
             state = STATES.STARTED;
              break;
            case 'show-answer':
              var q = quiz.questions[current_question];
              if (q.data.order) {
                
                var answers = []
                q.data.options.forEach(function (a, i) {
                  answers[q.data.order[i]] = a;
                }); 

                io.emit('show-answer', {question: q.data.text, answers});

              } else if (q.data.options.length == 0) {
                io.emit('show-answer', {question: q.data.text, answers: q.correct_id});
              } else io.emit('show-answer', {question: q.data.text, answers: q.data.options[q.correct_id]});
              break;
            case 'request-reload':
              console.log('Not implemented yet');
              break;
            default:
              break;
        }
        updateAdminStatus();
    });
    
    if (!socket.request.session.team_id) {
      socket.emit('signup', teams);
      socket.on('signup', function(data) {
        socket.request.session.team_id = data.id;
        socket.request.session.save();

        var t = getTeamById(+data.id);
        if (t) {
          t.photo = data.image;
          t.name = data.name;
          t.connections++;
        }
        updateAdminStatus();
      });
    }
});

var port = process.env.PORT || 8080;
server.listen(port, function() {
  console.log('Listening on port ' + port);
});
