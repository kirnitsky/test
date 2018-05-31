// test for onetwotrip
// author sergey.kirnitsky@gmail.com

const Redis = require('ioredis');
const redis = new Redis();
const redisEvents = new Redis();
const crypto = require('crypto');
let serverCheckTimer;


function createUUID() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(100, (err, buf) => {
            if (err) throw err;
            resolve(crypto.createHash('sha256').update(buf).digest('hex'));
        });
    });
}


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


function startServer() {
    redis.set('serverexist', 'my_random_value', 'NX', 'PX', '600').then(result => {
        if (result === "OK") {
            console.log('i am server');
            setInterval(serverWorker, 500);
        } else { // client
            serverCheckTimer = setInterval(serverCheck, 500);
            redisEvents.subscribe('news');
            redisEvents.on('message', function (channel, message) {
                // lock message from other
                redis.set('its:'+message, 'mine', 'NX', 'PX', '10').then(result => {
                    if (result === "OK") {
                        // process message
                        if (getRandomInt(1,20) === 20) { // error 5% probability
                            console.log('WRONG message %s from channel %s', message, channel);
                            redis.rpush("errors", `${(new Date()).toISOString()} message is: ${message}`)
                        } else
                        console.log('Receive message %s from channel %s', message, channel);
                        // message processed
                    }
                });
            });
        }
    });
}


function serverCheck() {
    redis.set('serverexist', 'my_random_value', 'NX', 'PX', '600').then(result => {
        if (result === "OK") { // i am server
            console.log('i am server');
            clearInterval(serverCheckTimer);
            redisEvents.unsubscribe('news');
            setInterval(serverWorker, 500);
        }
    });
}


function serverWorker() {
    redis.pexpire('serverexist', '600');
    createUUID().then(result => {
        redis.publish('news', result);
    });
}


if (process.argv[2] === 'getErrors') {
    redis.lrange('errors', 0, -1).then(result => {
        for (let i = 0; i < result.length; i++)
            console.log(result[i]);
        return redis.del("errors");
    }).then(() => {
        process.exit(0);
    });
} else startServer();
