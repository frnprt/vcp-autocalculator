// ==UserScript==
// @name        vcp-autocalculate
// @namespace   https://github.com/frnprt/vcp-autocalculator
// @description Automatically computes monthly gains from VCP site
// @match       http://www.principatumpapiae.com/scheda_euro.php
// @version     0.9
// @updateURL   https://raw.githubusercontent.com/frnprt/vcp-autocalculator/main/vcp-autocalculate.js
// @dowloadURL  https://raw.githubusercontent.com/frnprt/vcp-autocalculator/main/vcp-autocalculate.js
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
    // Map containing the numbers of the months as they appear in their "header_mesi" DOM element as keys
    // and their common name as value.
    const MONTHS_MAP = initialize_months_map();
    // Substrings to use to identify influences actions:
    const INFLUENCES_DESCRIPTORS = [
        "Trasporti", "Finanza", "Giustizia", "Polizia", "Occulto",
        "Burocrazia", "Malavita", "Politica", "Media"
    ];


    // Returns a map whose keys are the number of months as they appear in their "header_mesi" DOM element and whose value is the common name of the month;
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
        // Transpose even entries to the previous odd entry to cleanup spurious rows whose fields are filled with action descriptors (e.g. "Giustizia-Trasferimento")
        var indexes_to_transpose = [...Array(table.length).keys()].filter(element => element % 2 == 0);
        table.forEach((element, index) => {
            if (index > 0 && indexes_to_transpose.includes(index)) {
                table[index - 1].descrizione = element.data_operazione
            }
        });
        // Then delete decriptors-only entries
        _.pullAt(table, indexes_to_transpose)

        return table;
    }

    // Parses the information for a given array of months and return a JS object (namely, a table) with all the data;
    // @param month_number: an array that contains the positions of the months in the list of currently displayed months (i.e. 1,2,3 etc.), starting from 0;
    // example: if December 2023 and November 2023 are displayed in this order in "scheda_euro.php", December 2023 would be 0 and November 2023 would be 1;
    // so if you need to parse them both, your array would contain [0, 1].
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

    // Compute the net money from influences for a given month;
    // @param month_number: the JS object containing all the month info, as returned by parse_month.
    function compute_influences_net_for_month(month_info){
        var sum = 0;
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

    function compute_echart_influences_nets(){
        const months_data = parse_all_months();
        const influences_nets = [];
        months_data.forEach(element => {
            influences_nets.push(compute_influences_net_for_month(element.data));
        });
        return influences_nets;
    }

    function compute_echart_total_nets(){
        const months_data = parse_all_months();
        const nets = [];
        months_data.forEach(element => {
            nets.push(compute_net_for_month(element.data));
        });
        return nets;
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
    // Put the sum_display container under the reports section:
    const place_the_chart_here = document.body.querySelector("td[align='center'][colspan='5'][valign='bottom'][height='100%']");
    place_the_chart_here.insertBefore(chart_container, place_the_chart_here.firstChild);

    // Initialize ECHARTS chart
    const expenses_chart = echarts.init(chart_container, 'dark');
    window.addEventListener('resize', function() {
        expenses_chart.resize();
    });
    // Computes ECHARTS series
    const echarts_influences_nets = compute_echart_influences_nets();
    const echarts_total_nets = compute_echart_total_nets();
    const echarts_other_nets = echarts_total_nets.map((value, index, array) => {
        return value - echarts_influences_nets[index];
    });

    const option = {
        title: {
            text: 'Movimenti di denaro per mese'
        },
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['Netto delle influenze', 'Netto altre operazioni', 'Netto totale']
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