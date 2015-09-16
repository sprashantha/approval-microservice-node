'use strict'
const configSetup = require('./lib/config.js'),
      logger = require('./lib/logger.js'),
      server = require('./server.js');
const
    express = require('express'),
    async = require('async'),
    AWS = require('aws-sdk'),
    dbWrapper = require('./lib/models/dbwrapper.js'),
    awsWrapper = require('./lib/models/awswrapper.js'),
    auth = require('./lib/auth.js');


// -- Config --
let config = configSetup.setupConfig();

config.setupRedisConnection = true;
config.setupMongoConnection = true;
config.testAWSConnection = true;

// Create the context object. The context is passed around the entire app.
let context = {'config': config};




server.createServer(context);






























	