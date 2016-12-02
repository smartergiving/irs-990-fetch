var JSONStream = require('JSONStream'),
    Transform = require('stream').Transform,
    streamToMongoDB = require('stream-to-mongo-db').streamToMongoDB;

//Select Year
var year = '2016';

//AWS Setup
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var s3 = new AWS.S3();
var paramsIndex = {
  Bucket: 'irs-form-990', 
  Key: 'index_' + year + '.json'
};

// Narrow :: Filter index to foundations only :: Form 990PF
var narrow = new Transform({objectMode: true});
narrow._transform = function(data, encoding, done) {
  if(data.URL && data.URL.length > 0 && data.FormType == '990PF') {
    this.push(data);
  }
  done();
};

// MongoDB :: Declare variables
var dbHost = 'mongodb://localhost:27017/';
var dbName = 'irs';
var dbCollection = 'indexfoundations' + year;
var MONGO_URL = dbHost + dbName;
var outputDBConfig = { dbURL : MONGO_URL, collection : dbCollection };
var insertToMongo = streamToMongoDB(outputDBConfig);

// Run Function
s3.makeUnauthenticatedRequest('getObject', paramsIndex).createReadStream()
  .pipe(JSONStream.parse(['Filings' + year, true]))
  .pipe(narrow)
  .pipe(insertToMongo);
