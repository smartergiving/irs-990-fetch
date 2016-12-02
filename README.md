# IRS Form 990-PF Fetch :: Node.js Edition
Lightweight but powerful Node.js scripts to fetch all machine-readable IRS Form 990-PFs and insert into a MongoDB database. 

Datasets: [Public IRS data set hosted by Amazon AWS](https://aws.amazon.com/public-data-sets/irs-990/)  

## What it Does  

- [x] Fetch each year's index of Form 990s  
- [x] Parse JSON and limit to Form 990-PFs  
- [x] Fetch XML tax filings  
- [x] Parse XML and convert to JavaScript objects  
- [x] Insert into MongoDB  

## The Scripts  

 1. `indexes.js` - fetches index listings relating to IRS Form 990-PF filings for the specified tax year and inserts into MongoDB   
 2. `filings.js` - fetches all IRS Form 990-PF filings for the specified tax year and inserts into MongoDB 
 3. `combined.js` - similar to filings.js, but inserts index data as well 
 3. `custom.js` - combines data from IRS indexes and respective tax filings to create a custom index. Currently used to power our [IRS Form 990-PF Search demo](https://smartergiving.org/irs-990-search/).  

## Usage



iMac with 16GB RAM  
`ulimit -n 4096 && mongod --dbpath ./data/db/`  
`ulimit -n 4096 && node combined`  

MacBook Air with 8GB RAM (struggles)  
`ulimit -n 2048 && mongod --dbpath ./data/db/`  
`ulimit -n 2048 && node combined`  

*Note: The IRS no longer offers a single index for all filings. Thus, each script must be run once for each year (e.g. [toggle the year](https://github.com/smartergiving/irs-nodejs-fetch/blob/master/combined.js#L9)). *

## Troubleshooting

See `troubleshoot.js` to log memory usage and toggle between using the npm request-promise package and the AWS JavaScript SDK.

## Credits  

A huge thank you to [Joseph Lepis](https://www.linkedin.com/in/joseph-lepis-2700934) for the architectural guidance and mentorship. If you find these scripts useful and appreciate [hard-boiled fiction](https://en.wikipedia.org/wiki/Hardboiled), check out Joe's debut novel, [On the Edge](https://www.amazon.com/Edge-J-B-Christopher-ebook/dp/B00GWTXZ64/). 

## License  

MIT License

Copyright (c) 2016 Chad Kruse, SmarterGiving

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 
