/*global io*/
const socket = io();

let labels = [];
let dataset = [];

Vue.use(VueCharts);
      var app = new Vue({
        el: '#app',
        data: function data() {
          return {
            dataentry: null,
            datalabel: null,
            labels: labels,
            dataset: dataset
          };
        },

        created: function(e) {
          that = this;
          socket.on('recieve-graphdata', function(data) {
            that.labels = data.teamnames;
            that.dataset = data.points;
          });

          socket.emit('graph-rdy', {});
        },

        methods: {
          addData: function addData() {
            this.dataset.push(this.dataentry);
            this.labels.push(this.datalabel);
            this.datalabel = '';
            this.dataentry = '';
          }
        }
      });

