'use strict'
const
    nconf = require('nconf'),
	express = require('express'),
    multer  = require('multer'),
    async = require('async'),
    bodyParser = require('body-parser'),
    logger = require('./lib/logger.js'),
    requestId = require('request-id/express'),
	app = express();

app.use(requestId({
    resHeader: 'concur.correlation_id',
    reqHeader: 'concur.correlation_id'
}));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(multer({dest: './uploads/'}));

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));

    // parse application/json
     app.use(bodyParser.json());

    // Static content
	app.use(express.static(__dirname + '/static'));
	app.use(express.static(__dirname + '/bower_components'));



let
	config = {
		concur_api_url: 'http://www.concursolutions.com/api/',
		concur_reports_url: 'v3.0/expense/reportdigests',
		concur_approvals_url: 'v3.0/expense/reportdigests?user=ALL&approvalStatusCode=A_PEND',
        concur_report_2_0_url: 'expense/expensereport/v2.0/report/',
        concur_report_1_1_url: 'expense/expensereport/v1.1/report/',
		concur_trips_url: 'travel/trip/v1.1/',
        use_mongoose: 'false',
        use_pubsub: 'false',
        use_sqs: 'true',
        mongodb_url: '',
        redis_server: '',
        redis_port: '',
        logging_level: ''
	};


    // Read Configuration Parameters
    nconf.argv().env();
    nconf.file({ file: 'config.json' });

    // Set the logging level in case it needs to be overridden.
    config.logging_level = nconf.get('logging_level')
    if (config.logging_level && config.logging_level != ''){
        logger.transports.console.level = config.logging_level;
    }

    // Redis connections
    config.redis_server = nconf.get('redis_server');
    config.redis_port = nconf.get('redis_port');
    console.log("config.redis_server " + config.redis_server);
    console.log("config.redis_port " + config.redis_port);
    console.log("auth_pass " + nconf.get('redis_password'));

    // Mongodb connections
    console.log("mongodb_server " + nconf.get('mongodb_server'));
    console.log("mongodb_port " + nconf.get('mongodb_port'));
    console.log("mongodb_database " + nconf.get('mongodb_database'));
    console.log("mongodb_user " + nconf.get('mongodb_user'));
    console.log("mongodb_password " + nconf.get('mongodb_password'));

    if (nconf.get('mongodb_user') != "" && nconf.get('mongodb_password') != ""){
        config.mongodb_url = "mongodb://" + nconf.get('mongodb_user') + ":" + nconf.get('mongodb_password') + "@"
         + nconf.get('mongodb_server') + ":" + nconf.get('mongodb_port') + "/" + nconf.get('mongodb_database');
    }else{
        config.mongodb_url = "mongodb://" + nconf.get('mongodb_server') + ":" +
            nconf.get('mongodb_port') + "/" + nconf.get('mongodb_database');
    }
    console.log("mongodb_url " + config.mongodb_url);
    config.port = process.env.PORT || nconf.get('http:port');

let context = {'config': config};

// Connect to database services - Redis and MongoDB
const redis = require('redis'),
      mongoClient = require('mongodb').MongoClient;

// Connect to AWS Services
const
      AWS = require('aws-sdk'),
//      awsCredentialsPath = '../aws.credentials.json',
      sqsQueueUrl = 'https://sqs.us-west-2.amazonaws.com/749188282015/report-approvals';

