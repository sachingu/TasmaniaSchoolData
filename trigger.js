const args = require('minimist')(process.argv.slice(2), { boolean: 'headless' });
const scraper = require('./index');

(async () => {
    const url = 'https://profile.education.tas.gov.au/schoollist.aspx';

    const proxyServer = args.proxy;
    const headless = args.headless;
    const retries = args.retries || 10;
    const outputPath = args.output;

    await scraper.scrape(url, retries, headless, outputPath, proxyServer);
})();