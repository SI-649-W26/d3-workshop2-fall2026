// ============================================================================
// PARTICIPATION.JS - Tyre strategy (in class, in pairs)
// ============================================================================
// Question: who ran which tyres, and when? Who deviated from the winner's strategy?
//
// One row per driver (in finishing order), one bar per stint.
// A stint is the run on one set of tyres, from lap_start to lap_end.
// Each bar gets the compound's color AND its letter (S, M, H, I, W),
// so the chart does not depend on color alone.
//
// Interactions:
//   - drag across the chart (d3.brushX): tells chart 3 to zoom to those laps (TODO 7)
//   - when chart 3 highlights a driver, fade the other drivers' bars (assignment TODO 12)
//
// Follow the TODO comments and refer to demo.js for guidance.
//
// Read more:
//   Band scales https://d3js.org/d3-scale/band
//   Axes        https://d3js.org/d3-axis
//   Data joins  https://d3js.org/d3-selection/joining
//   Brushing    https://d3js.org/d3-brush

import { onRaceChange, announce, listen } from './data.js';

let duration = 0;

// ============================================================================
// CHART DIMENSIONS AND SVG SETUP
// ============================================================================

const margin = { top: 10, right: 20, bottom: 40, left: 50 };
const width = 900;
const rowHeight = 22; // height of one driver row

const svg = d3.select('#chart2')
    .append('svg')
    .attr('role', 'img')
    .attr('aria-label', 'Tyre strategy of every driver');

