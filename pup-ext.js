'use strict'
var mkdirp = require('mkdirp')
const uuidv4 = require('uuid/v4')
var fs = require('fs')
var path = require('path')
const fileType = require('file-type');

const jssource_html2css = fs.readFileSync(__dirname + '/htmlelement_to_css.js', 'utf8')

var getStack = function () {
    return new Error().stack.split('\n').splice(2);
}

var escapeRegExp = function (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

var Main, gvars

// function to encode file data to base64 encoded string
function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file)
    var contenttype = fileType(bitmap)
    // convert binary data to base64 encoded string
    var base64str = new Buffer(bitmap).toString('base64')
    var stats = fs.statSync(file)
    return { base64str: base64str, contenttype: contenttype, stats: stats }
}

// function to create file from base64 encoded string
function base64_decode(base64str, file) {
    // create buffer object from base64 encoded string, it is important to tell the constructor that the string is base64 encoded
    var bitmap = new Buffer(base64str, 'base64');
    // write buffer to file
    fs.writeFileSync(file, bitmap);
    console.log('******** File created from base64 encoded string ********');
}

class PupExt {

    static register(page, mainclass) {
        page.__proto__.screenshotLog = PupExt.screenshotLog
        page.__proto__.waitAndClick = PupExt.waitAndClick
        page.__proto__.clickAndWait = PupExt.clickAndWait
        page.__proto__.getSelector = PupExt.getSelector
        page.__proto__.getSelectorByInnerText = PupExt.getSelectorByInnerText
        page.__proto__.waitForDocumentReady = PupExt.waitForDocumentReady
        page.__proto__.waitforfnvalue = PupExt.waitforfnvalue
        page.__proto__.extractDataFromTable = PupExt.extractDataFromTable
        page.__proto__.findTableItem = PupExt.findTableItem
        page.__proto__.waitForText = PupExt.waitForText
        page.__proto__.getText = PupExt.getText
        page.__proto__.click = PupExt.click
        page.__proto__.setSelectByText = PupExt.setSelectByText
        page.__proto__.setSelectByTextAndWait = PupExt.setSelectByTextAndWait
        page.__proto__.getSelectorFromLabel = PupExt.getSelectorFromLabel
        page.__proto__.getSelectorFromLabelAll = PupExt.getSelectorFromLabelAll
        page.__proto__.setChosenSelect = PupExt.setChosenSelect
        page.__proto__.setChosenSelectAndWait = PupExt.setChosenSelectAndWait
        page.__proto__.setChosenSelectByLabel = PupExt.setChosenSelectByLabel
        page.__proto__.setChosenSelectByLabelAndWait = PupExt.setChosenSelectByLabelAndWait
        page.__proto__.realClick = PupExt.realClick
        page.__proto__.setDateJqueryField = PupExt.setDateJqueryField
        page.__proto__.setDateJqueryFieldByLabel = PupExt.setDateJqueryFieldByLabel
        page.__proto__.setTextByLabel = PupExt.setTextByLabel
        page.__proto__.scrollIntoView = PupExt.scrollIntoView
        page.__proto__.dropzoneUploadFileData = PupExt.dropzoneUploadFileData
        page.__proto__.dropzoneUploadFilePath = PupExt.dropzoneUploadFilePath
        page.__proto__.downloadFile = PupExt.downloadFile
        page.__proto__.uploadFile = PupExt.uploadFile

        page.__proto__.escapeRegExp = PupExt.escapeRegExp

        page.__proto__.old_type = page.__proto__.type
        page.__proto__.type = PupExt.type
        page.__proto__.sleep = PupExt.sleep
        page.__proto__.getTempFolder = PupExt.getTempFolder

        Main = mainclass
        gvars = Main.gvars
    }

    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    static async uploadFile(selector, filename) {
        //const filePath = path.relative(process.cwd(), __dirname + '/assets/file-to-upload.txt');
        const filePath = filename
        const input = await page.$(selector);
        await input.uploadFile(filePath);
    }

