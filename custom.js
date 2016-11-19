var request = require('request');
var es = require('event-stream');
var Promise = require('bluebird');
var JSONStream = require('JSONStream');
var xml2jsParser = require('xml2js').parseString;
var request_promise = require('request-promise');

//IRS Index
var year = '2016';
var index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

//AWS
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
var s3 = new AWS.S3();

//Mongo
var dbHostPort = 'localhost:27017';
var dbName = 'irs';
var dbCollection = 'index' + year;
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

      var ein = data.EIN;
      var url = data.URL;
      var taxPeriod = data.TaxPeriod;
      var organizationName = data.OrganizationName;

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

            //Assets
            var assets = resultJS.Return.ReturnData.IRS990PF.FMVAssetsEOYAmt || resultJS.Return.ReturnData.IRS990PF.FMVAssetsEOY || null;

            //Tax Year
            var taxYear = resultJS.Return.ReturnHeader.TaxYr || resultJS.Return.ReturnHeader.TaxYear || null;

            //US or Foreign Address
            var us = resultJS.Return.ReturnHeader.Filer.USAddress;
            var foreign = resultJS.Return.ReturnHeader.Filer.ForeignAddress;
            var city = null;
            var state = null;

            if (us) {
              city = us.CityNm || us.City;
              state = us.StateAbbreviationCd || us.State;
            } else {
              city = 'Foreign';
              state = 'Foreign';
            }
            
            //Website
            var website = null;
            var websiteNew = resultJS.Return.ReturnData.IRS990PF.StatementsRegardingActyGrp;
            var websiteOld = resultJS.Return.ReturnData.IRS990PF.StatementsRegardingActivities;

            if (websiteNew) {
              if (websiteNew.WebsiteAddressTxt) {
                website = websiteNew.WebsiteAddressTxt;
              }
            } else if (websiteOld) {
              if (websiteOld.WebsiteAddress) {
                website = websiteOld.WebsiteAddress;
              }
            }

            //Quick check for valid website
            //TODO Handle https://s3.amazonaws.com/irs-form-990/201533179349100823_public.xml
            //TODO Handle email addresses - contains both '.' and '@'
            if (website !== null && !website.includes('.')) {
              website = null;
            }

            function toTitleCase(str) {
              if (typeof str === 'string') {
                return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
              } else {
                return str;
              }
            }

            obj = {
              'EIN': ein,
              'OrganizationName': organizationName,
              'TaxPeriod': Number(taxPeriod),
              'TaxYear': Number(taxYear),
              'URL': url,
              'Assets': Number(assets),
              'Website': website,
              'City': toTitleCase(city),
              'State': state
            };
            console.log(obj);
            

            // Write the JS object to Mongo
            //mycollection.save(resultJS) //Writes entire XML object
            mycollection.save(obj) //Writes selected fields
              .then(function (resultArr) {

              })
              .catch(function (err) {
                console.error('-----Mongo Insertion Error-----');
                console.error(err);
              });
            
          })
          
          .catch(function(err) {
            console.error('-----XML Request Error-----');
            if (url)
              console.error('URL: ' + url);
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
