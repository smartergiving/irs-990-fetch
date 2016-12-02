db.algoliaTmp.aggregate([
  { $sort: { 'Algolia.EIN': 1, 'Algolia.TaxPeriod': -1 } },
  { $group:
    {
      '_id': '$Algolia.EIN',
      'objectID': { $first:'$Algolia.EIN' },
      'EIN': { $first:'$Algolia.EIN'},
      'OrganizationName': { $first:'$Algolia.OrganizationName' },
      'Assets': { $first: '$Algolia.Assets' },
      'Website': { $first: '$Algolia.Website' },
      'City': { $first: '$Algolia.City' },
      'State': { $first: '$Algolia.State'},
      'isLikelyStaffed': { $first: '$Algolia.isLikelyStaffed' },
      'GrantMax': { $first: '$Algolia.grantMax' },
      'GrantMin': { $first: '$Algolia.grantMin' },
      'GrantMedian': { $first: '$Algolia.grantMedian' },
      'Filings': { 
        $push: {
          'TaxPeriod': '$Algolia.TaxPeriod',
          'TaxYear': '$Algolia.TaxYear',
          'URL': '$Algolia.URL'
        }
      }
    } 
  },
  { $out: 'algolia' }
],
  { allowDiskUse:true }
);