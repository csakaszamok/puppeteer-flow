#!/usr/bin/env node
const readline = require('readline')
//import readline from 'readline'
var colors = require('colors');
var dayjs = require('dayjs')
const uuidv4 = require('uuid/v4')
var crypto = require('crypto')
var fs = require('fs')
var mkdirp = require('mkdirp')
var faker = require('faker')
const { createLogger, format, transports } = require('winston');
var logger
var winston = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

//https://github.com/GoogleChrome/puppeteer/issues/594
process.setMaxListeners(Infinity); // <== Important line

process.setMaxListeners(0);
require('events').EventEmitter.prototype._maxListeners = 100;

//const chalk = require('chalk')
const puppeteer = require('puppeteer')
var pupext = require(__dirname + '/pup-ext')
global.faker = faker
global.logger = logger
process.setMaxListeners(Infinity)

var lasturl
var LOGLEVEL = 1
let count = 1
let replywhenerror = 1
let execcount = 1

var debug = require('debug')('myapp')
const DEBUGMODE = typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '));
var HEADLESSMODE
const DEFAULTTIMEOUT = 120000

const message = (...texts) => {
    if (texts && texts[0] == '') debugger
    console.log(...texts)
}

debug('DEBUG IS ON')

// set single property
var error = colors.red;
error('this is red');

// set theme
colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