//      AWS.config.loadFromPath(awsCredentialsPath);
     // You need to set the region to access SQS. Not needed for S3. Also no need to load the credentials manually.
     // The SDK automatically loads it from the credentials file in the ~/.aws/credentials file (look under prashantha).
     // If running in EC2, then it uses the IAM role associated with the EC2 instance.
     AWS.config.update({region: 'us-west-2'});


    async.parallel([
        function (callback) {
            setTimeout(function () {
                let redisClient = redis.createClient(config.redis_port, config.redis_server, {"auth_pass":nconf.get('redis_password')});
                redisClient.on('error', function (err) {
                    console.error('Error connecting to Redis ' + err);
                });
                redisClient.on('ready', function () {
                    console.log("Connected to Redis");
                    context.redisClient = redisClient;
                })
                callback(null, redisClient);
            }, 500);
        },
        function (callback) {
             setTimeout(function () {

                mongoClient.connect(config.mongodb_url, function(connErr, db) {
                    if (connErr) {
                        console.error("Error connecting to Mongodb " + connErr);
                    }
                    else
                    {
                        console.log("Connected to Mongodb");
                        context.db = db;
                    }
                    callback(null, mongoClient);
                })
             }, 500);
        },
        function (callback){
            setTimeout(function(){
                let s3 = new AWS.S3();
                context.s3 = s3;

                // Test Connection to S3
                s3.listBuckets(function(err, data) {
                    console.log("Connecting to AWS S3...");
                    console.log("Number of S3 buckets: " + data.Buckets.length);
                });

                // Test Imaging Bucket
                s3.listObjects({Bucket: 'concur-imaging'}, function(err, data) {
                        if (err) {
                            console.log("Error getting imaging objects: " + err.statusCode);
                            return;
                        }
                        if (data){
                            console.log("Number of objects: " + data.Contents.length);
                        }
                    else{
                            console.log("No data found");
                        }
                    callback(null, s3);
                });
            }, 200);
        },
        function (callback){
            setTimeout(function(){
                let sqs = new AWS.SQS();
                context.sqs = sqs;
                context.sqsQueueUrl = sqsQueueUrl;

                // Test SQS Connection
                let params = {
                    MessageBody: '{"Test": "true", "Message":"This is a Test Message"}',
                    QueueUrl: sqsQueueUrl,
                    DelaySeconds: 0
                }

                // Send a test message to SQS.
                console.log("Sending a test message to SQS...");
                sqs.sendMessage(params, function(sendErr, data) {
                    if (sendErr){
                        console.log(sendErr, sendErr.stack);
                    }
                    else{
                        console.log("Received SQS Response:");
                        console.log(data);

                        // Receive the message.
                        sqs.receiveMessage({
                            QueueUrl: sqsQueueUrl,
                            MaxNumberOfMessages: 1, // how many messages do we wanna retrieve?
                            VisibilityTimeout: 0, // seconds - how long we want a lock on this job
                            WaitTimeSeconds: 0 // seconds - how long should we wait for a message?
                        }, function(recvErr, recvData) {
                            if (recvErr){
                                console.log(recvErr, recvErr.stack);
                            }
                            if (recvData && recvData.Messages){
                                // Read the message
                                console.log("Received SQS Messages: " + recvData.Messages.toString());
                                let message = recvData.Messages[0];
                                console.log("Received SQS Message: " + message.toString());
                                console.log("message.MessageId: " + message.MessageId);
                                console.log("data.MessageId: " + data.MessageId);
                                if (message.MessageId == data.MessageId){
                                    // Delete the message
                                    console.log("Deleting SQS Message with MessageId: " + data.MessageId);
                                    sqs.deleteMessage({
                                        QueueUrl: sqsQueueUrl,
                                        ReceiptHandle: message.ReceiptHandle
                                    }, function(delErr, delData){
                                        if (delErr){
                                            console.log(delErr);
                                        }
                                        else{
                                            console.log("Deleted message.")
                                        }
                                    })
                                }
                            }
                            callback();
                        });
                    }
                })
            }, 500);
        }],
        function (err, results) {
            if (err) {
                console.error(err);
            }

            console.log("Attempting to start server on port " + (process.env.PORT || nconf.get('http:port')));

            // Start the server and listen on port set by the environment (example: 8081 in AWS) or 3000.
            app.listen((process.env.PORT || nconf.get('http:port')), function(){
                console.log("Server started. Listening on port " + (process.env.PORT || nconf.get('http:port')));

            })
        });


    let router = express.Router();
   // app.use('/concur/api/', router);
   // app.use('/imaging/v4/', router);
   app.use('/', router);

const
    users = require('./lib/models/users.js'),
    utility = require('./lib/util.js');

    router.use(function authorizeRequest(req, res, next) {

        logger.debug("req.url: " + req.url);
        logger.debug("req.originalUrl: " + req.originalUrl);
        logger.debug("req.baseUrl: " + req.baseUrl);
        logger.debug("req.path: " + req.path);

        // If you are logging in then use a different mechanism to authorize the request.
        // Check the baseUrl.
        if (req.url == "/login")
        {
           next();
           return;
        }
        // Validate the access token
        var access_token = utility.extractToken2(req, res);
        if(access_token && access_token != '') {
            users.validateToken(access_token, context, function (err, item) {
                if (err) {
                    res.json(502, {error: "bad_gateway", reason: err.code});
                }
                if (item) {
                    logger.debug("validateToken item found");
                    next();
                }
                else {
                    res.status(401).send("Unauthorized");
                    return;
                }
            });
        }
        else{
            res.status(401).send("Unauthorized");
            return;
        }

    });

    // Routes
    require('./lib/concur_home.js')(context, app);
    require('./lib/concur_user.js')(context, app);
    require('./lib/concur_login.js')(context, app);
    require('./routes/concur_trips.js')(context, app, router);
    require('./routes/concur_reports.js')(context, app, router);
    require('./routes/concur_approvals.js')(context, app, router);
    require('./routes/concur_imaging.js')(context, app, router);


	