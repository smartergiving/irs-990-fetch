db.algoliaTmp.aggregate(
  [
    { $sort: { 'Algolia.EIN': 1, 'Algolia.TaxPeriod': -1 } },
    { $group:
      {
        '_id': '$Algolia.EIN',
        'objectID': { $first:'$Algolia.EIN' },
        'EIN': { $first:'$Algolia.EIN' },
        'OrganizationName': { $first:'$Algolia.OrganizationName' },
        'Assets': { $first: '$Algolia.Assets' },
        'Website': { $first: '$Algolia.Website' },
        'City': { $first: '$Algolia.City' },
        'State': { $first: '$Algolia.State'},
        'isLikelyStaffed': { $first: '$Algolia.isLikelyStaffed' },
        'hasWebsite': { $first: '$Algolia.hasWebsite' },
        'hasGrants': { $first: '$Algolia.hasGrants' },
        'hasRecentGrants': { $first: '$Algolia.hasRecentGrants' },
        'GrantMax': { $first: '$Algolia.GrantMax' },
        'GrantMin': { $first: '$Algolia.GrantMin' },
        'GrantMedian': { $first: '$Algolia.GrantMedian' },
        'GrantCount': { $first: '$Algolia.GrantCount' },
        'Filings': { 
          $push: {
            'TaxPeriod': '$Algolia.TaxPeriod',
            'TaxYear': '$Algolia.TaxYear',
            'URL': '$Algolia.URL'
          }
        },
        'Grants': { $first: '$Algolia.Grants'},
        'People': { $first: '$Algolia.People'}
      } 
    },
    { $out: 'algolia' }
  ],
  { allowDiskUse:true }
);