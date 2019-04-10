class Temp1 {    

    static async exec(page, gvars, lvars) {
        console.log(lvars)        
        gvars.global_variable_here1++        
    }
}

module.exports = Temp1