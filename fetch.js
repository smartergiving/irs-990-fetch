const request = require('request');
const es = require('event-stream');
const Promise = require('bluebird');
const JSONStream = require('JSONStream');
const xml2jsParser = require('xml2js').parseString;
// const request_promise = require('request-promise');
// const secrets = require('./secrets');

// IRS Indexes
const year = '2017';
const index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

// AWS
const AWS = require('aws-sdk');
AWS.config.update({'region': 'us-east-1'});
const s3 = new AWS.S3();

// Mongo
// local db
const dbHostPort = 'localhost:27017';

// remote db
// start
/*
const remoteUser = secrets.gce.user;
const remotePassword = secrets.gce.password;
const remoteHost = secrets.gce.host;
const remotePort = secrets.gce.port;
const dbHostPort =  remoteUser + ':' +
                  remotePassword + '@' +
                  remoteHost + ':' +
                  remotePort;
                  */
// end

const dbName  = 'irs';
const dbCollection = 'irs' + year;
const db = require('mongodb-promises').db(dbHostPort, dbName);
const mycollection = db.collection(dbCollection);

// xml2js
const parserOptions = {'explicitArray': false, 'emptyTag': undefined, 'attrkey': 'attributes'};

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
  .pipe(es.mapSync(function(data) {
    // Filter results to only foundations w/ data available
    if (data.URL && data.URL.length > 0 && data.FormType === '990PF') {
      // Fetch XML using AWS SDK
      const targetKey = data.ObjectId + '_public.xml';
      const paramsXML = {'Bucket': 'irs-form-990', 'Key': targetKey};
      
      s3.makeUnauthenticatedRequest('getObject', paramsXML).promise()
        .then(function(resultXML) {
          // Parse the XML file
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
          let obj = {};

          obj = {
            'Index': data,
            'Return': resultJS.Return,
          };

          // Write the JS object to Mongo
          mycollection.save(obj)
            .then(function(resultArr) {
              // tbd
            })
            .catch(function(err) {
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
  .on('end', function() {
    console.log('-----JSON Request is Finished-----');
  })
  .on('error', function(err) {
    console.error('-----mapSync Error-----');
    console.error(err);
  })
);
