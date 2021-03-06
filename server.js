var fs = require('fs');
var redis = require('redis').createClient;

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;
const errorNotificationSecret = process.env.ERROR_NOTIFICATION_SECRET || 'ERROR_NOTIFICATION_SECRET';
const errorNotificationKey = process.env.ERROR_NOTIFICATION_KEY || 'ERROR_NOTIFICATION_KEY';
const notificationSecret = process.env.NOTIFICATION_SECRET || 'NOTIFICATION_SECRET';
const notificationKey = process.env.NOTIFICATION_KEY || 'NOTIFICATION_KEY'
const EVENTS = {
    newNotification: 'NOTIFICATION'
};
var server;

if(process.env.SSL_KEY && process.env.SSL_CERT) {
    var options = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT)
    };
    server = require('https').createServer(options, app);
} else {
    server = require('http').createServer(app);
}


const io = require('socket.io')(server);

//var redis = require('socket.io-redis');
var redisadapter = require('socket.io-redis');
var redisport = 6380;
var redishost = process.env.REDIS_HOST;

var pub = redis(redisport, redishost, { auth_pass: process.env.REDIS_AUTH_KEY, tls:{}});
var sub = redis(redisport, redishost, { auth_pass: process.env.REDIS_AUTH_KEY, tls: {} });

var adapter = redisadapter({ pubClient: pub, subClient: sub });
adapter.pubClient.on('error', function(){
	console.log("Pub Error");
});
adapter.subClient.on('error', function(){
	console.log("Sub Error");	
});

io.adapter(adapter);


server.listen(port, () => console.log('Server listening at port ' + port));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.static(__dirname + '/public'));

app.post('/send', (req, res) => {
    const data = req.body;
    const dispatch = (channel, notification) => {
        io.to(channel).emit(EVENTS.newNotification, data.notification);
    };

    if (!req.headers || req.headers.notification_secret !== notificationSecret) {
        return res.status(401).json('invalid notification secret');
    }

    if (req.headers.notification_secret == errorNotificationSecret && data.channel !== "ERRORS") {
        return res.status(401).json('invalid notification secret (error secret for non-error channel)');
    }

    if (data && data.notification && data.channel) {
        if (data.channel.forEach) {
            data.channel.forEach(function (channel) {
                dispatch(channel, data.notification);
            });
        } else {
            dispatch(data.channel, data.notification);
        }

        return res.status(200).json('ok');
    }
    return res.status(406).json('Missing parameters');

});

io.on('connection', (socket) => {

    if(!validateConnection(socket.handshake.query)) {
        return;
    }

    socket.on('join', (channel) => {
		if (channel !== "ERRORS" || socket.handshake.query.notificationKey == errorNotificationKey)
			socket.join(channel);
    });

    socket.on('leave', (channel) => {
        socket.leave(channel);
    });
});


function validateConnection(query) {
    if (query.notificationKey !== notificationKey && query.notificationKey !== errorNotificationKey) {
        return;
    }
    return true;
}
