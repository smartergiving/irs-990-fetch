const request = require('request');
const es = require('event-stream');
const JSONStream = require('JSONStream');

// IRS Indexes
const year = '2017';
const index = 'https://s3.amazonaws.com/irs-form-990/index_' + year + '.json';

// Count
let count = 0;

// Timer
let start = new Date().getTime();

exports.checkForUpdates = function checkForUpdates(req, res) {
  request(index)
    .on('error', function(err) {
      console.error('-----Index Request Error-----');
      console.error(err);
      res.status(500).send('Index Request Error');
    })
    .pipe(JSONStream.parse(['Filings' + year, true]))
    .on('error', function(err) {
      console.error('-----JSONParse Error-----');
      console.error(err);
      res.status(500).send('JSONParse Error');
    })
    .pipe(es.mapSync(function(data) {
      // Filter results to only foundations w/ data available
      if (data.URL && data.URL.length > 0 && data.FormType === '990PF') {
        ++count;
      }
    })
    .on('end', function() {
      let elapsed = new Date().getTime() - start;
      res.send('Total objects: ' + count + ' | Time to complete: ' + elapsed);
    })
    .on('error', function(err) {
      console.error('-----mapSync Error-----');
      console.error(err);
      res.status(500).send('mapSync Error');
    })
  );
};
