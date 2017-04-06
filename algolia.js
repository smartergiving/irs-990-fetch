db.normalized.aggregate(
  [
    { $sort: { 'Normalized.EIN': 1, 'Normalized.TaxPeriod': -1 } },
    { $group:
      {
        '_id': '$Normalized.EIN',
        'objectID': { $first:'$Normalized.EIN' },
        'EIN': { $first:'$Normalized.EIN' },
        'OrganizationName': { $first:'$Normalized.OrganizationName' },
        'Assets': { $first: '$Normalized.Assets' },
        'Website': { $first: '$Normalized.Website' },
        'City': { $first: '$Normalized.City' },
        'State': { $first: '$Normalized.State'},
        'isLikelyStaffed': { $first: '$Normalized.isLikelyStaffed' },
        'hasWebsite': { $first: '$Normalized.hasWebsite' },
        'hasGrants': { $first: '$Normalized.hasGrants' },
        'hasRecentGrants': { $first: '$Normalized.hasRecentGrants' },
        'GrantMax': { $first: '$Normalized.GrantMax' },
        'GrantMin': { $first: '$Normalized.GrantMin' },
        'GrantMedian': { $first: '$Normalized.GrantMedian' },
        'GrantCount': { $first: '$Normalized.GrantCount' },
        'Filings': { 
          $push: {
            'TaxPeriod': '$Normalized.TaxPeriod',
            'TaxYear': '$Normalized.TaxYear',
            'URL': '$Normalized.URL'
          }
        },
        'Grants': { $first: '$Normalized.Grants'},
        'People': { $first: '$Normalized.People'}
      } 
    },
    { $out: 'algolia' }
  ],
  { allowDiskUse:true }
);