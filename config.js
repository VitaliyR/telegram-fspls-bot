module.exports = {
  bot_name: '@fspls_bot',
  perPage: 10,
  api: {
    base: 'http://fs.life',
    search: '/search.aspx',
    timeout: 6000
  },
  db: {
    url: 'mongodb://localhost/',
    db: 'fspls_bot'
  },
  history_limit: 20,
  i18nDefault: 'en'
};
