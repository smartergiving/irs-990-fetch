// gcloud beta functions deploy syncWithAlgolia --stage-bucket bucketname --trigger-http
const algoliasearch = require('algoliasearch');
const secrets = require('./secrets');

// Algolia
const appID = secrets.algolia.appID;
const apiKey = secrets.algolia.apiKey;
const indexName = secrets.algolia.indexName;
const client = algoliasearch(appID, apiKey);
const index = client.initIndex(indexName);

// MongoDB
const Db = require('mongodb').Db;
const Server = require('mongodb').Server;
const db = new Db('grantmakers', new Server(secrets.gce.host, '27017'));

exports.syncWithAlgolia = function syncWithAlgolia(req, res) {
  // Open a db connection
  db.open(function(e) {
    if (e) throw new Error(e);

    db.admin().authenticate(secrets.gce.user, secrets.gce.password, function(err, result) {
      if (result) {
        // Get the collection
        db.collection('algolia', function(error, collection) {
          if (error) throw new Error(err);

          // Get the collection count
          collection.count()
            .then(function(count) {
              const collectionCount = count;
              let processedCount = 0;
              let batch = [];

              // Iterate over the whole collection using a cursor
              collection.find().forEach(function(doc) {
                // Remove unnecessary fields
                delete doc._id;
                
                batch.push(doc);
                ++processedCount;

                // Send documents by batch of 5000 to Algolia
                if (batch.length >= 5000) {
                  sendToAlgolia(batch);
                  batch = [];
                }

                // Send remaining documents
                if (processedCount === collectionCount) {
                  sendToAlgolia(batch);
                  res.send('Algolia sync complete \n');
                }
              });
            });
        });
      }
    });
  });

  function sendToAlgolia(batch) {
    index.partialUpdateObjects(batch, function(err, content) {
      if (err) throw new Error(err);
      let recordsCount = batch.length;
      index.waitTask(content.taskID, function() {
        console.log('Indexed ' + recordsCount + ' records in ' + content.taskID);
        db.close();
      });
    });
  }
};
