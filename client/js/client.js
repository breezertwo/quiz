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
            ANSWER: 6  
        },
        state: -1,
        question: '',
        options: [],
        image: null,
        youtube: null,
        order: [],
        answer_id: -1,
        question_number: null,
        timeLeft: null,
        quote: '',
        input: '',
        mp3: null
    },
    created: function(e) {
        var that = this;

        this.state = this.QuizStates.WAITING;
        socket.on('quiz', function(data) {
            that.reset();
            that.state = that.QuizStates.QUIZZING;
            that.question = data.text;
            if (data.hasOwnProperty('image')) that.image = data.image;
            else that.image = null
            if (data.hasOwnProperty('youtube')) that.youtube = data.youtube;
            else that.youtube = null;
            if (data.hasOwnProperty('order')) that.order = data.order;
            else that.order = null;
            if (data.hasOwnProperty('mp3')) that.mp3 = data.mp3;
            that.options = data.options;
            that.question_number = data.question_id;

        }); 

        socket.on('show-answer', function(data) {
            that.state = that.QuizStates.ANSWER;
            that.question = data.question;
            that.options = data.answers;
        });
        
        socket.on('reset', function(data) {
            that.reset();
        });

        socket.on('ack', function(data) {
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
        submit: function(e) {
            this.state = this.QuizStates.SUBMITTING;
            if (this.order && this.order.length > 0) socket.emit('submit', {order: this.options} );
            else if (this.input !== '') socket.emit('submit', {input: this.input});
            else socket.emit('submit', {answer_id: this.answer_id} );
        },
        toggleAudio() {
            var audio = document.getElementById("audio-player");
            if (audio.paused) {
             audio.play();
            } else {
             audio.pause();
            }
           }
    }
});

