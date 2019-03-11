/**
 * converts array-like object to array
 * @param  collection the object to be converted
 * @return {Array} the converted object
 */
function arrayify(collection) {
    return Array.prototype.slice.call(collection);
}

/**
 * generates factory functions to convert table rows to objects,
 * based on the titles in the table's <thead>
 * @param  {Array[String]} headings the values of the table's <thead>
 * @return {Function}      a function that takes a table row and spits out an object
 */
function factory(headings) {
    my_selector_generator = new CssSelectorGenerator()
    return function (row) {
        return arrayify([...row.cells, { innerText: my_selector_generator.getSelector(row) }]).reduce(function (prev, curr, i) {
            prev[headings[i]] = curr.innerText.trim();
            return prev;
        }, {});
    }
}

/**
 * given a table, generate an array of objects.
 * each object corresponds to a row in the table.
 * each object's key/value pairs correspond to a column's heading and the row's value for that column
 * 
 * @param  {HTMLTableElement} table the table to convert
 * @return {Array[Object]}       array of objects representing each row in the table
 */
function parseTable(table) {    
    var headings = arrayify([...table.tHead.rows[0].cells, { innerText: '__HTMLElement' }]).map(function (heading) {
        return heading.innerText.trim()
    });
    return arrayify(table.tBodies[0].rows).map(factory(headings));
}