if (Function.prototype.name2 === undefined) {
    // Add a custom property to all function values
    // that actually invokes a method to get the value
    Object.defineProperty(Function.prototype, 'name', {
        get: function () {
            return /function ([^(]*)/.exec(this + "")[1];
        }
    });
}

Object.defineProperty(Function.prototype, 'name2', {
    get: function () {
        return /function ([^(]*)/.exec(this + "")[1];
    }
});

/*var __nightmare = Nightmare(
    {
        openDevTools: {
            mode: 'detach'
        },
        waitTimeout: 20000,
        typeInterval: 1,
        width: 1027,
        height: 768,
        show: true,
        webPreferences: {
            preload: path.resolve('preload.js') // USE PATH.RESOLVE FUNCTION
        }
    }
)

var nightmare = traceMethodCalls(__nightmare)
global.nightmare = nightmare*/

function getFormattedTime() {
    var today = new Date();
    var y = today.getFullYear();
    // JavaScript months are 0-based.
    var m = today.getMonth() + 1;
    var d = today.getDate();
    var h = today.getHours();
    var mi = today.getMinutes();
    var s = today.getSeconds();
    return y + "-" + m + "-" + d + "-" + h + "-" + mi + "-" + s;
}

class Main {

    static async exec(connectionfile, workflowstr) {
        global.Main = Main
        Main.workflowjson = null
        Main.workflowjsonhash = null

        //initialize variables
        Main.gvars = require(process.cwd() + '/workflows/' + connectionfile)
        Main.historyUseCases = []
        Main.connectionfile = connectionfile
        Main.workflowstr = workflowstr
        var uuidv4_num = uuidv4()
        Main.workingpath = process.cwd() + '/working/' + connectionfile + '/' + Main.workflowstr + '/' + uuidv4_num + '/'
        Main.logpath = process.cwd() + '/logs/' + connectionfile + '/' + Main.workflowstr + '/' + uuidv4_num + '/'
        message(Main.workingpath);
        message(Main.logpath);
        
        //in development delete logs and working folders
        /*rmDir(Main.workingpath)
        rmDir(Main.logpath)*/

        //create folders
        mkdirp.sync(Main.workingpath)
        mkdirp.sync(Main.logpath)

        //read original workflow
        let currentjsonpath = `working/${connectionfile}/${workflowstr}/current.json`
        Main.workflowjson_origin = require(process.cwd() + `/workflows/${workflowstr}`)
        let s = JSON.stringify(Main.workflowjson_origin)
        Main.workflowjson_origin_hash = crypto.createHash('md5').update(s).digest('hex');

        //if have workflow in executing then contiune...
        if (fs.existsSync(currentjsonpath)) {
            Main.workflowjson = require(process.cwd() + '/' + currentjsonpath)
            //...except it changed hash
            /*if (Main.workflowjson.__HASH__ != Main.workflowjson_origin_hash) {
                Main.workflowjson = null
                //de ekkor toroljuk a futtatast is
                rmDir(Main.workingpath)
                mkdirp.sync(Main.workingpath)
            }*/
        }

        //set logger
        let currentDateTime = () => (new Date()).toLocaleString()
        /*const logger = winston.createLogger({
            transports: [
                new winston.transports.Console()
            ]
        });*/
        logger = createLogger({
            level: 'info',
            format: combine(
                format.timestamp({
                    format: 'YYYY.MM.DD HH:mm:ss'
                }),
                prettyPrint()
            ),
            defaultMeta: { service: 'user-service' },
            transports: [
                //
                // - Write to all logs with level `info` and below to `combined.log` 
                // - Write all logs error (and below) to `error.log`.
                //
                //    new transports.Console({ level: 'info', /*humanReadableUnhandledException: true,*/ colorize: true }),
                //new (transports.Console)({'timestamp':true}),
                new transports.File({ filename: Main.logpath + '/error.log', level: 'error' }),
                new transports.File({ filename: Main.logpath + '/total.log' }),
            ]
        });

        if (LOGLEVEL > 1) {
            logger.add(new winston.transports.Console({ level: 'info', /*humanReadableUnhandledException: true,*/ colorize: true }))
        }

        //
        // If we're not in production then log to the `console` with the format:
        // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
        // 
        //
        // If we're not in production then log to the `console` with the format:
        // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
        // 
        /*if (process.env.NODE_ENV !== 'production') {
            logger.add(new winston.transports.Console({
                format: winston.format.simple()
            }));
        }*/

        //else load the origin
        if (!Main.workflowjson) {
            Main.workflowjson = Main.workflowjson_origin
            Main.workflowjson.__HASH__ = Main.workflowjson_origin_hash
        }

        Main.workflow_total_count = Main.workflowjson.workflow.length

        //logging
        Main.logfilename = 'log' + timeStamp()
        Main.createExecuteLog(Main.workflowjson, workflowstr, new Date())
        //read variables anf merge it
        //Main.gvars = { ...Main.gvars, ...Main.workflowjson }
        Main.gvars = { ...Main.workflowjson, ...Main.gvars }        

        let allstarttime = new Date()
        //execute rowkflows        
        //open a browser
        //await ightmare.goto('about:blank')
        global.browser = await puppeteer.launch({
            headless: HEADLESSMODE,
            devtools: true,
            // args: ['--start-fullscreen'],
            args: [
                '--ignore-certificate-errors',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1920,1080',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--proxy-server="direct://"',
                '--proxy-bypass-list=*'],
            ignoreHTTPSErrors: true,
            /*defaultViewport: {
                width: 1024,
                height: 0
            }*/
        })

        //global.page = await browser.newPage()
        var page = (await browser.pages())[0]

        //https://github.com/GoogleChrome/puppeteer/issues/1981
        page._networkManager.setMaxListeners(100);
        page._frameManager.setMaxListeners(100);

        page.setDefaultNavigationTimeout(DEFAULTTIMEOUT)

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');

        //extend with own methods
        pupext(page, Main)
        global.page = traceMethodCalls(page)
        await global.page.setViewport({
            width: 1024,
            height: 0
        })
        //await global.page.goto('chrome-devtools://devtools/bundled/inspector.html')
        
        //await ightmare.evaluate(() => console.clear())
        await global.page.evaluate(() => console.clear())


        await global.page.evaluate(() => {
            //  window.onbeforeunload = null/*function () { return "Are you sure you want to leave this page?"; };*/
        });
        global.page.on('dialog', async dialog => {
            //debugger
            //await dialog.dismiss();
        });

        //if user click on rerun, we re-run usecase
        await page.exposeFunction('puppeteer_flow_rerun', async usecasename => {
            //run usecase
            //await Main.executeUseCase(usecasename)            
            replywhenerror++
            throw new Error('rerun')
        })

        /*page.removeAllListeners('pageerror');
        page.on('pageerror', errorstring => {
            debugger
            reject(new Error(errorstring));
        });*/

        page.removeAllListeners('error');
        page.on('error', error => {
            debugger
            debug(`Chrome Handler: GENERAL ERROR on: ${targetURL} : ${error}`);
            debug(`GLOBAL CHROMEPOOL count after releasing instance on ERROR: ${global.chromepool.borrowed} for: ${targetURL}`);
            global.chromepool.release(browser);
        });        
        
        while (Main.workflowjson.workflow.length > 0) {
            //for (var item of Main.workflowjson.workflow) {
            //always get 0. item 
            let item = Main.workflowjson.workflow[0]
            try {
                await Main.executeWithPrerequisites(item)
            } catch (e) {
                console.error(e.message)
                process.exit(1)
            }
        }

        //await nightmare.end()

        //if everthing ok then delete current workflow execute
        rmDir(Main.workingpath)

        let allendtime = new Date() - allstarttime
        message('*******************************************************************')
        message('total execution time:', allendtime, 'ms')
        message('*******************************************************************')
        //debugger
        Main.flushExecutedUsecases();
        Flow.end(0)
        //process.exit(0)
    }

    static createExecuteLog(workflowobj) {
        fs.writeFileSync(Main.workingpath + 'current.json', JSON.stringify(workflowobj, 2, 2) + '\n', 'utf8')
        fs.writeFileSync(Main.logpath + Main.logfilename + '.json', JSON.stringify(workflowobj, 2, 2) + '\n', 'utf8')
    }

    static addExecuteLog(usecaseobj, duration) {
        let item = getFormattedTime() + ',' + Main.connectionfile + ',' + Main.workflowstr + ',' + `LOG-${(new Date()).toLocaleString()} ${usecaseobj} is called. Duration: ${duration} ms.`
        fs.appendFileSync(Main.logpath + Main.logfilename + '.log', item + '\n', 'utf8')
    }

    static flushExecutedUsecases() {
        for (let item of Main.historyUseCases) {
            let text = getFormattedTime() + ',' + Main.connectionfile + ',' + Main.workflowstr + ',' + item
            fs.appendFileSync(Main.logpath + Main.logfilename + '.exec', text + '\n', 'utf8')
        }
    }

    static getPrerequisite(item) {
        //ha string akkor siman beolvassuk
        if (typeof item == 'string') {
            return require(process.cwd() + `/usecases/${item}`).prerequisite()
        } else
        //ha viszont json, akkor a name alapjan
        {
            return require(process.cwd() + `/usecases/${item.name}`).prerequisite()
        }
    }

    static async executeWithPrerequisites(usecase) {
      
        //ha vannak elofeltetelek ES meg nem futottak le akkor azokat lefuttatjuk
        let prerequisite = Main.getPrerequisite(usecase)// require(`/usecases/${item}`).prerequisite()
        /*if (prerequisite.length == 0 && DEBUGMODE) {
            debugger
        }*/
        for (let preitem of prerequisite) {
            //ha tombrol van szo akkor barmelyik talalat jo nekunk, ill. ha nincs egyse akkor csak az elsot futtatjuk mivel altalaban az elso a 'modosit' a masodik a 'new'
            if (Array.isArray(preitem)) {
                let found = false
                for (let presubitem of preitem) {
                    if (Main.historyUseCases.indexOf(presubitem.toLowerCase()) != -1) {
                        found = true
                    }
                }
                //ha nincs talalt akkor lefuttatjuk az elsot
                if (!found) {
                    //await Main.executeUseCase(preitem[0])                   
                    await Main.executeWithPrerequisites(preitem[0])
                }
            }
            //ha meg nem futtattuk le akkor lefuttatjuk
            else if (Main.historyUseCases.indexOf(preitem.toLowerCase()) == -1) {
                await Main.executeWithPrerequisites(preitem)
                //await Main.executeUseCase(preitem)
            }
        }

        //lefuttatjuk a usecase-t               
        await Main.executeUseCase(usecase)
    }

    static appendToLog(usecasename, usecaselvars) {
        let jsonall
        try {
            jsonall = { ...Main.workflowjson, ...Main.gvars }
            jsonall.workflowlog = jsonall.workflowlog || {}
            jsonall.workflowlog[usecasename] = usecaselvars
            Main.workflowjson = jsonall
            Main.createExecuteLog(jsonall)
        } catch (e) {
            debugger
            console.error('e', e);
        }
    }

    /** Leffutat egy usecase 
     * @param  {String | Object} usecase
     * @param  {Array} extrausecaselvars
     */
    static async executeUseCase(usecase) {
        let starttime = new Date()
        let extrausecaselvars
        /* if (typeof usecase == 'object') {
             extrausecaselvars = usecase.variables
         }*/
        let usecaseobj;
        let usecasename;
        let usecaselvars = { ...extrausecaselvars }
        //ha string akkor siman beolvassuk
        if (typeof usecase == 'string') {
            usecaseobj = require(process.cwd() + `/usecases/${usecase}`)
            usecasename = usecase
        } else
        //ha viszont json, akkor a name alapjan
        {
            usecaseobj = require(process.cwd() + `/usecases/${usecase.name}`)
            usecasename = usecase.name
            if (usecase.hasOwnProperty('variables')) {
                //ha tombrol van szo akkor trukkos, mert annyiszor kell meghivnunk a funkciot ahany eleme van a tombnek
                if (Array.isArray(usecaselvars) && !usecase.hasOwnProperty('count')) {
                    //ha tomb es nincs szabalyozva count-al
                    if (Array.isArray(usecaselvars) && !usecase.hasOwnProperty('count')) {
                        for (let i of usecaselvars) {
                            await Main.executeUseCase(usecasename, usecaselvars[i])
                        }
                    }
                    //ha csak count van
                    else if (usecase.hasOwnProperty('count') && !Array.isArray(usecaselvars)) {
                        for (let a = 0; a < usecase.count; a++) {
                            await Main.executeUseCase(usecasename, usecase.variables)
                        }
                    }
                    //ha count es array is van
                    else if (Array.isArray(usecaselvars) && !usecase.hasOwnProperty('count')) {
                        for (let a = 0; a < usecase.count; a++) {
                            for (let i of usecaselvars) {
                                await Main.executeUseCase(usecasename, usecaselvars[i])
                            }
                        }
                    }
                    return
                } else
                //ha csak sima json akkor csak meghivjuk a funckiot
                {
                    usecaselvars = usecase.variables
                }

            }
        }

        //ha van getVariables fuggveny, akkor azokat is hozzatessuk a local varshoz
        if (typeof usecaseobj.getVariables === 'function') {
            usecaselvars = { ...usecaseobj.getVariables(page), ...usecaselvars }
        }
        //console.log(`usecase: ${usecase}\r`);   
        let err
        let endtime

        for (var a = 0; a < replywhenerror; a++) {

            let eddigi_lefutott = Main.workflow_total_count - Main.workflowjson.workflow.length + 1
            let szazalek = Math.ceil(eddigi_lefutott / Main.workflow_total_count * 100)

            //console.log('>>> PROGRESS: ' + eddigi_lefutott + '/' + Main.workflow_total_count + ' ' + szazalek + '% >>> EXECCOUNT:', execcount, '/', count, '>>> USECASEREPLYCOUNT:', a, '/', replywhenerror, LOGLEVEL > 0 ? usecasename : '')
            let l_progress = 'P: ' + colors.bgBlue(eddigi_lefutott) + '/' + colors.bgBlue(Main.workflow_total_count) + ' ' + colors.bgBlue(szazalek) + '%'
            let l_execcount = 'EC:' + colors.bgBlue(execcount) + '/' + colors.bgBlue(count)
            let l_usecasereplycount = 'UC:' + colors.bgBlue(a + 1) + '/' + colors.bgBlue(replywhenerror)
            let l_conn = colors.cyan(Main.connectionfile)
            let l_workflow = colors.cyan(Main.workflowstr)
            let l_usecasename = LOGLEVEL > 0 ? colors.yellow(usecasename) : ''
            //console.log(l_conn, l_workflow, l_usecasename, l_progress, count > 1 ? l_execcount : '')
            //            process.stdout.write(l_conn, l_workflow, l_usecasename, count > 1 ? l_execcount : '')
            let executemsg = `${l_conn} ${l_workflow} ${l_usecasename}..`
            process.stdout.write(executemsg)
            var timer1 = setInterval(() => {
                if (endtime) {
                    clearInterval(timer1)
                    return
                }
                process.stdout.write('.')
            }, 1000);

            try {

                //lelogoljuk hogy mit fogunk futtatni
                //await nightmare.evaluate((usecasename) => console.group(usecasename), usecasename)
                await global.page.evaluate((usecasename) => console.group(usecasename), usecasename)
                logger.info({
                    'msg': 'START_OF_USECASE',
                    'duration (ms)': 0,
                    connection: Main.connectionfile,
                    workflow: Main.workflowstr,
                    usecase: usecase
                })

                usecaselvars.__START__ = new Date()
                Main.appendToLog(usecasename, usecaselvars)

                //ha van beofre esemeny akkor meghivjuk
                if (usecaseobj.execBefore) {
                    await usecaseobj.execBefore(global.page, Main.gvars, usecaselvars)
                    //console.log(usecasename + '.before is called')
                }

                //lekerjuk az url-t

                /*await global.page.on('response', async response =>{
                    debugger
                    url = await response.url()
                } )*/

                await global.page.on('load', async data => {
                    let url = await global.page.url()
                    if (url && lasturl != url) {
                        logger.info({ 'msg': 'IN_PROGRESS', url: url })
                        lasturl = url
                    }
                })

                //csinálunk róla egy screenshotot
                await page.screenshotLog(usecasename + '.before')

                //insert toast
                let temp_progress_str = eddigi_lefutott + '/' + Main.workflow_total_count + ' ' + szazalek + '%'
                await Flow.inject_toast(Main.connectionfile, Main.workflowstr, usecasename, temp_progress_str)
                await page.on('load', async () => {
                    await Flow.inject_toast(Main.connectionfile, Main.workflowstr, usecasename, temp_progress_str)
                })
                

                //******************************************************************************************** */
                //******************************************************************************************** */
                //******************************************************************************************** */
                //futtatjuk a usecase-t
                await usecaseobj.exec(page, Main.gvars, usecaselvars)
                //******************************************************************************************** */
                //******************************************************************************************** */
                //******************************************************************************************** */
                
                //Ha ujrainditas kerelem van akkor itt gyorsna dobunk egy hibat               
                /*  if (DEBUGMODE || await page.evaluate('window.puppeteer_flow_rerun_variable')) {
                      replywhenerror++
                      throw new Error('rerun')
                  }*/


                //megmerjuk mennyi ideig futott
                endtime = new Date()

                //csinálunk róla egy screenshotot
                await page.screenshotLog(usecasename + '.after')

                //process.stdout.clearLine();  // clear current text
                //readline.clearLine(process.stdout)
                //process.stdout.cursorTo(0);
                //readline.cursorTo(process.stdout, 0)

                message(l_conn, l_workflow, l_usecasename, l_progress, count > 1 ? l_execcount : '')
                

                //ha van after akkor meghivjuk
                if (usecaseobj.execAfter) {
                    await usecaseobj.execAfter(page, Main.gvars, usecaselvars)
                    //console.log(usecasename + '.after is called')
                }

                //ha sikeresen lefutott akkor kivesszuk a lefuttatando worklfow listabol
                let index = Main.workflowjson.workflow.indexOf(usecasename)
                //ha nincs talalat azert megnezzuk, hogy nem-e json-os mert akkor a name alapjan kell
                if (index == -1) {
                    for (let a in Main.workflowjson.workflow) {
                        if (Main.workflowjson.workflow[a].name && Main.workflowjson.workflow[a].name == usecasename) {
                            index = a
                            break
                        }
                    }
                }

                if (index != -1) {
                    Main.workflowjson.workflow.splice(index, 1)
                }
                //a fizikai tolres helyett csak nullra rakjuk
                //delete Main.workflowjson.workflow[index]


                usecaselvars.__DONE__ = endtime
                usecaselvars.__DONE_MS__ = endtime - starttime
                Main.appendToLog(usecasename, usecaselvars)
                await page.evaluate((usecasename) => console.groupEnd(usecasename), usecasename)
                
            } catch (e) {
                //console.error(e)                
                logger.error({ 'duration (ms)': '', connection: Main.connectionfile, workflow: Main.workflowstr, usecase: usecasename, message: e.message, })
                usecaselvars.__ERROR__ = e.code + ' ' + e.message
                Main.appendToLog(usecasename, usecaselvars)
                try {
                    Main.addUseCasesToHistory(usecasename, starttime, endtime, e)
                } catch (e) {
                    // debugger
                }
                if (!DEBUGMODE && a + 1 == replywhenerror) {
                    throw e
                    //process.exit(-1)
                    Flow.end(-1)
                } else {
                    throw e
                    //continue
                }
            }
            break
        }

        debug('usecasename')
        Main.addUseCasesToHistory(usecasename, starttime, endtime, err)
    }

    static addUseCasesToHistory(usecase, starttime, endtime, err) {
        Main.historyUseCases.push(usecase.toLowerCase())
        let duration = endtime - starttime;
        if (!err) {
            //console.log(getFormattedTime() + ',' + Main.connectionfile + ',' + Main.workflowstr + ',' + `usescase is called: ${usecase} time: ${duration} ms`)
            logger.info({
                'msg': 'END_OF_USECASE',
                'duration (ms)': duration,
                connection: Main.connectionfile,
                workflow: Main.workflowstr,
                usecase: usecase
            })
            //console.log('*******************************************************************')
            Main.addExecuteLog(usecase, duration)
        } else {
            console.error(`usecase is FAILED: ${usecase} time: ${endtime - starttime} ms`)
            throw err
        }
        //console.log(`..is called, time: ${endtime - starttime} ms`)
    }
}

rmDir = function (dirPath) {
    try { var files = fs.readdirSync(dirPath); }
    catch (e) { return; }
    if (files.length > 0)
        for (var i = 0; i < files.length; i++) {
            var filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile())
                fs.unlinkSync(filePath);
            else
                rmDir(filePath);
        }
    fs.rmdirSync(dirPath);
};

Object.defineProperty(global, '__stack', {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__line', {
    get: function () {
        return __stack[1].getLineNumber();
    }
});

Object.defineProperty(global, '__function', {
    get: function () {
        return __stack[1].getFunctionName();
    }
});




var originobj

function traceMethodCalls(obj) {
    //originobj = obj

    /* function getMethods(obj) {
         var res = [];
         for (var m in obj) {
             if (typeof obj[m] == "function") {
                 res.push(m)
             }
         }
         return res;
     }
 
     function cloneMethods(obj, target) {
         var res = [];
         for (var m in obj) {
             if (typeof obj[m] == "function") {
                 res.push(m)
                 target[m] = obj[m]
             }
         }
         return res;
     }
 
     var clone = function (origin, target, prefix) {
         Object.keys(origin).forEach(function (key) {
             if (!target.hasOwnProperty(key)) {
                 if (key.indexOf("function_") > -1) {
                     //target["function_" + prefix] = origin[key];
                     target["function"] = origin[key];
                 }
             }
         });
     }
 
     var cloneobj = {}
     cloneMethods(obj, cloneobj)
 
     obj.on = function on() {
         debugger
         console.log(...arguments)
         obj.action.apply(obj, arguments);
     }
 
     /*let mets = getMethods(obj).sort()
     console.log('mets', mets.sort());
 
     originobj = { action: function () { } }
     originobj[action] = obj[action]
     obj[action] = function action() {
         console.log(...arguments)
         originobj.action.apply(obj, arguments);
     }     
     ;*/

    let handler = {
        get(target, propKey, receiver) {
            const origMethod = target[propKey];
            return function (...args) {
                //console.log('***', origMethod.name2, '***');
                var st = getStack()
                //console.log('st', st);
                if (st[1].indexOf('\\usecases\\') != -1) {
                    let temps = st[1].split('\\').pop().slice(0, -1)
                    message(getFormattedTime() + ',' + Main.connectionfile + ',' + Main.workflowstr + ',' + temps, ',', origMethod.name, ',', 'args:', args.join(','));
                }
                let result = origMethod.apply(obj, args);
                try {
                    /*console.log(propKey + JSON.stringify(args)
                        + ' -> ' + JSON.stringify(result));*/
                } catch (e) {
                    //debugger
                }
                return result;
            };
        }
    };
    return new Proxy(obj, handler);
}

/**
 * Return a timestamp with the format "m/d/yy h:MM:ss TT"
 * @type {Date}
 */

function timeStamp() {
    // Create a date object with the current time
    var now = new Date();

    // Create an array with the current month, day and time
    var date = [now.getMonth() + 1, now.getDate(), now.getFullYear()];

    // Create an array with the current hour, minute and second
    var time = [now.getHours(), now.getMinutes(), now.getSeconds()];

    // Determine AM or PM suffix based on the hour
    //var suffix = (time[0] < 12) ? "AM" : "PM";

    // Convert hour from military time
    time[0] = (time[0] < 12) ? time[0] : time[0] - 12;

    // If hour is 0, set it to 12
    time[0] = time[0] || 12;

    // If seconds and minutes are less than 10, add a zero
    for (var i = 1; i < 3; i++) {
        if (time[i] < 10) {
            time[i] = "0" + time[i];
        }
    }

    // Return the formatted string
    return date.join("") + "_" + time.join("");
}

var getStack = function () {
    return new Error().stack.split('\n').splice(2);
}

var originobj

function traceMethodCalls(obj) {
    //originobj = obj

    /* function getMethods(obj) {
         var res = [];
         for (var m in obj) {
             if (typeof obj[m] == "function") {
                 res.push(m)
             }
         }
         return res;
     }
 
     function cloneMethods(obj, target) {
         var res = [];
         for (var m in obj) {
             if (typeof obj[m] == "function") {
                 res.push(m)
                 target[m] = obj[m]
             }
         }
         return res;
     }
 
     var clone = function (origin, target, prefix) {
         Object.keys(origin).forEach(function (key) {
             if (!target.hasOwnProperty(key)) {
                 if (key.indexOf("function_") > -1) {
                     //target["function_" + prefix] = origin[key];
                     target["function"] = origin[key];
                 }
             }
         });
     }
 
     var cloneobj = {}
     cloneMethods(obj, cloneobj)
 
     obj.on = function on() {
         debugger
     
         obj.action.apply(obj, arguments);
     }
 
     /*let mets = getMethods(obj).sort()
     
 
     originobj = { action: function () { } }
     originobj[action] = obj[action]
     obj[action] = function action() {
         
         originobj.action.apply(obj, arguments);
     }     
*/

    let handler = {
        get(target, propKey, receiver) {
            const origMethod = target[propKey];
            return function (...args) {

                var st = getStack()

                if (st[1].indexOf('\\usecases\\') != -1) {
                    let temps = st[1].split('\\').pop().slice(0, -1)

                }
                let result = origMethod.apply(obj, args);
                try {
                    /*console.log(propKey + JSON.stringify(args)
                        + ' -> ' + JSON.stringify(result));*/
                } catch (e) {
                    //debugger
                }
                return result;
            };
        }
    };
    return new Proxy(obj, handler);
}

class Flow {

    static async start(args) {
        //read the package version
        let pack = require(__dirname + '/package.json')
        message(colors.cyan('Puppeteer flow ') + colors.green(`v${pack.version}`))

        //setTimeout(() => Main.exec(...process.argv.slice(2)), 1)
        //aaa                        
        if (args) process.argv = [...process.argv, ...args]
        process.argv = process.argv.filter((value, index, self) => self.indexOf(value) === index)
        HEADLESSMODE = process.argv.indexOf('--headless') != -1

        Flow.init_params()

        //console.warn('count', count)
        for (var a = 0; a < count; a++) {
            //collect parameter files (exclude commands)
            //let parameterfiles = process.argv.filter(item => item.substr(0, 1) != '-')
            //await Main.exec(parameterfiles)

            await Main.exec(...process.argv.slice(2))

            console.warn('count a', a)
        }
    }

    static end(exitcode) {
        process.exit(exitcode)
    }

    /*static async inject_toast_3(conn, workflow, usecasename, progress) {
        await global.page.addStyleTag({ url: 'https://unpkg.com/react@16/umd/react.production.min.js' })
        await global.page.addScriptTag({ url: 'https://unpkg.com/react-dom@16/umd/react-dom.production.min.js' })
        await global.page.evaluate((conn, workflow, usecasename, progress) => {
            try {
            } catch (e) {
                console.error('inject_toast', e)
            }
        }, conn, workflow, usecasename, progress)
    }*/

    /*static async inject_toast_react(conn, workflow, usecasename, progress) {
        await global.page.addStyleTag({ url: 'https://unpkg.com/react@16/umd/react.production.min.js' })
        await global.page.addScriptTag({ url: 'https://unpkg.com/react-dom@16/umd/react-dom.production.min.js' })
        await global.page.evaluate((conn, workflow, usecasename, progress) => {
            try {
                let func1 = () => {
                    alert("test messasge")
                }

                const Msg = ({ closeToast }) => {
                    React.createElement('div', {},
                        React.createElement('p', {}, 'Lorem ipsum dolor'),
                        React.createElement('br', {}, null),
                        React.createElement('button', { onClick={ retryFunc } }, Retry),
                        React.createElement('button', { onClick={ closeToast } }, Retry),
                    )
                }


            } catch (e) {
                console.error('inject_toast', e)
            }
        }, conn, workflow, usecasename, progress)
    }

*/
    static async inject_toast_toastrjs(conn, workflow, usecasename, progress) {
        await global.page.addStyleTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css' })
        await global.page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js' })
        await global.page.addStyleTag({ url: 'https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' })
        await global.page.addScriptTag({ url: 'https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js' })
        await global.page.evaluate((conn, workflow, usecasename, progress) => {
            window.puppeteer_flow_rerun_variable = false
            try {

                toastr.remove()
                toastr.options.preventDuplicates = true;
                toastr.options.progressBar = true;
                toastr.options.closeButton = true;
                toastr.options.timeOut = 0;
                toastr.options.extendedTimeOut = 0;
                ///https://github.com/CodeSeven/toastr/issues/166
                ///Prevent close Toastr on Click by this code:
                toastr.options.hideMethod = 'noop';

                ///create content for toast 
                var textArr = []
                textArr.push(`conn: ${conn}`)
                textArr.push(`workflow: ${workflow}`)
                textArr.push(`usecase: ${usecasename}`)
                textArr.push(`${progress}`)
                //var textEl = document.createTextNode(textArr.join('<br>'));

                ///create group 
                var group = document.createElement("p");

                ///create a href link
                var ahref = document.createElement("a");
                var ai = document.createElement("i");
                ai.setAttribute('class', 'fa fa-refresh _fa-spin fa-2x')
                ahref.onclick = (e) => {
                    e.preventDefault()
                    clickeventrerun()
                }
                ahref.appendChild(ai);

                //assign to group                    
                for (let item of textArr) {
                    group.appendChild(document.createTextNode(item));
                    group.appendChild(document.createElement("br"))
                }
                group.appendChild(document.createElement("br"))
                group.appendChild(ahref);

                var clickeventrerun = function clickeventrerun() {
                    window.puppeteer_flow_rerun_variable = true
                    puppeteer_flow_rerun('${usecasename}')
                    //document.querySelector('#btnrerun').style.visibility = 'hidden'
                }

                //toastr.oprtions.positionClass = "toast-top-left"
                /*let tempstr = `conn: ${conn}<br>workflow: ${workflow}<br>usecase: ${usecasename}<br>${progress}<br>
                <button id='btnrerun' onclick="clickeventrerun()">
                <img src="https://cdnjs.cloudflare.com/ajax/libs/material-design-icons/3.0.1/navigation/1x_web/ic_refresh_white_24dp.png"/>        
                </button>                
                `*/
                toastr.info(group)
            } catch (e) {
                console.error('Toast error', e)
            }

        }, conn, workflow, usecasename, progress)
    }

    static async inject_toast(conn, workflow, usecasename, progress) {
        await Flow.inject_toast_toastrjs(conn, workflow, usecasename, progress)
    }

    static init_params() {
        //ha van -count=x parameter akkor annyi peldanyban inditjuk

        if (process.argv.join(' ').toLowerCase().indexOf('-count=') != -1) {
            process.argv.forEach((item) => {
                let temparr = item.split('=')
                if (temparr[0] == '-count') {
                    count = parseInt(temparr[1])
                    return
                }
            })
        }

        if (process.argv.join(' ').toLowerCase().indexOf('-replywhenerror=') != -1) {
            process.argv.forEach((item) => {
                let temparr = item.split('=')
                if (temparr[0] == '-replywhenerror') {
                    replywhenerror = parseInt(temparr[1])
                    return
                }
            })
        }

        if (process.argv.join(' ').toLowerCase().indexOf('-loglevel=') != -1) {
            process.argv.forEach((item) => {
                let temparr = item.split('=')
                if (temparr[0] == '-loglevel') {
                    LOGLEVEL = parseInt(temparr[1])
                    return
                }
            })
        }

        //count = 10
        //execcount = 1;
    }
}




//f1()

//const puppeteer = require('puppeteer');
function run(pagesToScrape) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!pagesToScrape) {
                pagesToScrape = 1;
            }
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--proxy-server="direct://"',
                    '--proxy-bypass-list=*'
                ]
            });
            const page = await browser.newPage();

            await page.goto("https://news.ycombinator.com/");
            const response1 = await page.goto('https://prog.hu')
            let currentPage = 1;
            let urls = [];
            while (currentPage <= pagesToScrape) {
                let newUrls = await page.evaluate(() => {
                    let results = [];
                    let items = document.querySelectorAll('a.storylink');
                    items.forEach((item) => {
                        results.push({
                            url: item.getAttribute('href'),
                            text: item.innerText,
                        });
                    });
                    return results;
                });
                urls = urls.concat(newUrls);
                if (currentPage < pagesToScrape) {
                    await Promise.all([
                        await page.click('a.morelink'),
                        await page.waitForSelector('a.storylink')
                    ])
                }
                currentPage++;
            }
            browser.close();
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }
    })
}
//run(5).then(console.log).catch(console.error);

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
    try {
        if (global.browser) global.browser.close();
    } catch (e) {

    }
    message('xxx')
    message('EXITCODE', exitCode)
    messaGE(Main.workingpath)
    message(Main.logpath)
    if (options.cleanup) message('clean');
    if (exitCode || exitCode === 0) message(exitCode);
    if (options.exit) process.exit();
}

//do something when app is closing
//process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
//process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
/*process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));*/

//catches uncaught exceptions
//process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

/*process.on('unhandledRejection', (error, promise, ...args) => {
    // Will print "unhandledRejection err is not defined"    
    //console.error('unhandledRejection', error.message, error.stack, promise);
    if (logger) logger.error({ errorname: 'unhandledRejection', message: error.message, stack: error.stack, promise: promise })
    process.exit(-1)
});*/

module.exports = Flow



