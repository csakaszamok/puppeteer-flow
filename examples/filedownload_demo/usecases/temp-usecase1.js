class Temp1 {    

    static async exec(page, gvars, lvars) {
        await page.goto(gvars.url)
        let buttonsel = '#main-col > div > div > p:nth-child(11) > a'        
        let temppath = page.getTempFolder()
        await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: temppath });
        await page.click(buttonsel)        
    }
}

module.exports = Temp1