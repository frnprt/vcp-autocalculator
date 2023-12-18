// ==UserScript==
// @name        vcp-autocalculate
// @namespace   https://github.com/frnprt/vcp-autocalculator
// @description Automatically computes monthly gains from VCP site
// @match       http://www.principatumpapiae.com/scheda_euro.php
// @version     0.1
// @updateURL   
// @dowloadURL  
// @author      frnprt
// @grant       none
// @require     https://code.jquery.com/jquery-3.7.1.min.js#sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=
// @require     https://cdn.jsdelivr.net/npm/table-to-json@1.0.0/lib/jquery.tabletojson.min.js#sha256-H8xrCe0tZFi/C2CgxkmiGksqVaxhW0PFcUKZJZo1yNU=
// @require     https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js#sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=
// ==/UserScript==

(function() {
    'use strict';

    // Create a JSON object from the table of the financial movements of the last month
    var table = $('#movimenti_1').tableToJSON({
        headings: ['', 'data_operazione', 'entrate', 'uscite', 'erogante', 'beneficiario'],
        ignoreHiddenRows: false
    });
    // Delete even entries to cleanup spurious rows whose fields are filled with descriptors (e.g. "Giustizia-Trasferimento")
    var elements_to_delete = [...Array(table.length).keys()].filter(element => element % 2 == 0);
    _.pullAt(table, elements_to_delete)

    // Compute the total sum of the movements
    var sum = 0;
    table.forEach(element => {
        if (element.entrate) {
            sum += parseFloat(element.entrate);
        } else {
            sum += parseFloat(element.uscite);
        }
    });
    console.log(table);
    console.log(sum.toFixed(2));
})();