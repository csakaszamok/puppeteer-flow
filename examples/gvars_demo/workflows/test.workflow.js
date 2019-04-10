module.exports = {

    global_variable_here1: 99,

    workflow: [
        {
            name: 'temp-usecase1',
            variables: {
                v1: gvars.global_variable_here1
            }
        },
        {
            name: 'temp-usecase2',
            variables: {
                v2: gvars.global_variable_here1
            }
        }
    ]
}