    static async downloadFile(sel, filename) {
        let nightmare = this
        let path = Main.logpath + 'files/' + uuidv4() + '/'
        mkdirp.sync(path)
        //await nightmare.download(path + filename);
        const res = await this.evaluate((sel) => {
            function arrayBufferToBase64(buffer) {
                //debugger
                var binary = '';
                var bytes = [].slice.call(new Uint8Array(buffer));

                bytes.forEach((b) => binary += String.fromCharCode(b));

                return window.btoa(binary);
            };
            //debugger
            //console.log('sel', sel);            
            var url = window.origin + document.querySelector(sel).href
            return fetch(url, {
                method: 'GET',
                credentials: 'include'
            }).then(r => {
                //debugger
                return r.arrayBuffer()
                //return r.tostring()
            }).then(response => arrayBufferToBase64(response))
        }, sel)
        fs.writeFileSync(path + filename, res, 'base64')

        return path + filename
    }

    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async type(selector, value) {
        await this.old_type(selector, value ? value.toString() : '')
    }

    static async setTextByLabel(caption, value) {
        let selector = await page.getSelectorFromLabel(caption)
        await page.type(selector, value)
    }

    static async setDateJqueryField(selector, value) {
        await this.evaluate((selector, value) => document.querySelector(selector).value = value, selector, value)
    }

    static async setDateJqueryFieldByLabel(caption, value) {
        let selector = await this.getSelectorFromLabel(caption)
        await this.setDateJqueryField(selector, value)
    }

    static async getSelectorFromLabel(labeltext, type, startselector, forcedebug) {
        let res = await this.getSelectorFromLabelAll(labeltext, type, startselector, forcedebug)
        if (res.length == 1) {
            return res[0]
        }
    }

    static async getSelectorFromLabelAll(labeltext, type, startselector, forcedebug) {
        let result
        let labeltextEscaped = escapeRegExp(labeltext)
        //TODO: ne csak chosen selecthez mukodjon
        result = await this.evaluate((labeltextEscaped, type, startselector, forcedebug) => {
            if (forcedebug) {
                console.log(labeltextEscaped)
                debugger
            }
            let selector = startselector ? startselector + ' label' : 'label'
            let label = [...document.querySelectorAll(selector)].filter(item => item.innerText.search(new RegExp(labeltextEscaped)) != -1)
            let elems = []
            /*switch (type) {
                case 'chosen':
                    elem = label.parentElement.children[1].firstChild.firstChild.children[1]
                    break
                default:
                    elem = label.parentElement.children[1].firstChild
            }*/

            //if label is array, then result will also be an array
            for (let item of label) {
                let elem
                elem = item.parentElement.children[1].firstChild
                if (!elem.getAttribute('id')) {

                    elem = item.parentElement.children[1].firstChild.firstChild.children[1]
                } else {

                }
                elems.push('#' + elem.getAttribute('id'))
            }

            return elems

        }, labeltextEscaped, type, startselector, forcedebug)

        //if (result) result = '#' + result

        return result
    }

    /*static async getSelectorFromLabelAll(labeltext, type, startselector, forcedebug) {
        let result
        let labeltextRegExp
        //let labelparamtype = Object.prototype.toString.call(labeltext).slice(8,-1)
        let labelparamtype = 'RegExp'
        if (labelparamtype == 'RegExp') {
            labeltextRegExp = escapeRegExp(labeltext)
        } 
        //TODO: works not only with chosen select
        result = await this.evaluate((labeltext, labeltextRegExp, type, startselector, forcedebug) => {
            if (forcedebug) {
                console.log(labeltextRegExp)
                debugger
            }
            let selector = startselector ? startselector + ' label' : 'label'
            let label
            
            if (labeltextRegExp) {
                label = [...document.querySelectorAll(selector)].filter(item => item.innerText.search(new RegExp(labeltextRegExp)) != -1)
            } else {
                label = [...document.querySelectorAll(selector)].filter(item => item.innerText == labeltext)
            }
            let elems = []

            //if label is array, then result will also be an array
            for (let item of label) {
                let elem
                elem = item.parentElement.children[1].firstChild
                if (!elem.getAttribute('id')) {

                    elem = item.parentElement.children[1].firstChild.firstChild.children[1]
                } else {

                }
                elems.push('#' + elem.getAttribute('id'))
            }

            return elems

        }, labeltext, labeltextRegExp, type, startselector, forcedebug)

        //if (result) result = '#' + result

        return result
    }*/

