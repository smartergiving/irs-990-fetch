// Usage: node filings_counts.js // Defaults to the 2017 index
// Can also take a year parameter: node filings_counts.js 2016
const request = require('request');
const es = require('event-stream');
const JSONStream = require('JSONStream');

// IRS Indexes
const targetYear = process.argv[2] || '2017'; // The year to fetch
const index = 'https://s3.amazonaws.com/irs-form-990/index_' + targetYear + '.json';

let count = 0;

let nineNinety = 0;
let pf = 0;
let ez = 0;
let unknown = 0;

// Main Function
request(index)
  .on('error', function(err) {
    console.error('-----Index Request Error-----');
    console.error(err);
  })
  .pipe(JSONStream.parse(['Filings' + targetYear, true]))
  .on('error', function(err) {
    console.error('-----JSONParse Error-----');
    console.error(err);
  })
  .pipe(es.mapSync(function(data) {
    count++;
    // Filter results to only foundations w/ data available
    if (data.URL && data.URL.length > 0) {
      if (data.FormType === '990PF') {
        pf++;
      }
      if (data.FormType === '990EZ') {
        ez++;
      }
      if (data.FormType === '990') {
        nineNinety++;
      }
    } else {
      unknown++;
    }

    return;
  })
  .on('error', function(err) {
    console.error('-----mapSync Error-----');
    console.error(err);
  })
  .on('end', function() {
    console.log('\n' + '990:   ' + nineNinety);
    console.log('990EZ: ' + ez);
    console.log('990PF: ' + pf + '\n');
    console.log('Total Records:   ' + count + '\n' );
    console.log('990 & 990EZ:     ' + (nineNinety + ez) + '\n');
    console.log('Unkown FileType: ' + unknown);
  })
);
