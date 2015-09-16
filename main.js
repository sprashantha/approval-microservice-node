'use strict'
const configSetup = require('./lib/config.js'),
      logger = require('./lib/logger.js'),
      server = require('./server.js');

// -- Config --
let config = configSetup.setupConfig();

config.setupRedisConnection = true;
config.setupMongoConnection = true;
config.testAWSConnection = true;

// Create the context object. The context is passed around the entire app.
let context = {'config': config};

server.createServer(context);






























	