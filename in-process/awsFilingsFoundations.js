//TODO Fix memory leak
var AWS = require('aws-sdk');
var es = require('event-stream');
var Promise = require('bluebird');
var JSONStream = require('JSONStream');
var xml2jsParser = require('xml2js').parseString;

//MongoDB
var dbHost = 'localhost:27017';
var dbName = 'irs';
var dbCollection = 'filings';
var db = require('mongodb-promises').db(dbHost, dbName);
var mycollection = db.collection(dbCollection);
    
//AWS Setup
AWS.config.region = 'us-east-1';
var s3 = new AWS.S3();
var paramsIndex = {Bucket: 'irs-form-990', Key: 'index.json'};

//xml2js
var parserOptions = {explicitArray: false, emptyTag: undefined, attrkey: 'attributes'};

//Logs
var successCount = 0;

//Fetch index.json object from Amazon S3
s3.makeUnauthenticatedRequest('getObject', paramsIndex).createReadStream()
  .pipe(JSONStream.parse(['AllFilings',true]))
  .pipe(es.mapSync(function (data) {

    //Filter results down to foundations w/ data available
    if(data.URL && data.URL.length > 0 && data.FormType == '990PF') {
      
      //Fetch individual XML files
      var targetKey = data.ObjectId + '_public.xml';
      var paramsXML = {Bucket: 'irs-form-990', Key: targetKey};
      var getObjectPromise = s3.makeUnauthenticatedRequest('getObject', paramsXML).promise();

      getObjectPromise
        .then(function (resultXML) {

          //Parse the XML
          return promisesParser(resultXML);

        })
        .then(function (resultJS) {

          //Send JS Object to MongoDB
          mycollection.save(resultJS)
            .then(function (resultArr) {

              successCount++;
              var heapUsed = process.memoryUsage().heapUsed / 1000000;
              console.log(successCount + ' saved successfully :: ' + targetKey + ' :: Heap ' + heapUsed.toFixed(0) + ' MB');

            })
            .catch(function (err) {
              console.error('Error on insert ', err);
            });

        })
        .catch(function(err) {
          console.error(err);
        });
        // no need to explicity call close...the mongodb promises library should handle that.
    }
    return;

  })
  .on('error', function(e) {
      console.error('-----Index Fetch Error-----');
      console.error(e);
  })
  .on('end', function() {
    self.emit('-----Index Fetch Complete-----');
  })
);

//xml2js
function promisesParser(string) {
  var newPromise = new Promise(function (resolve, reject) {
    xml2jsParser(string.Body, parserOptions, function(err, result) {
      if (err) {
        return reject(err);
       } else {
        return resolve(result);
       }
    });
  });
  return newPromise;
}

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
