var request = require('request');
var es = require('event-stream');
var Promise = require('bluebird');
var JSONStream = require('JSONStream');
var xml2jsParser = require('xml2js').parseString;
var request_promise = require('request-promise');
var secrets = require('./secrets');

//IRS Indexes
var year = '2017';
var index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

//AWS
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
var s3 = new AWS.S3();

//Mongo
//local db
var dbHostPort = 'localhost:27017';

//remote db
//start
/*
var remoteUser = secrets.gce.user;
var remotePassword = secrets.gce.password;
var remoteHost = secrets.gce.host;
var remotePort = secrets.gce.port;
var dbHostPort =  remoteUser + ':' + 
                  remotePassword + '@' +
                  remoteHost + ':' +
                  remotePort;
                  */
//end

var dbName  = 'irs';
var dbCollection = 'irs' + year;
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
    if(data.URL && data.URL.length > 0 && data.FormType == '990') {

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

            // TaxYear
            var taxYear = resultJS.Return.ReturnHeader.TaxYr;
            if (taxYear !== '2015') {
              return;
            }

            // Website
            var website = resultJS.Return.ReturnData.IRS990.WebsiteAddressTxt;
                     
            if (website && website.match(/(?:(?:https?):\/\/)/i)) { // Check if properly formatted url
              website = website;
            } else if (website && website.match(/(^www.)/i)) {  // Check if www.
              website = 'http://' + website;
            } else if (website && website.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/i)) { // Check if apex domain (e.g. example.com)
              website = 'http://' + website;  
            } else if (website && website.match(/^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/i)) { // Check if email address
              website = 'mailto:' + website;    
            } else { // Malformed website
              website = null;
            }

            // Employees
            var employees = resultJS.Return.ReturnData.IRS990.TotalEmployeeCnt;
            if (employees) {
              employees = employees;
            } else {
              employees = null;
            }

            var obj = {};

            obj = {
              //'Index': data,
              //'Return': resultJS.Return
              'OrganizationName': data.OrganizationName,
              'URL': data.URL,
              'Mission': resultJS.Return.ReturnData.IRS990.ActivityOrMissionDesc,
              'MissonAlt': resultJS.Return.ReturnData.IRS990.MissionDesc,
              'Website': website,
              'Employees': Number(employees)
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
