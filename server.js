var path = require('path');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var moment = require('moment');
var { distance } = require('fastest-levenshtein')


var teams = require('./teams.js');

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
  questions: require('./questions_ta.js')
};

var answers = [];

var STATES = {
  SIGNUP: 1,
  STARTED: 2,
  WAITING: 3,
  ENDED: 4
};

var answerTypes = {
  STANDART: 1,
  QUESS: 2,
  TEXT: 3,
  ORDER: 4
};

var state = STATES.SIGNUP;
var current_question = -1;

app.get('/', function(req, res) {
  if (!req.session.team_id)
    res.sendFile(path.join(__dirname, 'client/signup.html'));
  else
    res.sendFile(path.join(__dirname, 'client/index.html'));
  }
);

app.get('/admin', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/admin.html'));
});

app.get('/results', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/results.html'));
});

/*app.get('/tv', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/tv.html'));
});*/


app.use(express.static(path.join(__dirname, 'client')));

function updateAdminStatus() {
  io.emit('admin-status', { teams: teams, state: state, current_question: current_question, answers: answers, questions: quiz.questions, version: process.env.npm_package_version});
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

function gatherStats(){
  let stats = {
    teamnames: [],
    points: []
  }

  for (let t of teams) {
    stats.teamnames.push(t.name);
    stats.points.push(t.score);
  }

  return stats;
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

          if(answer.length == 0 && quiz.questions[current_question] != undefined)
            var quiz_msg = {...quiz.questions[current_question].data, ...{question_id: current_question}, ...{answerType: quiz.questions[current_question].answerType}}
          
          socket.emit('quiz', quiz_msg);
      }
    });
    
    socket.on('submit', function(data) {
      socket.emit('ack', {});
      const  t = getTeamById(socket.request.session.team_id);
      const time = moment().format();

      if (t) {
        var q = quiz.questions[current_question];

        switch (data.answerType) {
          case answerTypes.STANDART:
            if (data.answer_id == q.correct_id) t.score += 1;
            answers.push({ team_id: t.id, question_id: current_question, answer_id: data.answer_id, time, score: t.score });
            break;
          case answerTypes.QUESS:
            // has to be pushed before, because the answers object is used to award the point
            answers.push({ team_id: t.id, question_id: current_question, answer_id: data.input, time, score: t.score });

            const currAnswers = answers.filter(a => a.question_id === current_question);
            const countValuesBiggerThan = (arr, key, value) => arr.filter(x => x[key] > value).length
  
            if (currAnswers.length == countValuesBiggerThan(teams, 'connections', 0)) {
              for (winner of getClosestAnswer(currAnswers, q.correct_id))
                getTeamById(winner.team_id).score += 1;
            }
            break;
          case answerTypes.TEXT:
            for (var [i, entries] of data.text.entries()) {
              if (distance(entries, q.correct_text[i]) < 2 ) {
                t.score += 1;
              }
            }
            answers.push({team_id: t.id, question_id: current_question, answer_id: JSON.stringify(data.text), time, score: t.score});
            break;
          case answerTypes.ORDER:
            const result = orderChecker(q.data.order, data.order, q.data.options)
            if (result) t.score += 1;
            answers.push({ team_id: t.id, question_id: current_question, answer_id: data.order, time, score: t.score, result});
            break;
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
              if (question) {
                var quiz_msg = {...question.data, ...{question_id: current_question}, ...{answerType: quiz.questions[current_question].answerType}}

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
              } else {
                state = STATES.ENDED
                console.log('No more questions available')
                io.emit('quiz-ended', {});
              }
              break;
          case 'show-answer':
              var q = quiz.questions[current_question];

              switch (q.answerType) {
                case answerTypes.STANDART:
                  io.emit('show-answer', {question: q.data, answers: q.data.options[q.correct_id]});
                  break;
                case answerTypes.QUESS:
                  io.emit('show-answer', {question: q.data, answers: q.correct_id});
                  break;
                case answerTypes.TEXT:
                  io.emit('show-answer', {question: q.data, answers: q.correct_text});
                  break;
                case answerTypes.ORDER:
                  var answers = []
                  q.data.options.forEach(function (a, i) {
                    answers[q.data.order[i]] = a;
                  }); 
                  io.emit('show-answer', {question: q.data, answers});
                  break;
              }
              socket.emit('recieve-graphdata', gatherStats())
              break;
          case 'request-reload':
              console.log('Not implemented yet');
              break;
          default:
              break;
        }
        updateAdminStatus();
    });

    socket.on('graph-rdy', function(data) {
      socket.emit('recieve-graphdata', gatherStats())
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
