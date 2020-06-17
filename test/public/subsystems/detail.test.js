/**
 * @license
 * Copyright CERN and copyright holders of ALICE O2. This software is
 * distributed under the terms of the GNU General Public License v3 (GPL
 * Version 3), copied verbatim in the file "COPYING".
 *
 * See http://alice-o2.web.cern.ch/license for full licensing information.
 *
 * In applying this license CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

const chai = require('chai');
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul');
const { server } = require('../../../lib/application');

const { expect } = chai;

/**
 * Special method built due to Puppeteer limitations: looks for the first row matching an ID in a table
 * @param {Object} table An HTML element representing the entire tag table
 * @param {Object} page An object representing the browser page being used by Puppeteer
 * @return {String} The ID of the first matching row with data
 */
async function getFirstRow(table, page) {
    for (const child of table) {
        const id = await page.evaluate((element) => element.id, child);
        if (id.startsWith('row')) {
            return id;
        }
    }
}

module.exports = () => {
    let page;
    let browser;
    let url;

    let table;
    let firstRowId;

    before(async () => {
        browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        page = await browser.newPage();
        await Promise.all([
            page.coverage.startJSCoverage({ resetOnNavigation: false }),
            page.coverage.startCSSCoverage(),
        ]);

        const { port } = server.address();
        url = `http://localhost:${port}`;
    });

    after(async () => {
        const [jsCoverage, cssCoverage] = await Promise.all([
            page.coverage.stopJSCoverage(),
            page.coverage.stopCSSCoverage(),
        ]);

        pti.write([...jsCoverage, ...cssCoverage].filter(({ url = '' } = {}) => url.match(/\.(js|css)$/)), {
            includeHostname: false,
            storagePath: './.nyc_output/lib/public',
        });
        await browser.close();
    });

    it('subsystem detail loads correctly', async () => {
        await page.goto(`${url}/?page=subsystems&id=1`);
        await page.waitFor(100);

        const postExists = await page.$('h2');
        expect(Boolean(postExists)).to.be.true;

        const title = await page.evaluate((element) => element.innerText, postExists);
        expect(title).to.equal('Subsystem: Subsystem Plant #1');
    });

    it('can navigate to the log panel', async () => {
        await page.click('#logs-tab');
        await page.waitFor(100);
        const redirectedUrl = await page.url();
        expect(String(redirectedUrl).startsWith(`${url}/?page=subsystem&id=1&panel=logs`)).to.be.true;
    });

    it('can navigate to the main panel', async () => {
        await page.click('#main-tab');
        await page.waitFor(100);
        const redirectedUrl = await page.url();
        expect(String(redirectedUrl).startsWith(`${url}/?page=subsystem&id=1&panel=main`)).to.be.true;
    });

    it('can navigate to the log panel', async () => {
        await page.click('#logs-tab');
        await page.waitFor(100);
        const redirectedUrl = await page.url();
        expect(String(redirectedUrl).startsWith(`${url}/?page=subsystem&id=1&panel=logs`)).to.be.true;
    });

    it('can navigate to a log detail page', async () => {
        table = await page.$$('tr');
        firstRowId = await getFirstRow(table, page);

        // We expect the entry page to have the same id as the id from the subsystem overview
        await page.click(`#${firstRowId}`);
        await page.waitFor(100);
        const redirectedUrl = await page.url();
        expect(String(redirectedUrl).startsWith(`${url}/?page=entry&id=3`)).to.be.true;
    });

    it('notifies if a specified subsystem id is invalid', async () => {
        // Navigate to a subsystem detail view with an id that cannot exist
        await page.goto(`${url}/?page=subsystem&id=abc`);
        await page.waitFor(100);

        // We expect there to be an error message
        const error = await page.$('.alert');
        expect(Boolean(error)).to.be.true;
        const message = await page.evaluate((element) => element.innerText, error);
        expect(message).to.equal('Invalid Attribute: "params.subsystemId" must be a number');
    });

    it('notifies if a specified subsystem id is not found', async () => {
        // Navigate to a subsystem detail view with an id that cannot exist
        await page.goto(`${url}/?page=subsystem&id=999`);
        await page.waitFor(100);

        // We expect there to be an error message
        const error = await page.$('.alert');
        expect(Boolean(error)).to.be.true;
        const message = await page.evaluate((element) => element.innerText, error);
        expect(message).to.equal('Subsystem with this id (999) could not be found:');
    });
};