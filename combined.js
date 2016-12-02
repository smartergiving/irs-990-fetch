var request = require('request');
var es = require('event-stream');
var Promise = require('bluebird');
var JSONStream = require('JSONStream');
var xml2jsParser = require('xml2js').parseString;
var request_promise = require('request-promise');

//IRS Indexes
var year = '2011';
var index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

//AWS
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
var s3 = new AWS.S3();

//Mongo
var dbHostPort = 'localhost:27017';
var dbName = 'irs';
var dbCollection = 'filings' + year;
var db = require('mongodb-promises').db(dbHostPort, dbName);
var mycollection = db.collection(dbCollection);

// xml2js
var parserOptions = {explicitArray: false, emptyTag: undefined, attrkey: 'attributes'};

// Main Function
request(index)
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

        //Fetch XML using AWS SDK
        var targetKey = data.ObjectId + '_public.xml';
        var paramsXML = {Bucket: 'irs-form-990', Key: targetKey};
        
        s3.makeUnauthenticatedRequest('getObject', paramsXML).promise()
          .then(function(resultXML) {

            //Parse the XML file
            return new Promise(function(resolve, reject) {
              xml2jsParser(resultXML.Body, parserOptions, function(err, result) {
                if (err) {
                  return reject(err);
                 } else {
                  return resolve(result);
                 }
              });
            });

          })
          .then(function(resultJS) {

            var obj = {};

            obj = {
              'Index': data,
              'Return': resultJS.Return
            };

            // Write the JS object to Mongo
            mycollection.save(obj)
              .then(function (resultArr) {

              })
              .catch(function (err) {
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
