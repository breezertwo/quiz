/*global io*/
const socket = io();
const FULL_DASH_ARRAY = 283;
const WARNING_THRESHOLD = 10;
const ALERT_THRESHOLD = 5;

const COLOR_CODES = {
  info: {
    color: "green"
  },
  warning: {
    color: "orange",
    threshold: WARNING_THRESHOLD
  },
  alert: {
    color: "red",
    threshold: ALERT_THRESHOLD
  }
};

const startTime = moment('2020-05-11T20:30:00');
const now = moment();

const TIME_LIMIT = startTime.diff(now, 'seconds');

var app = new Vue({
    el: '#app',
    data: {
        timePassed: 0,
        timerInterval: null
    },
    computed: {
        circleDasharray() {
          return `${(this.timeFraction * FULL_DASH_ARRAY).toFixed(0)} 283`;
        },
    
        formattedTimeLeft() {
          let duration = this.timeLeft * 1000;

          let seconds = Math.floor((duration / 1000) % 60),
            minutes = Math.floor((duration / (1000 * 60)) % 60),
            hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

          hours = (hours < 10) ? "0" + hours : hours;
          minutes = (minutes < 10) ? "0" + minutes : minutes;
          seconds = (seconds < 10) ? "0" + seconds : seconds;

          return `${hours}:${minutes}:${seconds}`;
        },
    
        timeLeft() {
          return TIME_LIMIT - this.timePassed;
        },
    
        timeFraction() {
          const rawTimeFraction = this.timeLeft / TIME_LIMIT;
          return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
        },
    
        remainingPathColor() {
          const { alert, warning, info } = COLOR_CODES;
    
          if (this.timeLeft <= alert.threshold) {
            return alert.color;
          } else if (this.timeLeft <= warning.threshold) {
            return warning.color;
          } else {
            return info.color;
          }
        }
      },
    
      watch: {
        timeLeft(newValue) {
          if (newValue === 0) {
            this.onTimesUp();
          }
        }
      },
    
      mounted() {
        this.startTimer();
      },
    
      methods: {
        onTimesUp() {
          clearInterval(this.timerInterval);
        },
    
        startTimer() {
          this.timerInterval = setInterval(() => (this.timePassed += 1), 1000);
        }
      }
});

