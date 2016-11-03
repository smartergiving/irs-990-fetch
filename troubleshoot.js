//Adds logging and heapdump to assist with troubleshooting
//Adds ability to easily toggle between using npm request and the native AWS SDK
//Denoted by /* toggle */
var request = require('request');
var es = require('event-stream');
var Promise = require('bluebird');
var JSONStream = require('JSONStream');
var xml2jsParser = require('xml2js').parseString;
var request_promise = require('request-promise');

//IRS Indexes
var year = '2016';
var index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

//AWS
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
var s3 = new AWS.S3();
var paramsIndex = {Bucket: 'irs-form-990', Key: 'index_' + year + '.json'};

//Mongo
var dbHostPort = 'localhost:27017';
var dbName = 'irs';
var dbCollection = 'filings' + year;
var db = require('mongodb-promises').db(dbHostPort, dbName);
var mycollection = db.collection(dbCollection);

// xml2js
var parserOptions = {explicitArray: false, emptyTag: undefined, attrkey: 'attributes'};

// Troubleshooting
var successCount = 0;
var errorCount = 0;

// Main Function
//request(index) /* toggle */
s3.makeUnauthenticatedRequest('getObject', paramsIndex).createReadStream() /* toggle */
  .on('error', function(err) {
    console.error('-----Index Request Error-----');
    console.error(err);
  })
  .pipe(JSONStream.parse(['Filings' + year, true]))
  .on('error', function(err) {
    console.error('-----JSONParse Error-----');
    console.error(err);
  })
  .pipe(es.mapSync(function (data) {

    //Filter results to only foundations w/ data available
    if(data.URL && data.URL.length > 0 && data.FormType == '990PF') {

      // Fetch XML using request
        var requestOptions = {
          uri: data.URL,
          simple: false,
          timeout: 120000,
          pool: {maxSockets: Infinity}
        };

        //Fetch XML using AWS SDK
        var targetKey = data.ObjectId + '_public.xml';
        var paramsXML = {Bucket: 'irs-form-990', Key: targetKey};

        //request_promise(requestOptions) /* toggle */
        s3.makeUnauthenticatedRequest('getObject', paramsXML).promise() /* toggle */
          .then(function(resultXML) {

            //Parse the XML file
            return new Promise(function(resolve, reject) {
              xml2jsParser(resultXML.Body, parserOptions, function(err, result) { //AWS SDK /* toggle */
              //xml2jsParser(string, parserOptions, function(err, result) { //request /* toggle */
                if (err) {
                  return reject(err);
                 } else {
                  return resolve(result);
                 }
              });
            });

          })
          .then(function(resultJSON) {

            // Write the JS object to Mongo
            mycollection.save(resultJSON)
              .then(function (resultArr) {

                //Troubleshooting
                successCount++;
                var targetEIN = resultArr.ops[0].Return.ReturnHeader.Filer.EIN;
                var heapUsed = process.memoryUsage().heapUsed / 1000000;
                var errorRate = 100 - ((errorCount / successCount) * 100);
                console.log('EIN [' + targetEIN + '] saved successfully :: Heap Used ' + heapUsed.toFixed(0) + ' MB' + ' :: Errors ' + errorCount + ' :: Success ' + successCount + ' :: [' + errorRate.toFixed(2) + '%]');
                thisLength = 0; //reset

              })
              .catch(function (err) {
                //errorCount++; /* toggle */
                console.error('-----Mongo Insertion Error-----');
                console.error(err);
              });

          })
          .catch(function(err) {
            errorCount++;
            console.error('-----XML Request Error-----');
            console.error(err);
          });
    }

  })
  .on('finish', function() {
    console.log('-----JSON Request is Finished-----');
  })
  .on('error', function(err) {
    console.error('-----mapSync Error-----');
    console.error(err);
  })
);

//Leak detection
var memwatch = require('memwatch-next');
var heapdump = require('heapdump');
var util = require('util');
var hd;

memwatch.on('leak', function(info) {
 console.error(info);
 var file = './tmp/' + process.pid + '-' + Date.now() + '.heapsnapshot';
 heapdump.writeSnapshot(file, function(err){
   if (err) console.error(err);
   else console.error('Wrote snapshot: ' + file);
  });
});