    static async setSelectByText(selector, value) {
        let fullselector = await this.getSelectorByInnerText(selector + ' option', value)
        let realvalue = await this.evaluate((selector) => document.querySelector(selector).getAttribute('value'), fullselector)
        try {
            await this.select(selector, realvalue)
        } catch (e) {
            //debugger
        }
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async scrollIntoView(selector) {
        await this.evaluate((selector) => {
            let el = document.querySelector(selector)
            el.scrollIntoView()
        }, selector)
    }

    static async realClick(selector) {
        //get the coordinates
        await this.scrollIntoView(selector)
        let obj = await this.evaluate((selector) => {
            var { x, y } = document.querySelector(selector).getClientRects()[0]
            return [x, y]
        }, selector)
        let mouse = this.mouse
        mouse.move(obj[0] + 1, obj[1] + 1)
        mouse.down()
        await PupExt.sleep(1)
        mouse.up()
        //simulate click
    }

    static async setChosenSelectByLabelAndWait(caption, value) {
        const navigationPromise = page.waitForNavigation();
        await page.setChosenSelectByLabel(caption, value); // Clicking the link will indirectly cause a navigation
        try {
            await navigationPromise; // The navigationPromise resolves after navigation has finished
        } catch (e) {
            debugger
        }
    }

    static async setChosenSelectByLabel(caption, value) {
        let selector = await page.getSelectorFromLabel(caption)
        await this.focus(selector)
        await this.realClick(selector)
        await this.type(selector, value)
        let fullselector = await this.getSelectorByInnerText(selector + ' li', value)
        await this.realClick(fullselector)
    }

    static async setChosenSelect(selector, value) {
        await this.realClick(selector)
        await this.type(selector, value)
        let fullselector = await this.getSelectorByInnerText(selector + ' li', value)
        await this.realClick(fullselector)
    }

    static async setChosenSelectAndWait(selector, value) {
        const navigationPromise = page.waitForNavigation();
        await page.setChosenSelect(selector, value); // Clicking the link will indirectly cause a navigation
        try {
            await navigationPromise; // The navigationPromise resolves after navigation has finished
        } catch (e) {
            debugger
        }
    }

    static async setSelectByTextAndWait(selector, value) {
        const navigationPromise = page.waitForNavigation();
        await page.setSelectByText(selector, value); // Clicking the link will indirectly cause a navigation
        try {
            await navigationPromise; // The navigationPromise resolves after navigation has finished
        } catch (e) {
            debugger
        }
    }

    static async click(selector) {
        try {
            await this.scrollIntoView(selector)
        }
        catch (e) {
            //if (e.message != 'Execution context was destroyed, most likely because of a navigation.') throw e
        }
        try {
            await this.evaluate(selector => document.querySelector(selector).click(), selector)
        } catch (e) {
            if (e.message != 'Execution context was destroyed, most likely because of a navigation.') throw e
        }
    }

    static async getText(selector) {
        let result
        result = await this.evaluate((selector) => document.querySelector(selector).innerText || document.querySelector(selector).value || document.querySelector(selector).getAttribute('value'), selector)
        return result
    }

    static async waitForText(selector, text) {
        await this.waitFor(selector).catch((e) => {
            console.error('e', e);
            throw e
            //return
        })
        let args = {}
        args.selector = selector
        //await this.waitforfnvalue((args) => document.querySelector(args.selector).innerText, text, 4000, args)
        await this.waitForFunction((args, text) => document.querySelector(args.selector).innerText == text, {}, args, text)
    }

    static async findTableItem(tableselector, nextbuttonselector, endoflistfn, filterfn, forcedebug) {
        let result
        do {
            let res = await this.extractDataFromTable(tableselector, forcedebug)

            if ((!res && DEBUGMODE) || forcedebug) {
                debugger
                res = await this.extractDataFromTable(tableselector, true)
                debugger
            }
            //look if the record is here
            res = res.filter(filterfn)

            //ha nincs eredmeny akkor tovabba lepenunk
            if (res.length == 0) {
                let darab = await this.evaluate(endoflistfn)
                //let jssource = endoflistfn.toString()
                /*let darab = await this.evaluate((jssource) => {
                    debugger
                    return eval(jssource)()
                }, jssource)*/
                if (darab != -1) {
                    console.error('darab: ', darab, 'filterfn', filterfn.toString())
                    throw new Error('item not found')
                }
                await this.click(nextbuttonselector)
            } else {
                result = res
                break
            }
        } while (true)
        if (!result) debugger
        return result
    }

    static async extractDataFromTable(selector, forcedebug) {
        //parsetable betoltese
        let jssourceparse = fs.readFileSync(__dirname + '/parsetable.js', 'utf8')
        let jssourcecssconvert = fs.readFileSync(__dirname + '/htmlelement_to_css.js', 'utf8')
        let res = await this.evaluate((selector, jssourceparse, jssourcecssconvert, forcedebug) => {
            if (forcedebug) debugger
            let table = document.querySelector(selector)
            let result
            if (table) {
                eval(jssourceparse)
                eval(jssourcecssconvert).call(this)
                result = parseTable(table)
            }
            return JSON.stringify(result, 2, 2)
        }, selector, jssourceparse, jssourcecssconvert, forcedebug)
        return JSON.parse(res)
    }

    static async dropzoneUploadFilePath(selector, filepath, contenttype, filesize, forcedebug) {
        let res = base64_encode(filepath)
        let lcontenttype = contenttype || res.contenttype
        let lfilesize = filesize || res.stats.size
        var basename = path.basename(filepath)
        await this.dropzoneUploadFileData(selector, res.base64str, lcontenttype, lfilesize, basename, forcedebug)
    }

    static async dropzoneUploadFileData(selector, base64str, contenttype, filesize, name, forcedebug) {
        await this.evaluate(async (selector, base64str, contenttype, filesize, name, forcedebug) => {
            function base64toBlob(b64Data, contentType, sliceSize) {
                contentType = contentType || '';
                sliceSize = sliceSize || 512;

                var byteCharacters = atob(b64Data);
                var byteArrays = [];

                for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                    var slice = byteCharacters.slice(offset, offset + sliceSize);

                    var byteNumbers = new Array(slice.length);
                    for (var i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }

                    var byteArray = new Uint8Array(byteNumbers);

                    byteArrays.push(byteArray);
                }

                var blob = new Blob(byteArrays, { type: contentType });
                return blob;
            }

            function sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            if (forcedebug) {
                debugger
            }

            var completed = false;

            var fileList = base64toBlob(base64str, contenttype)
            fileList.name = name
            fileList.type = contenttype//"image/jpeg"
            fileList.size = filesize//30170
            //fileList.path = "http://mysite/img/imageUploadTestJPG.jpg"
            //fileList.mozFullPath = "http://mysite/img/imageUploadTestJPG.jpg"
            //fileList.accept = "image/jpg,image/gif,image/png,image/jpeg"

            console.log(fileList)

            var myZone = Dropzone.forElement(selector)
            myZone.on("complete", function (file) {
                /*if (this.getUploadingFiles().length === 0 && this.getQueuedFiles().length === 0) {
                    doSomething();
                }*/
                completed = true
            })
            myZone.addFile(fileList)
            while (!completed) {
                await sleep(1000)
            }

        }, selector, base64str, contenttype, filesize, name, forcedebug)
    }

