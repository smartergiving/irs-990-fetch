db.normalized.aggregate(
  [
    { '$sort': { 'normalized.ein': 1, 'normalized.tax_period': -1 } },
    { '$group': {
      '_id': '$normalized.ein',
      'last_updated': { '$first': '$normalized.last_updated'},
      'last_updated_irs': { '$first': '$normalized.last_updated_irs'},
      'ein': { '$first': '$normalized.ein' },
      'organization_name': { '$first': '$normalized.organization_name' },
      'assets': { '$first': '$normalized.assets' },
      'website': { '$first': '$normalized.website' },
      'city': { '$first': '$normalized.city' },
      'state': { '$first': '$normalized.state'},
      'is_likely_staffed': { '$first': '$normalized.is_likely_staffed' },
      'has_website': { '$first': '$normalized.has_website' },
      'has_grants': { '$first': '$normalized.has_grants' },
      'has_recent_grants': { '$first': '$normalized.has_recent_grants' },
      'grant_max': { '$first': '$normalized.grant_max' },
      'grant_min': { '$first': '$normalized.grant_min' },
      'grant_median': { '$first': '$normalized.grant_median' },
      'grant_count': { '$first': '$normalized.grant_count' },
      'grant_count_all_years': { $sum: "$normalized.grant_count" },
      'filings': {
        '$push': {
          'object_id_irs': '$normalized.object_id_irs',
          'tax_period': '$normalized.tax_period',
          'tax_year': '$normalized.tax_year',
          'url': '$normalized.url',
        },
      },
      'grants': { '$first': '$normalized.grants'},
      'people': { '$first': '$normalized.people'},
    }},
    { '$out': 'aggregated' },
  ],
  { 'allowDiskUse': true }
);
