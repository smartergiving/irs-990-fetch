let grantCount = 0;
let orgsMoreThanThirtyGrants = 0;
let orgsMoreThanOneHundredGrants = 0;
db.normalized.find().forEach(function(u) {
  /** Grants **/
  let grantsArray = u.Return.ReturnData.IRS990PF.SupplementaryInformationGrp || u.Return.ReturnData.IRS990PF.SupplementaryInformation || null;
  let eachGrant;
  if (grantsArray) {
    eachGrant = grantsArray.GrantOrContributionPdDurYrGrp || grantsArray.GrantOrContriPaidDuringYear || null;
  }

  if (grantsArray && eachGrant instanceof Array) {
    grantCount += eachGrant.length;
  } else if (grantsArray && eachGrant) {
    // print('eachGrant: ' + eachGrant);
    grantCount += 1;
  }

  if (grantCount > 30) {
    orgsMoreThanThirtyGrants += 1;
  }

  if (grantCount > 100) {
    orgsMoreThanOneHundredGrants += 1;
  }
});

print('Grant Count: ' + grantCount);
print('>30 Grants: ' + orgsMoreThanThirtyGrants);
print('>100 Grants: ' + orgsMoreThanOneHundredGrants);
