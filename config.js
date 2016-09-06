module.exports = {
  bot_name: '@fspls_bot',
  perPage: 10,
  api: {
    base: 'http://fs.to',
    search: '/search.aspx'
  },
  db: {
    url: 'mongodb://localhost/',
    db: 'fspls_bot'
  },
  history_limit: 20
};
