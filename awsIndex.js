var JSONStream = require('JSONStream'),
    Transform = require('stream').Transform,
    streamToMongoDB = require('stream-to-mongo-db').streamToMongoDB;

//AWS Setup
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var s3 = new AWS.S3();
var paramsIndex = {
  Bucket: 'irs-form-990', 
  Key: 'index.json'
};

// MongoDB :: Declare variables
var dbHost = 'mongodb://localhost:27017/'
var dbName = 'irs';
var dbCollection = 'index';
var MONGO_URL = dbHost + dbName;
var outputDBConfig = { dbURL : MONGO_URL, collection : dbCollection };
var insertToMongo = streamToMongoDB(outputDBConfig);

// Run Function :: verbose edition to help with troublehsooting
s3.makeUnauthenticatedRequest('getObject', paramsIndex).createReadStream()
  .on('error', function(e) {
      console.error('----AWS ERROR-----');
      console.error(e.stack);
  })
  .pipe(JSONStream.parse(['AllFilings',true]))
  .on('error', function(e) {
      console.error('----JSONStream ERROR-----');
      console.error(e.stack);
  })
  .pipe(insertToMongo)
  .on('error', function(e) {
      console.error('----Mongo ERROR-----');
      console.error(e.stack);
  });
