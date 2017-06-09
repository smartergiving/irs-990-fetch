db.normalized.find().forEach(function(u) {
  let normalized = {};
  const ein = u.Index.EIN;
  const organizationName = u.Index.OrganizationName;
  let assets = null;
  let website = null;
  let city = null;
  let state = null;
  const taxPeriod = u.Index.TaxPeriod;
  let taxYear = null;
  const url = u.Index.URL;

  /** Capture IRS structural error **/
  // It appears certain organizations are listed in the index as filing Form 990PF, despite being 990 filers
  // It appears to be mostly community hospitals, e.g. https://s3.amazonaws.com/irs-form-990/201113139349302361_public.xml
  if (u.Return.ReturnData.IRS990) {
    db.normalized.remove(u); // Delete document
    return; // Skip rest of function
  }

  /** Assets **/
  assets = u.Return.ReturnData.IRS990PF.FMVAssetsEOYAmt || u.Return.ReturnData.IRS990PF.FMVAssetsEOY || null;

  /** Tax Year **/
  taxYear = u.Return.ReturnHeader.TaxYr || u.Return.ReturnHeader.TaxYear || null;

  /** US or Foreign Address **/
  const us = u.Return.ReturnHeader.Filer.USAddress;
  // const foreign = u.Return.ReturnHeader.Filer.ForeignAddress;

  if (us) {
    city = us.CityNm || us.City;
    state = us.StateAbbreviationCd || us.State;
  } else {
    city = 'Foreign';
    state = 'Foreign';
  }
  
  /** Website **/
  const websiteNew = u.Return.ReturnData.IRS990PF.StatementsRegardingActyGrp;
  const websiteOld = u.Return.ReturnData.IRS990PF.StatementsRegardingActivities;

  if (websiteNew) {
    if (websiteNew.WebsiteAddressTxt) {
      website = websiteNew.WebsiteAddressTxt;
    }
  } else if (websiteOld) {
    if (websiteOld.WebsiteAddress) {
      website = websiteOld.WebsiteAddress;
    }
  }
           
  if (website && website.match(/(?:(?:https?):\/\/)/i)) { // Check if properly formatted url
    website = website;
  } else if (website && website.match(/(^www.)/i)) {  // Check if www.
    website = 'http://' + website;
  } else if (website && website.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/i)) { // Check if apex domain (e.g. example.com)
    website = 'http://' + website;
  } else if (website && website.match(/^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/i)) { // Check if email address
    website = 'mailto:' + website;
  } else { // Malformed website
    website = null;
  }
  // TODO Handle edge cases like https://s3.amazonaws.com/irs-form-990/201533179349100823_public.xml (e.g. no domain)

  let hasWebsite = false;

  if (website) {
    website = website.toLowerCase();
    hasWebsite = true;
  }

  /** Board Members & Staff **/
  let people = [];
  let peopleArray = u.Return.ReturnData.IRS990PF.OfficerDirTrstKeyEmplInfoGrp || u.Return.ReturnData.IRS990PF.OfcrDirTrusteesKeyEmployeeInfo || null;
  let personBoard = peopleArray.OfficerDirTrstKeyEmplGrp || peopleArray.OfcrDirTrusteesOrKeyEmployee || null;
  let personStaff = peopleArray.CompensationHighestPaidEmplGrp || peopleArray.CompensationOfHighestPaidEmpl || null;

  let isLikelyStaffed = false;

  // TODO Flatten Names with xml attributes. Currently captures name as object if xml attributes exist
  // Currently handling these edge cases in the HTML template itself
  function convertPeople(each) {
    let name = each.PersonNm || each.PersonName || each.Name || each.BusinessName || null;
    if (name === each.BusinessName) {
      let businessObj = each.BusinessName;
      name = businessObj.BusinessNameLine1Txt || businessObj.BusinessNameLine1 || null;
    }
    let title = each.TitleTxt || each.Title || null;
    let hours = each.AverageHrsPerWkDevotedToPosRt || each.AvgHoursPerWkDevotedToPosition || each.AverageHoursPerWeek || null;
    let comp = each.CompensationAmt || each.Compensation || null;
    let person = {
      'Name': name,
      'Title': title,
      'Hours': Number(hours),
      'Compensation': Number(comp),
    };
    people.push(person);
    if (Number(hours) >= 35 && Number(comp) > 50000 ) {
      isLikelyStaffed = true;
    }
  }
  
  if (peopleArray && personBoard instanceof Array) {
    personBoard.forEach(convertPeople);
  } else if (peopleArray && personBoard) {
    convertPeople(personBoard);
  }

  if (personStaff instanceof Array) {
    personStaff.forEach(convertPeople);
  } else if (personStaff) {
    convertPeople(personStaff);
  }

  /** Grants **/
  let grants = [];
  let grantAmounts = []; // Used to calculate min/max/median
  let grantsArray = u.Return.ReturnData.IRS990PF.SupplementaryInformationGrp || u.Return.ReturnData.IRS990PF.SupplementaryInformation || null;
  let grantCount = 0;
  let hasGrants = false;
  let hasRecentGrants = false;
  let eachGrant;
  if (grantsArray) {
    eachGrant = grantsArray.GrantOrContributionPdDurYrGrp || grantsArray.GrantOrContriPaidDuringYear || null;
  }

  if (grantsArray && eachGrant instanceof Array) {
    grantCount = eachGrant.length;
    hasGrants = true;
    eachGrant.forEach(convertGrants);
    if (grantCount > 10000) {
      print('GrantCount: ' + grantCount + ' || EIN: ' + u.Index.EIN + ' || TaxPeriod: ' + u.Index.TaxPeriod + ' || URL: ' + u.Index.URL + ' || Name: ' + u.Index.OrganizationName);
    }
  } else if (grantsArray && eachGrant) {
    // print('eachGrant: ' + eachGrant);
    hasGrants = true;
    grantCount = 1;
    convertGrants(eachGrant);
  }

  calcHasRecentGrants();

  let grantMedian = getMedian(grantAmounts);
  let grantMax = getMax(grantAmounts);
  let grantMin = getMin(grantAmounts);

  function convertGrants(each) {
    let recipientName = null;
    let recipientCity = null;
    let recipientState = null;
    // Handle null scenario e.g https://s3.amazonaws.com/irs-form-990/201621379349103872_public.xml
    if (!each) {
      return false;
    }
    if (each.RecipientPersonNm) {
      recipientName = each.RecipientPersonNm;
    } else if (each.RecipientBusinessName) {
      recipientName  = each.RecipientBusinessName.BusinessNameLine1Txt || each.RecipientPersonNm || each.RecipientBusinessName.BusinessNameLine1 || null;
    }
    // TODO Add 2011 RecipientPersonName e.g. https://s3.amazonaws.com/irs-form-990/201203549349100200_public.xml
    if (each.RecipientUSAddress) {
      recipientCity = each.RecipientUSAddress.CityNm || each.RecipientUSAddress.City || null;
      recipientState = each.RecipientUSAddress.StateAbbreviationCd ||  each.RecipientUSAddress.State || null;
    }
    let amount = each.Amt || each.Amount || null;
    let purpose = each.GrantOrContributionPurposeTxt || each.PurposeOfGrantOrContribution || null;
    let grant = {
      'Name': recipientName,
      'City': toTitleCase(recipientCity),
      'State': recipientState,
      'Amount': Number(amount),
      'Purpose': purpose,
    };
    // Limit grants to those over $5k if grantmakers has more than 10k total grants
    // Helps maintain 16MB MongoDB document size limit
    if (grantCount > 10000) {
      if (amount && Number(amount) >= 5000) {
        grants.push(grant);
      }
    } else {
      grants.push(grant);
    }
    
    return grantAmounts.push(Number(amount));
  }

  /** Construct object **/
  normalized = {
    'objectID': ein,
    'EIN': ein,
    'OrganizationName': organizationName,
    'Assets': Number(assets),
    'Website': website,
    'City': toTitleCase(city),
    'State': state,
    'TaxPeriod': Number(taxPeriod),
    'TaxYear': Number(taxYear),
    'URL': url,
    'isLikelyStaffed': isLikelyStaffed,
    'hasWebsite': hasWebsite,
    'hasGrants': hasGrants,
    'hasRecentGrants': hasRecentGrants,
    'GrantMax': grantMax,
    'GrantMin': grantMin,
    'GrantMedian': grantMedian,
    'GrantCount': grantCount,
    'Grants': grants,
    'People': people,
  };

  /** Helper functions **/
  function calcHasRecentGrants() {
    if (hasGrants === true && Number(taxYear) >= 2015) {
      hasRecentGrants = true;
    }
  }

  function getMedian(args) {
    if (!args.length) {return 0;}
    // var numbers = args.slice(0).sort((a,b) => a - b);
    const numbers = args.slice(0).sort(function(a, b) {return a - b;});
    const middle = Math.floor(numbers.length / 2);
    const isEven = numbers.length % 2 === 0;
    return isEven ? (numbers[middle] + numbers[middle - 1]) / 2 : numbers[middle];
  }

  function getMax(numArray) {
    let value = Math.max.apply(null, numArray);
    value = isFinite(value) ? value : 0.0;
    return value;
  }

  function getMin(numArray) {
    let value = Math.min.apply(null, numArray);
    value = isFinite(value) ? value : 0.0;
    return value;
  }

  function toTitleCase(str) {
    if (typeof str === 'string') {
      return str.replace(/\w\S*/g, function(txt) {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    } else {
      return str;
    }
  }

  /** Update documents **/
  db.normalized.update(
    u,
    {
      '$set': { 'Normalized': normalized },
    }
  );
});
