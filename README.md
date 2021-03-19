# Real-time quiz app
Based on fork by thomasbiz. Changed to be a host for a quiz party game. 
"The code is not great, but it works. I didn't have a lot of time to put this together." 
This applys to this repo too. It works and we had fun using it, but if you do somthing unintended the bugs will show ;). 

So if you really want to use it, here is a quick walk through:

One player is the admin (youripadress/admin) and controlls the game, displays answers and questions to connected players

Change teams.js if you want predefined playernames (team functionality from fork was removed), players can change them by them slefs to.
Add or remove entrys to change player amount. (doesn't have to be the same as actual players)

Change questions.js if you want your own questions.

Backend built with node.js + express + socket.io
Frontend in Vue.js

