const puppeteer = require('puppeteer');
const fs = require('fs');
const jsonexport = require('jsonexport');

async function extractDetails(page, categoryIndex) {
    let category = await page.evaluate((categoryIndex) => document.querySelector(`.indexPane a:nth-child(${+categoryIndex+1}`).innerText, categoryIndex);
    console.log(`Scraping category: '${category}'`);

    if ((await page.$eval('a[disabled]', node => node.innerText)) !== category) {
        await Promise.all([
            (await page.$(`.indexPane a:nth-child(${+categoryIndex+1})`)).click(),
            page.waitForNavigation()
          ]);
    }

    const schoolAnchors = await page.$$('.schoolListPane li a');
    console.log(`${schoolAnchors.length} results found`);

    let categoryData = [];
    let categorySchoolCount = schoolAnchors.length;
    for (let i = 0; i < categorySchoolCount; i++) {
        let schoolAnchor = await page.$(`.schoolListPane li:nth-child(${i+1}) a`);
        await Promise.all([
            schoolAnchor.click(),
            page.waitForNavigation()
          ]);

          let schoolData = await page.evaluate(() => {
            const getInnerText = (selector) => document.querySelector(selector).innerText.trim();
            return {
                orgId: /\((\d+)\)$/.exec(getInnerText('.schoolTitle'))[1],
                schoolName: getInnerText('.schoolTitle').replace(/\(\d+\)$/, '').trim(),
                streetAddress: getInnerText('#StreetAdr'),
                postalAddress: getInnerText('#PostalAdr'),
                phone: getInnerText('#Phone'),
                fax: getInnerText('#Fax'),
                principal: getInnerText('#Manager'),
                email: getInnerText('#Email'),
                studentsFTE: getInnerText('#FTE'),
                website: getInnerText('#WebUrl a')
            };
          });

          categoryData.push(schoolData);
          await Promise.all([
            page.goBack(),
            page.waitForNavigation()
          ]);
    }

    return categoryData;
}

async function executeWithRetry(functionToExecute, retryCount = 3) {
    try {
        return await functionToExecute();
    } catch (ex) {
        if (retryCount > 0) {
            return await executeWithRetry(functionToExecute, --retryCount);
        } else {
            return null;
        }
    }
}

async function scrape(url, retryCount, headless, outputPath, proxyServer) {
    const launchOptions = {
        headless
    };

    if (proxyServer) {
        launchOptions.args = [`--proxy-server=${proxyServer}`];
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await executeWithRetry(() => page.goto(url, { waitUntil: 'load' }), retryCount);
    // wait for page to load
    await page.waitForSelector('.indexPane');
    
    let categories = await page.evaluate(() => Array.from(document.querySelectorAll('.indexPane a')).map(x => x.innerText));
    let result = [];
    for (let categoryIndex in categories) {
        var categoryResult = await extractDetails(page, categoryIndex);
        if (categoryResult.length) {
            result.push(categoryResult);
        }
    }

    await browser.close();
    if (outputPath) {
        jsonexport(result, {
            rename: [
                'Org Id',
                'School Name',
                'Street Address',
                'Postal Address',
                'Phone',
                'Fax',
                'Principal',
                'Email',
                'Students FTE',
                'Website',
            ]
        }, function(err, csv){
            if(err) return console.error(err);
            fs.writeFileSync(outputPath, csv);
        });
    }

    return result;
}

module.exports.scrape = scrape;