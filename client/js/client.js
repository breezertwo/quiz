
/*global io*/
var socket = io();
/*global Vue*/
var app = new Vue({
    el: '#app',
    data: {
         QuizStates: {
            QUIZZING: 1,
            SELECTED: 2,
            SUBMITTING: 3,
            SUBMITTED: 4,
            WAITING: 5,
            ANSWER: 6,
            ENDED: 7 
        },
        AnswerStates: {
            STANDART: 1,
            QUESS: 2,
            TEXT: 3,
            ORDER: 4
        },
        answerType: -1,
        state: -1,
        question: '',
        options: [],
        image: null,
        youtube: null,
        answerImage: null,
        order: [],
        answer_id: -1,
        question_number: null,
        timeLeft: null,
        quote: '',
        input: '',
        mp3: null,
        mp4: null,
        category: ''
    },
    created: function(e) {
        var that = this;

        this.state = this.QuizStates.WAITING;
        socket.on('quiz', function(data) {
            that.reset();

            if (data) {
                that.state = that.QuizStates.QUIZZING;

                that.question = data.text;
                that.answerType = data.answerType
                that.category = data.category;
                if (data.hasOwnProperty('image')) that.image = data.image;
                else that.image = null
                if (data.hasOwnProperty('youtube')) that.youtube = data.youtube;
                else that.youtube = null;
                if (data.hasOwnProperty('order')) that.order = data.order;
                else that.order = null;
                if (data.hasOwnProperty('mp3')) that.mp3 = data.mp3;
                else that.mp3 = null;
                if (data.hasOwnProperty('mp4')) that.mp4 = data.mp4;
                else that.mp4 = null;
                that.options = data.options;
                that.question_number = data.question_id;
            } else {
                that.state = that.QuizStates.SUBMITTED;
            }
        }); 

        socket.on('show-answer', function(data) {
            that.state = that.QuizStates.ANSWER;
            that.question = data.question.text;
            that.category = data.question.category;
            that.options = data.answers;
            if (data.answerImage) that.answerImage = data.answerImage;
            else that.answerImage = null;
        });
        
        socket.on('reset', function() {
            that.reset();
        });

        socket.on('quiz-ended', function() {
            that.state = that.QuizStates.ENDED;
        });

        socket.on('ack', function() {
            that.state = that.QuizStates.SUBMITTED;
        });
        
        socket.on('timer', function(data) {
            that.timeLeft = +data.timeLeft;
            if (that.timeLeft == 0) {
                setTimeout(that.reset, 5000);
            }
        });

        socket.on('quote-update', function(data) {
            that.quote = data.quote
        });
        
        socket.emit('quiz', {});
    },
    computed: {
        minutesLeft: function () {
            var minutes = Math.floor(this.timeLeft / 60).toString();
            if (minutes.length == 1)
                minutes = '0' + minutes;
            return minutes;
        },
        secondsLeft: function () {
            var seconds = Math.floor(this.timeLeft % 60).toString();
            if (seconds.length == 1)
                seconds = '0' + seconds;
            return seconds;
        }
    },
    methods: {
        reset: function() {
            this.question = '';
            this.options = [];
            this.answer_id = -1;
            this.image = null;
            this.timeleft = null;
            this.state = this.QuizStates.WAITING;
            this.input = ''
        },
        select: function(e) {
            if (this.state > this.QuizStates.SELECTED || this.timeLeft == 0) return;
            this.state = this.QuizStates.SELECTED;
            this.answer_id = e.target.id;
            if (this.options.length == 1)
                this.submit();
        },
        submit: function() {
            
            if (this.state !== this.QuizStates.SUBMITTED) {
                this.state = this.QuizStates.SUBMITTING;
                
                if (this.answerType === this.AnswerStates.ORDER) socket.emit('submit', {order: this.options, answerType: this.answerType});
                else if (this.answerType === this.AnswerStates.QUESS) socket.emit('submit', {input: this.input, answerType: this.answerType});
                else if (this.answerType === this.AnswerStates.TEXT) socket.emit('submit', {text: this.options, answerType: this.answerType});
                else socket.emit('submit', {answer_id: this.answer_id, answerType: this.answerType});
            }
         
        }
    }
});

