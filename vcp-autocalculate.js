// ==UserScript==
// @name        vcp-autocalculate
// @namespace   https://github.com/frnprt/vcp-autocalculator
// @description Automatically computes monthly gains from VCP site
// @match       http://www.principatumpapiae.com/scheda_euro.php
// @version     1.0.5.2
// @updateURL   https://raw.githubusercontent.com/frnprt/vcp-autocalculator/main/vcp-autocalculate.js
// @downloadURL https://raw.githubusercontent.com/frnprt/vcp-autocalculator/main/vcp-autocalculate.js
// @author      frnprt
// @grant       none
// @require     https://code.jquery.com/jquery-3.7.1.min.js#sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=
// @require     https://cdn.jsdelivr.net/npm/table-to-json@1.0.0/lib/jquery.tabletojson.min.js#sha256-H8xrCe0tZFi/C2CgxkmiGksqVaxhW0PFcUKZJZo1yNU=
// @require     https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js#sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=
// @require     https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js#sha256-EVZCmhajjLhgTcxlGMGUBtQiYULZCPjt0uNTFEPFTRk=
// ==/UserScript==

(function() {
    'use strict';

    // GLOBAL VARIABLES:
    // Map containing the numbers of the months (namely, digit that is the suffix in their "header_mesi" DOM element) as keys
    // and their common name as value. The same order of the displayed HTML page (top to bottom) is preserved.
    const MONTHS_MAP = initialize_months_map();
    // Substrings to use to identify influences actions;
    // "Strada-" and "Finanza-" have the "-" suffix to differentiate them from the
    // omonimous income from skills.
    const INFLUENCES_DESCRIPTORS = [
        "Trasporti", "Finanza-", "Giustizia", "Polizia", "Occulto",
        "Burocrazia", "Malavita", "Politica", "Media", "Industria",
        "Strada-", "Università", "Alta Società"
    ];
    const PASSIVE_DESCRIPTORS = [
        "Passiva"
    ];

    // 
    /**
     * Parses all the "header_mesi" headers to build a map of months.
     * @returns a map whose keys are the numbers of months as they appear in their "header_mesi" DOM element and whose value is the common name of the month;
     */
    function initialize_months_map(){
        // Get the months' headers elements
        const months = document.querySelectorAll("tr[id^=header_mesi]");
        // Build a map that associates every month displayed with the same digit key used in the other DOM tables
        const months_map = new Map();
        months.forEach(element => {
        // Let's not make this dirty with 5 lines of JS regexp generator;
        // KISS; change at your leisure.
            months_map.set(element.id.trim().replace(/^\D+/g, ''), element.innerText.trim());
        });
        return months_map;
    }

    /**
     * Parses the information for a given month.
     * @param {*} month_number the position of the month in the list of currently displayed months (i.e. 1,2,3 etc.), starting from 0;
     * example: if December 2023 and November 2023 are displayed in this order in "scheda_euro.php", December 2023 would be 0 and November 2023 would be 1.
     * @returns a JS object (namely, a table) with all the data, where every position is a row and every row contains a map representing the values of the cells
     */
    function parse_month(month_number){
        // Create a JSON object from the table of the financial movements of the month
        // Month number is increased by 1 to take in account the off-by-one enumeration of money movements tables in the HTML code
        // example: if December 2023 has an "header_mesi_0" header, its movements table will be marked as "movimenti_1"
        const table = $(`#movimenti_${parseInt(month_number) + 1}`).tableToJSON({
            headings: ['', 'data_operazione', 'entrate', 'uscite', 'erogante', 'beneficiario'],
            ignoreHiddenRows: false
        });
        // Transpose even entries to be a new column of the previous odd entry; 
        // this is done to cleanup spurious rows whose fields are filled with action descriptors (e.g. "Giustizia-Trasferimento")
        // and, at the same time, preserve the information
        const indexes_to_transpose = [...Array(table.length).keys()].filter(element => element % 2 == 0);
        table.forEach((element, index) => {
            // The first row (index = 0) is spurious (contains the original headers parsed from the HTML table, e.g. Data Operazione);
            // we can safely exclude it from this operation.
            if (index > 0 && indexes_to_transpose.includes(index)) {
                table[index - 1].descrizione = element.data_operazione
            }
        });
        // Then delete decriptors-only entries; deletion of row 0 comes for free.
        _.pullAt(table, indexes_to_transpose)

        return table;
    }

    /**
     * Parses the information for all the months currently rendered by the HTML page;
     * Assumes that global variable MONTHS_MAP is correctly initialized through the initialize_months_map() function.
     * @returns an array with the data from all months, where every position is a month and every row contains a representation of the month as returned by
     * parse_month() function, plus an id and its common name.
     */
    function parse_all_months(){
        const months_tables = [];
        MONTHS_MAP.forEach((value, key) => {
            months_tables.push({
                'id': key,
                'month': value,
                'data': parse_month(key)
            });
        });
        return months_tables;
    }

    /**
     * Computes the net money for a given month;
     * @param {*} month_info the JS object containing all the month info, as returned by parse_month().
     * @returns a floating point number that represents the total net money for a given month.
     */
    function compute_net_for_month(month_info){
        // Compute the total sum of the movements
        let sum = 0;
        month_info.forEach(element => {
            if (element.entrate) {
                sum += parseFloat(element.entrate);
            } else {
                sum += parseFloat(element.uscite);
            }
        });
        return sum.toFixed(2);
    }

    /**
     * Computes the net money derived from influences for a given month;
     * @param {*} month_info the JS object containing all the month info, as returned by parse_month().
     * @returns a floating point number that represents the net money derived from influences for a given month.
     */
    function compute_influences_net_for_month(month_info){
        let sum = 0;
        month_info.forEach(element => {
            if (INFLUENCES_DESCRIPTORS.some(descriptor => element.descrizione
                                            .toLowerCase()
                                            .includes(descriptor.toLowerCase())
                                           )
            ){
                if (element.entrate) {
                    sum += parseFloat(element.entrate);
                } else {
                    sum += parseFloat(element.uscite);
                }
            }
        });
        return sum.toFixed(2);
    }

    /**
     * Computes the money derived from passive influences for a given month;
     * @param {*} month_info the JS object containing all the month info, as returned by parse_month().
     * @returns a floating point number that represents the net money derived from influences for a given month.
     */
    function compute_influences_passive_income_for_month(month_info){
        let sum = 0;
        month_info.forEach(element => {
            if (PASSIVE_DESCRIPTORS.some(descriptor => element.descrizione
                                            .toLowerCase()
                                            .includes(descriptor.toLowerCase())
                                           )
            ){
                if (element.entrate) {
                    sum += parseFloat(element.entrate);
                } else {
                    sum += parseFloat(element.uscite);
                }
            }
        });
        return sum.toFixed(2);
    }

    /**
     * Computes an array that contains data based on the selected strategy for every month currently rendered in the HTML page.
     * As it makes use of parse_all_months(), it assumes that global variable MONTHS_MAP is correctly initialized through the initialize_months_map() function.
     * @returns an array where every position is the money data of the months according to the selected strategy, as ordered in the HTML page (from top to bottom).
     */
    function compute_months_money_data(strategy){
        const months_data = parse_all_months();
        const data = [];
        months_data.forEach(element => {
            data.push(strategy(element.data));
        });
        return data;
    }

    // RENDER UI:
    // Create new DOM elements;
    // create a container for the chart.
    const chart_container = document.createElement("sum_display");
    chart_container.style.width = "80%";
    chart_container.style.height = "80%";
    chart_container.style.display = "block";
    chart_container.style.padding = "2%";
    chart_container.style['margin-left'] = "auto";
    chart_container.style['margin-right'] = "auto";
    chart_container.style['margin-top'] = "auto";
    chart_container.style['margin-bottom'] = "auto";
    // Put the container under the reports section:
    const place_the_chart_here = document.body.querySelector("td[align='center'][colspan='5'][valign='bottom'][height='100%']");
    place_the_chart_here.insertBefore(chart_container, place_the_chart_here.firstChild);

    // Initialize echarts chart
    const expenses_chart = echarts.init(chart_container, 'dark');
    window.addEventListener('resize', function() {
        expenses_chart.resize();
    });
    // Computes echarts series
    const echarts_influences_nets = compute_months_money_data(compute_influences_net_for_month);
    const echarts_total_nets = compute_months_money_data(compute_net_for_month);
    const echarts_passive_income = compute_months_money_data(compute_influences_passive_income_for_month);
    const echarts_other_nets = echarts_total_nets.map((value, index) => {
        return (value - echarts_influences_nets[index]).toFixed(2);
    });

    // Build echarts options
    const option = {
        title: {
            text: 'Movimenti di denaro per mese'
        },
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['Entrate influenze in passiva', 'Netto delle influenze', 'Netto altre operazioni', 'Netto totale'],
            bottom: '3%'
        },
        toolbox: {
            show: true,
            feature: {
                dataView: { show: true, readOnly: false },
                magicType: { show: true, type: ['line', 'bar'] },
                restore: { show: true },
                saveAsImage: { show: true }
            }
        },
        calculable: true,
        xAxis: [
            {
                // Yes, reversing arrays is not exactly elegant, but I prefer to deal with it here and not during the data model building process
                // because it would require unnecessarily complicated code to link the HTML enumeration done by the site to the "naturally ordered" one
                // for every operation. Thanks, but no thanks.
                type: 'category',
                data: Array.from(MONTHS_MAP.values()).toReversed()
            }
        ],
        yAxis: [
            {
                type: 'value'
            }
        ],
        series: [
            {
                name: 'Entrate influenze in passiva',
                type: 'bar',
                data: echarts_passive_income.toReversed()
            },
            {
                name: 'Netto delle influenze',
                type: 'bar',
                data: echarts_influences_nets.toReversed()
            },
            {
                name: 'Netto altre operazioni',
                type: 'bar',
                data: echarts_other_nets.toReversed()
            },
            {
                name: 'Netto totale',
                type: 'bar',
                data: echarts_total_nets.toReversed()
            }
        ]
    };
    expenses_chart.setOption(option);
})();