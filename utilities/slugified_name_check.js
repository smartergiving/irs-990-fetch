// db.aggregated.find({'organization_name': {'$regex': /( attention )|( ta )/i }}).forEach(function(u) {
db.aggregated.find().forEach(function(u) {
  const date = u.last_updated_irs;
  const dateCheck = new Date('2017-04-01T17:54:03.061Z');

  const currentName = u.organization_name;
  const priorName = u.organization_name_prior_year;

  const currentSlugifiedName = slugify(currentName);
  let priorSlugifiedName;
  if (priorName) {
    priorSlugifiedName = slugify(priorName);
  }

  if (priorName && date > dateCheck  && currentSlugifiedName == priorSlugifiedName && currentName !== priorName) {
    print(u.ein);
    print(currentName);
    print(priorName);
  }

  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
});
