/*global io*/
var socket = io();

/*global Vue*/
var app = new Vue({
    el: '#app',
    data: {
        teams: [],
        answers: [],
        questions: [],
        current_question: -1,
        version: -1,
        question: '',
        correct: false,
        showNextButton: true
    },

    created: function(e) {
        var that = this;
        socket.on('admin-status', function(data) {
            that.teams = data.teams;
            that.answers = data.answers;
            that.current_question = data.current_question;
            that.questions = data.questions;
            that.version = data.info.version
        });
        socket.on('quiz', function(data) {
            that.question = data.text;
        });
        socket.on('show-answer', function(data) {
            that.question = 'Answer is displayed for clients'
        });
    },
    methods: {
        onClickNext: function(e) {
            socket.emit('admin', { action: 'next-question' });
            this.showNextButton = false;
        },
        onClickAnswer: function(e) {
            socket.emit('admin', { action: 'show-answer' });
            this.showNextButton = true;
        },
        hasAnswered: function(team_id) {
            var that = this;
            var a = this.answers.filter(function(a) {
                return (a.question_id == that.current_question && a.team_id == team_id);
            })[0];
            if (a) return true;
            return false;
        },
        allAnswered: function() {
            if (1 == this.answers.filter(a => a.question_id === this.current_question).length)
                return true;
            return false;
        },
        onReload: function() {
            // socket.emit('admin', { action: 'request-reload' });
        },
        getTeamById(id) {
            return this.teams.filter(function(t) {
                return (t.id == id);
            })[0];
        }
    }
});

