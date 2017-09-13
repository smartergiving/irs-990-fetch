// gcloud beta functions deploy functionName --stage-bucket bucketname --trigger-http
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
const db = new Db('irs', new Server(secrets.gce.host, '27017'));

exports.syncWithAlgolia = function syncWithAlgolia(req, res) {
  // Open a db connection
  db.open(function(oErr) {
    if (oErr) throw new Error(oErr);

    db.admin().authenticate(secrets.gce.user, secrets.gce.password, function(aErr, result) {
      if (result) {
        // Get the collection
        db.collection('grants', function(gErr, collection) {
          if (gErr) throw new Error(gErr);

          // Get the collection count
          collection.count()
            .then(function(count) {
              const collectionCount = count;
              let processedCount = 0;
              let batch = [];

              // Iterate over the whole collection using a cursor
              return collection.find().forEach(function loopThroughCollection(doc) {
                // Remove unnecessary fields
                delete doc._id;
                
                // Add doc to batch array
                batch.push(doc);
                ++processedCount;

                // Send documents by batch of 5000 to Algolia
                if (batch.length >= 5000) {
                  return sendToAlgolia(batch).then(function sendBatchToAlgolia() {
                    batch = [];
                  });
                }

                // Send remaining documents
                if (processedCount === collectionCount) {
                  return sendToAlgolia(batch).then(function sendFinalBatchToAlgolia() {
                    res.send('Algolia sync complete \n');
                    db.close();
                  });
                }
                return false;
              });
            })
            .catch(function(cErr) {
              throw new Error(cErr);
            });
        });
      }
    });
  });

  function sendToAlgolia(batch) {
    index.addObjects(batch);
  }
};
