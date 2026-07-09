function categoryInUseCount(database, key) {
  return database.prepare('SELECT COUNT(*) AS n FROM budget_entries WHERE category = ?').get(key).n;
}

function subcategoryInUseCount(database, key) {
  return database.prepare('SELECT COUNT(*) AS n FROM budget_entries WHERE subcategory = ?').get(key).n;
}

function categoryCountByType(database, type) {
  return database.prepare('SELECT COUNT(*) AS n FROM budget_categories WHERE type = ?').get(type).n;
}

function subcategoryCountForCategory(database, categoryKey) {
  return database.prepare('SELECT COUNT(*) AS n FROM budget_subcategories WHERE category_key = ?').get(categoryKey).n;
}

export { categoryInUseCount, subcategoryInUseCount, categoryCountByType, subcategoryCountForCategory };