// Groups for the axes and the bars, created once
const xAxisGroup = svg.append('g').attr('class', 'axis');
const yAxisGroup = svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left}, 0)`);
const barsGroup = svg.append('g');
const brushGroup = svg.append('g').attr('class', 'brush');
const xLabel = svg.append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'end')
    .attr('x', width - margin.right)
    .text('Lap (drag across the chart to zoom chart 3)');

let x = d3.scaleLinear();
let maxLap = 1;

// ============================================================================
// BRUSH: drag across the chart to pick a range of laps (brushX only moves along x,
// so every driver is included)
// ============================================================================

// TODO STEP 7 (do it after STEP 6): create the brush ONCE, here.
// When the user lets go of the mouse ('end'), turn the selected pixels into laps
// and announce them, so chart 3 can zoom in.
const brush = d3.brushX()
    .on('end', event => {
        console.log("Brush event:", event.selection);
        // brush.move() in our own code also fires 'end': only react to the user
        if (!event.sourceEvent) return;

        // A click without dragging clears the selection: tell chart 3 to show all laps
        if (!event.selection) {
            announce('lapRange' /* Define the message name */, null /* Define the value that means "all laps" */);
            return;
        }

        // event.selection is [left pixel, right pixel]; turn both into laps
        const [x0, x1] = event.selection.map(x.invert/* Specify the scale function that turns pixels back into laps */);

        // A bar for lap n spans from n - 1 to n on the x scale, so:
        const firstLap = Math.max(Math.floor(x0) + 1, 1)// round x0 down and add 1, but never below lap 1 (Math.floor, Math.max)
        const lastLap = Math.min(Math.ceil(x1), maxLap) // round x1 up, at least firstLap + 1, but never above maxLap (Math.ceil, Math.min)

        announce('lapRange', [firstLap, lastLap]);
    });


// ============================================================================
// DRAW (runs for the first race and every time the race changes)
// ============================================================================
onRaceChange(race => {
    if (!race || !race.drivers || !race.stints) {
        console.error("Race data is missing");
        return;
    }

    const height = margin.top + race.drivers.length * rowHeight + margin.bottom;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    xLabel.attr('y', height - 6);
    maxLap = race.maxLap;

    // TODO STEP 1: Create the scales
    const y = d3.scaleBand()
        .domain(race.drivers.map(d => d.driver_number))
        .range([margin.top, height - margin.bottom])
        .padding(0); // use d3.scaleBand() and race.drivers from the data
    x = d3.scaleLinear()
        .domain([0, race.maxLap])
        .range([margin.left, width - margin.right]); // use d3.scaleLinear() and race.maxLap from the data; don't add const

    const acronym = new Map(race.drivers.map(d => [d.driver_number, d.name_acronym]));

    // TODO STEP 2: Draw the axes; use n => acronym.get(n) to get the driver acronym on y axis
    xAxisGroup  
        .attr('transform', `translate(0, ${height - margin.bottom})`)/* Define transform to move the x axis to the bottom */
        .transition().duration(duration)
        .call(d3.axisBottom(x).ticks(20));

    yAxisGroup
        .transition().duration(duration)
        .call(d3.axisLeft(y).tickFormat(n => acronym.get(n)));
  

    // Only stints of drivers in the list (rows)
    const stints = race.stints.filter(s => acronym.has(s.driver_number));
  
    // TODO STEP 3: Join the stints to <g class="stint"> groups, with a KEY so D3 knows which bar is which
    // On enter, each group gets a rect (the bar) and a text (the compound letter)
    const groups = barsGroup.selectAll('g.stint')
        .data(stints, d => d.driver_number + '-' + d.stint_number /* Define the key: driver number and stint number, e.g. "1-2" */)
        .join(
            enter => {
                const g = enter.append('g').attr('class', 'stint').attr('opacity', 0);
                g.append('rect').attr('rx', 3);
                g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em');
                return g;
            },
            update => update,
            exit => exit.transition().duration(duration).attr('opacity', 0).remove()
        );

    const barWidth = d => x(d.lap_end) - x(d.lap_start - 1)/* Define the width using x, d.lap_start and d.lap_end */
    

     // TODO STEP 4: Position each rect and color it by compound (the colors are in css/style.css)
    groups.select('rect')
        .attr('class', d => d.compound /* Define the class: the compound name */)
        .transition().duration(duration)
        .attr('x', d => x(d.lap_start - 1) /* Define x: where the stint's first lap starts, x(d.lap_start - 1) */)
        .attr('y', d => y(d.driver_number) /* Define y: the driver's row */)
        .attr('width', barWidth)
        .attr('height', y.bandwidth() /* Define the height: one band of the y scale */);

    // TODO STEP 5: Put the compound letter in the middle of each bar
    groups.select('text')
        .attr('class', d => `stint-letter ${d.compound}-letter`)
        .text(d => d.compound[0]/* Define the letter: the first character of the compound */)
        .transition().duration(duration)
        .attr('x', d => x(d.lap_start - 1) + barWidth(d)/2 /* Define x: the middle of the bar */)
        .attr('y', d => y(d.driver_number) + (y.bandwidth()/2)/* Define y: the middle of the row */)
        .attr('opacity', d => (barWidth(d) < 14 ? 0 : 1)/* Hide the letter (0) on bars narrower than 14 px, otherwise 1 */);


     // TODO STEP 6: Fade the bars in, so new bars appear smoothly when the race changes
    groups.transition().duration(duration/* Define duration */).attr('opacity', 1 /* Define opacity */);

    // TODO STEP 7 (continued): stretch the brush over the whole plot area (all driver rows)
    // and clear any old selection when the race changes
    brush.extent([[margin.left/* Define left */, margin.top/* Define top */], [width - margin.right/* Define right */, height-margin.bottom/* Define bottom */]]);
    brushGroup.call(brush).call(brush.move, null);
    // Then drag across the chart: chart 3 zooms in once you finish the assignment.

    // TODO STEP 8: look at the chart for each race. Who deviated most from the winner's strategy?
    // Write your answer (3 sentences) at the bottom of README.md, under "Participation answer".

    // TODO STEP 6 (continued): from the next race change on, animate
    duration = 750; /* Define duration: 750 */
        });

// ============================================================================
// LINKED HIGHLIGHT (part of the assignment, TODO 12 in assignment.js)
// ============================================================================

// TODO 12 (assignment): chart 3 announces the driver under the mouse.
// Listen to it and fade the other drivers' bars
listen('hoverDriver', driverNumber => {
    barsGroup.selectAll('g.stint')
        .attr('opacity', d => driverNumber === null || d.driver_number === driverNumber ? 1 : 0.25/* 1 for that driver (and for everyone when driverNumber is null), 0.25 for the others */);
});
