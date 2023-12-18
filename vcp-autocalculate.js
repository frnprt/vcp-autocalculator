// ==UserScript==
// @name        vcp-autocalculate
// @namespace   https://github.com/frnprt/vcp-autocalculator
// @description Automatically computes monthly gains from VCP site
// @match       http://www.principatumpapiae.com/scheda_euro.php
// @version     0.6
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

    // Parses the information for a given month and return a JS object (namely, a table) with all the data;
    // @param month_number: the position of the month in the list of currently displayed months (i.e. 1,2,3 etc.), starting from 0;
    // example: if December 2023 and November 2023 are displayed in this order in "scheda_euro.php", December 2023 would be 0 and November 2023 would be 1.
    function parse_month(month_number){
        // Create a JSON object from the table of the financial movements of the month
        // Month number is increased by 1 to take in account the off-by-one enumeration of money movements tables in the HTML code
        var table = $(`#movimenti_${parseInt(month_number) + 1}`).tableToJSON({
            headings: ['', 'data_operazione', 'entrate', 'uscite', 'erogante', 'beneficiario'],
            ignoreHiddenRows: false
        });
        // Delete even entries to cleanup spurious rows whose fields are filled with action descriptors (e.g. "Giustizia-Trasferimento")
        var elements_to_delete = [...Array(table.length).keys()].filter(element => element % 2 == 0);
        _.pullAt(table, elements_to_delete)

        return table;
    }

    // Compute the net money for a given month;
    // @param month_number: the JS object containing all the month info, as returned by parse_month.
    function compute_net_for_month(month_info){
        // Compute the total sum of the movements
        var sum = 0;
        month_info.forEach(element => {
            if (element.entrate) {
                sum += parseFloat(element.entrate);
            } else {
                sum += parseFloat(element.uscite);
            }
        });
        return sum.toFixed(2);
    }

    // RENDER UI ELEMENTS:
    // Get the months' headers elements
    const months = document.querySelectorAll("tr[id^=header_mesi]");
    console.log(months);
    // Build a map that associates every month displayed with the same digit key used in the other DOM tables
    const months_map = new Map();
    months.forEach(element => {
        // Let's not make this dirty with 5 lines of JS regexp generator;
        // KISS; change at your leisure.
        months_map.set(element.id.trim().replace(/^\D+/g, ''), element.innerText.trim());
    });
    console.log(months);
    console.log(months_map);
    // Create new DOM elements
    const month_selector = document.createElement("month_selector");
    var month_selector_html = `<select name="months" id="months" class="textfield-scuro">`;
    for (const [key, value] of months_map) {
        month_selector_html += `<option value="${key}">${value}</option>`;
    };
    month_selector_html += "</select>";
    month_selector.innerHTML = month_selector_html;

    const sum_display = document.createElement("sum_display");
    sum_display.innerHTML = "<div class=\"big\">Seleziona un mese di cui vuoi vedere il netto:<div>";
    document.body.appendChild(sum_display);
    document.body.appendChild(month_selector);

    month_selector.addEventListener("change", (event) => {
        sum_display.firstChild.textContent = compute_net_for_month(parse_month(event.target.value));
    });
})();