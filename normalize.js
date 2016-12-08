db.algoliaTmp.find().forEach(function(u){
  
  var algolia = {};

  var ein = u.Index.EIN;
  var organizationName = u.Index.OrganizationName;
  var assets = null;
  var website = null;
  var city = null;
  var state = null;
  var taxPeriod = u.Index.TaxPeriod;
  var taxYear = null;
  var url = u.Index.URL;


  /** Capture IRS structural error **/
  // It appears certain organizations are listed in the index as filing Form 990PF, despite being 990 filers
  // It appears to be mostly community hospitals, e.g. https://s3.amazonaws.com/irs-form-990/201113139349302361_public.xml
  if (u.Return.ReturnData.IRS990) {
    return;
  }


  /** Assets **/
  assets = u.Return.ReturnData.IRS990PF.FMVAssetsEOYAmt || u.Return.ReturnData.IRS990PF.FMVAssetsEOY || null;


  /** Tax Year **/
  taxYear = u.Return.ReturnHeader.TaxYr || u.Return.ReturnHeader.TaxYear || null;


  /** US or Foreign Address **/
  var us = u.Return.ReturnHeader.Filer.USAddress;
  var foreign = u.Return.ReturnHeader.Filer.ForeignAddress;

  if (us) {
    city = us.CityNm || us.City;
    state = us.StateAbbreviationCd || us.State;
  } else {
    city = 'Foreign';
    state = 'Foreign';
  }
  
  /** Website **/
  var websiteNew = u.Return.ReturnData.IRS990PF.StatementsRegardingActyGrp;
  var websiteOld = u.Return.ReturnData.IRS990PF.StatementsRegardingActivities;

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

  var hasWebsite = false;

  if (website) {
  	website = website.toLowerCase();
    hasWebsite = true;
  }


  /** Board Members & Staff **/
  var people = [];
  var peopleArray = u.Return.ReturnData.IRS990PF.OfficerDirTrstKeyEmplInfoGrp || u.Return.ReturnData.IRS990PF.OfcrDirTrusteesKeyEmployeeInfo || null;
  var personBoard = peopleArray.OfficerDirTrstKeyEmplGrp || peopleArray.OfcrDirTrusteesOrKeyEmployee || null;
  var personStaff = peopleArray.CompensationHighestPaidEmplGrp || peopleArray.CompensationOfHighestPaidEmpl || null;

  var isLikelyStaffed = false;

  function convertPeople(each) {
      var name = each.PersonNm || each.PersonName || each.Name || null;
      var title = each.TitleTxt || each.Title || null;
      var hours = each.AverageHrsPerWkDevotedToPosRt || each.AvgHoursPerWkDevotedToPosition || each.AverageHoursPerWeek || null;
      var comp = each.CompensationAmt || each.Compensation || null;
      var person = {
        'Name': name,
        'Title': title,
        'Hours': Number(hours),
        'Compensation': Number(comp)
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
  var grants = [];
  var grantAmounts = []; // Used to calculate min/max/median
  var grantsArray = u.Return.ReturnData.IRS990PF.SupplementaryInformationGrp || u.Return.ReturnData.IRS990PF.SupplementaryInformation || null;
  var grantCount = 0;
  var hasGrants = false;
  var eachGrant;
  if (grantsArray) {
  	eachGrant = grantsArray.GrantOrContributionPdDurYrGrp || grantsArray.GrantOrContriPaidDuringYear || null;
  }

  if (grantsArray && eachGrant instanceof Array) {
    grantCount = eachGrant.length;
    hasGrants = true;
    eachGrant.forEach(convertGrants);
  } else if (grantsArray && eachGrant) {
    hasGrants = true;
    grantCount = 1;
    convertGrants(eachGrant);
  }

  var grantMedian = getMedian(grantAmounts);
  var grantMax = getMax(grantAmounts);
  var grantMin = getMin(grantAmounts);

  function convertGrants(each) {
    var name = null;
    var city = null;
    var state = null;
    if (each.RecipientPersonNm) {
      name = each.RecipientPersonNm;
    } else if (each.RecipientBusinessName) {
      name  = each.RecipientBusinessName.BusinessNameLine1Txt || each.RecipientPersonNm || each.RecipientBusinessName.BusinessNameLine1 || null;
    }
    if (each.RecipientUSAddress) {
      city = each.RecipientUSAddress.CityNm || each.RecipientUSAddress.City || null;
      state = each.RecipientUSAddress.StateAbbreviationCd ||  each.RecipientUSAddress.State || null;
    }
    var amount = each.Amt || each.Amount || null;
    var purpose = each.GrantOrContributionPurposeTxt || each.PurposeOfGrantOrContribution | null;
    var grant = {
      'Name': name,
      'City': toTitleCase(city),
      'State': state,
      'Amount': Number(amount),
      'Purpose': purpose
    };
    if (amount && Number(amount) >= 10000) {
      grants.push(grant);
    }
    grantAmounts.push(Number(amount));
  }


  /** Construct object **/
  algolia = {
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
    'GrantMax': grantMax,
    'GrantMin': grantMin,
    'GrantMedian': grantMedian,
    'GrantCount': grantCount,
    'Grants': grants,
    'People': people
  };


  /** Helper functions **/
  function getMedian(args) {
	  if (!args.length) {return 0;}
	  //var numbers = args.slice(0).sort((a,b) => a - b);
	  var numbers = args.slice(0).sort(function(a,b){return a - b;});
	  var middle = Math.floor(numbers.length / 2);
	  var isEven = numbers.length % 2 === 0;
	  return isEven ? (numbers[middle] + numbers[middle - 1]) / 2 : numbers[middle];
	}

	function getMax(numArray) {
		var value = Math.max.apply(null, numArray);
		value = isFinite(value) ? value : 0.0;
  	return value;
	}

	function getMin(numArray) {
  	var value = Math.min.apply(null, numArray);
		value = isFinite(value) ? value : 0.0;
  	return value;
	}

	function toTitleCase(str) {
    if (typeof str === 'string') {
      return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    } else {
      return str;
    }
  }


	/** Update documents **/
  db.algoliaTmp.update(
  	u, 
  	{ $set: {'Algolia': algolia}}
  );
});