    static async waitforfnvalue(scriptfn, value, timeout, args) {
        //this.options.executionTimeout
        if (!timeout) {
            //TODO: remove constant value from here
            timeout = 30000/* this.options.waitTimeout*/
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        let start = new Date()
        let result;
        let now;
        do {
            await sleep(100)
            try {
                result = await this.evaluate(scriptfn, args)
                //console.log(result)
            } catch (e) {
                //console.error(e)
            }
            if (result == value) {
                //console.log('found it', value)                
                return true

            } else {
                //console.log('not found')
            }
            now = new Date()
        } while ((now - start) < timeout)
        throw 'timeout:' + (now - start) + '<' + timeout
    }

    static async  waitForDocumentReady() {
        try {
            //TODO: get from global parameters
            /*await this.waitforfnvalue(() => document.readyState, 'loading', 4000, 30000)
            await this.waitforfnvalue(() => document.readyState, 'complete', 4000, 3000)*/
            /*await this.waitForFunction(() => document.readyState == 'loading')
            await this.waitForFunction(() => document.readyState == 'complete')*/
            //await this.waitForNavigation();            
            await this.waitForNavigation({ waitUntil: 'load' })
            //await this.waitForNavigation({ waitUntil: 'domcontentloaded' })
            await this.waitForNavigation({ waitUntil: 'networkidle0' })
        } catch (e) {
            //debugger
        }
    }

    static async getSelector(fn, ...args) {
        let funcstr = fn.toString()
        let selectortext = await this.evaluate((funcstr, jssource_html2css, ...args) => {
            if (typeof forcedebug !== 'undefined' && forcedebug) debugger
            let element = eval(funcstr)(...args);
            eval(jssource_html2css).call(this);
            my_selector_generator = new CssSelectorGenerator()
            let result = my_selector_generator.getSelector(element)
            return result
        }, funcstr, jssource_html2css, ...args)
        return selectortext
    }

    static async getSelectorByInnerText(selector, innerText) {
        //let selectortext = await this.getSelector((selector, innerText) => [...document.querySelectorAll(selector)].filter(item => item.innerText.toUpperCase() == innerText.toUpperCase())[0], selector, innerText)
        let selectortext = await this.getSelector((selector, innerText) => [...document.querySelectorAll(selector)].filter(item => item.innerText.toUpperCase().search(new RegExp(innerText.toUpperCase())) != -1)[0], selector, escapeRegExp(innerText))
        return selectortext;
    }

    static async getSelectorByInnerText_(selector, innerText) {
        /* let selectortext = await this.getSelector((selector, innerText) => [...document.querySelectorAll(selector)].filter(item => item.innerText.toUpperCase() == innerText.toUpperCase())[0],
             selector, innerText)*/
        //return selectortext;
        let arr = await this.$$eval(selector, item => item.innerText)
        arr = arr.filter(item => item.innerText.toUpperCase() == innerText.toUpperCase())[0]
        let selectortext = arr[0]
        return selectortext
    }

    //wait until element appers and then click on it
    static async waitAndClick(selector) {
        await this.waitFor(selector)
        await this.click(selector)
    }

    //click on element and wait until page is loaded
    static async clickAndWait(selector, timeout) {
        let navigationPromise
        if (timeout) {
            navigationPromise = page.waitForNavigation(timeout);
        } else {
            navigationPromise = page.waitForNavigation();
        }
        await page.click(selector); // Clicking the link will indirectly cause a navigation
        await navigationPromise; // The navigationPromise resolves after navigation has finished
    }

    static async screenshotLog(basefilename) {
        let page = this
        let stack = getStack()
        let filearr
        if (!basefilename) {
            for (const item of stack) {
                //first element is the filename, second is the line number    
                let arr = item.split('\\').pop().split(':').slice(0, 2)
                //if not this file then probaly is a usecase file
                if (arr[0] != path.basename(__filename)) {
                    filearr = [...arr]
                    break
                }
                if (item.indexOf('<anonymous>') != -1) {
                    break
                }
            }
        }

        if (!filearr && basefilename) {
            filearr = [basefilename, 0]
        }
        //create logfile
        if (filearr) {
            var filename = global.Main.logpath + '/' + filearr.join('.') + '_' + uuidv4() + '.png'
            //await page.screenshot(filename)
            await page.screenshot({ path: filename, fullPage: true });
        }
    }

    static getTempFolder() {
        let path = Main.logpath + 'files/' + uuidv4() + '/'      
        return path      
    }

}

module.exports = PupExt.register