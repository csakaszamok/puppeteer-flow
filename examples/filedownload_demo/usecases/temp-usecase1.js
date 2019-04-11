class Temp1 {

    static async exec(page, gvars, lvars) {
        await page.goto(gvars.url)
        let buttonsel = 'body > div:nth-child(1) > div > div.pagewrap.w740 > div.download > div:nth-child(1) > ul.lst_download > li:nth-child(1) > a'
        await page.downloadTempFolder(buttonsel, 'ico1.ico')
    }
}

module.exports = Temp1