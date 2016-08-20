var JSONStream = require('JSONStream'),
    Transform = require('stream').Transform,
    streamToMongoDB = require('stream-to-mongo-db').streamToMongoDB;

//AWS Setup
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./aws.json'); //TODO Anonymous credentials???
var s3 = new AWS.S3();
var paramsIndex = {Bucket: 'irs-form-990', Key: 'index.json'};

// Narrow :: Filter index.json results to foundations only :: Form 990PF
var narrow = new Transform({objectMode: true});
narrow._transform = function(data, encoding, done) {
  if(data.URL && data.URL.length > 0 && data.FormType == "990PF") {
    this.push(data);
  }
  done();
};

// MongoDB :: Declare variables
var dbName = 'irs';
var dbCollection = 'indexfoundations';
var MONGO_URL = 'mongodb://localhost:27017/' + dbName;
var outputDBConfig = { dbURL : MONGO_URL, collection : dbCollection };
var insertToMongo = streamToMongoDB(outputDBConfig);

// Run Function
s3.getObject(paramsIndex).createReadStream()
  .pipe(JSONStream.parse([ 'AllFilings', true ]))
  .pipe(narrow)
  .pipe(insertToMongo);
