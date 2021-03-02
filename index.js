/*-------------------------REFERENCES:----------------------
d3js code reference: https://observablehq.com/@d3/bar-chart-race-explained
data set source: https://openstat.psa.gov.ph/
------------------------------------------------------------*/

let maxValx = 0;//this variable is used to get the maximum values to be able to map the width of the svg window

d3.csv("2E4EVCP0_all_5.csv").then(async function (data) {//import the csv data

  //VARIABLES AND CONSTANT
  const width = 1000;
  const padding = 30;
  let margin = { top: padding, right: 0, bottom: padding, left: padding };
  let barSize = 48;
  const duration = 1200;
  const pauseTime=500;
  let colorArr = [
    "#ff0000",
    "#ff4000",
    "#ff8000",
    "#ffbf00",
    "#00ffbf",
    "#00bfff",
    "#0040ff",
    "#0000ff",
    "#333300",
    "#003300",
    "#bf00ff",
    "#ff0000",
    "#6b0094",
    "#99CC00",
    "#33CC33",
    "#006666",
  ];

  //call the reformatData function that returns the dataset value
  let dataset = reformatData(data);
  /*data_grp_by_reg FORMAT
    Data Structure:
    Type: Set
      Key: Region Name
      value:[
          {
          year:,
          region:
          value:}
      ]

  */
  let data_grp_by_reg = d3.group(dataset, (d) => d.region);//group the data by region in key-value pair
  
  let n = Array.from(data_grp_by_reg).length;//get the length of the data by converting it to array and get the length of the array
  let height = margin.top + (barSize / 2) * n + margin.bottom;
  let regions = new Set(dataset.map((d) => d.region));//get the list of regions
 
  /*YEAR VALUES FORMAT 
  Data Structure:
  Type: Array
    [
    0:{"1987: January Q1"}
    1:Map
      0:{CAR Region => "100"}
        key:CAR Region
        value:"100"
    ]
  */
  let yearvalues = Array.from(
    d3.rollup(
      dataset,
      ([d]) => d.value,
      (d) => d.year,
      (d) => d.region
    )
  ).map(([year, dataset]) => [year, dataset]);

  /*-----------------------------------------------
  The rank function get the rank of the region per quarter.
  This is used to set the value of "y" during transistion
  of the bar graph

  Data Structure:
  Type: Array
  [
    {
      region:western visayas,
      value:410462,
      rank:0
    }
  ]

  ---------------------------------------------------*/
  function rank(value) {
    const data = Array.from(regions, (region) => ({
      region,
      value: value(region),
    }));
    
    data.sort(function (b, a) {
      return a["value"] - b["value"];
    });
    for (let i = 0; i < data.length; i++) data[i].rank = Math.min(n, i);
    
    return data;
  }


  /*-----------------------------------------------
  The keyframe function is also used during transistion
  from previous data to the next data

  Data Structure:
  Type: Array
  [
    [
      "1987: January (Q1)",
      [
        rank:0,
        region: western visayas,
        value:410462
      ] ........,
      [
         rank:16,
        region: caraga,
        value:9684
      ]
    ]
    
  ]
  ---------------------------------------------------*/

  let k = 1;
  function keyframe() {
    const keyframes = [];
    let ka, a, kb, b;
    for ([[ka, a], [kb, b]] of d3.pairs(yearvalues)) {
      for (let i = 0; i < k; ++i) {
        //console.log("ka " + ka)
        const t = i / k;
        keyframes.push([
          ka,
          rank(
            (region) =>
              (a.get(region) || 0) * (1 - t) + (b.get(region) || 0) * t
          ),
        ]);
      }
    }
    keyframes.push([kb, rank((region) => b.get(region) || 0)]);

    return keyframes;
  }

  let keyframes = keyframe();
  let regionframes = d3.groups(
    keyframes.flatMap(([, data]) => data),
    (d) => d.region
  );

  //get the previous data
  let prev = new Map(
    regionframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a]))
  );
 //get the next data
  let next = new Map(regionframes.flatMap(([, data]) => d3.pairs(data)));

//this function will return index of the region from regions array
  function regionIndex(regionIndex) {
    //convert set to array
    let regionArr = Array.from(regions);
    let index = regionArr.indexOf(regionIndex["region"]);
    return index;
  }

//create scale for x axis
  const x = d3
    .scaleLinear() //since the x axis is date, we will use scaleTime instead of scaleLinear
    .domain([0, maxValx])
    .range([padding, width - padding * 10]);

  //create bars
  function bars(svg) {
    let bar = svg.append("g").attr("fill-opacity", 0.7).selectAll("rect");

    return ([year, data], transition) =>
      (bar = bar
        .data(data.slice(0, n), (d) => d.region)
        .join(
          (enter) =>
            enter
              .append("rect")
              .style("fill", function (d) {
                let index = regionIndex(d);
                
                return colorArr[Number(index)];
              })
              .attr("region", (d) => d.region)
              .attr("value", (d) => d.value)
              .attr("height", (barSize - 2) / 2)
              .attr("x", padding)
              .attr("y", (d) => {
                return ((prev.get(d) || d).rank + 1) * (barSize / 2);
              })
              .attr("width", (d) => x((prev.get(d) || d).value) - x(0)),

          (update) => update,
          (exit) =>
            exit
              .transition(transition)
              .remove()
              .attr("y", (d) => ((next.get(d) || d).rank + 1) * (barSize / 2))
              .attr("width", (d) => x((next.get(d) || d).value) - x(0))
        )
        .call((bar) =>
          bar
            .transition(transition)
            .attr("y", (d) => (d.rank + 1) * (barSize / 2))
            .attr("width", (d) => x(d.value) - x(0))
        ));
  }

  function textTween(a, b) {
    const i = d3.interpolateNumber(a, b);
    return function (t) {
      this.textContent = String(Math.round(i(t)));
    };
  }

  function labels(svg) {
    let label = svg
      .append("g")
      .attr("class", "region")
      .attr("text-anchor", "start")

      .selectAll("text");

    return ([year, data], transition) =>
      (label = label
        .data(data.slice(0, n), (d) => d.region)
        .join(
          (enter) =>
            enter
              .append("text")
              .attr("x", (d) => padding + x((prev.get(d) || d).value) - x(0))
              .attr("y", (d) => {
                return (
                  ((prev.get(d) || d).rank + 1) * (barSize / 2) + barSize / 4
                );
              })
              .attr("dy", "-0.25em")
              .text((d) => d.region + "-> ")
              .call(
                (text) => text.append("tspan").attr("class", "value")
              ),
          (update) => update,
          (exit) =>
            exit
              .transition(transition)
              .remove()
              .attr("x", (d) => padding + x((next.get(d) || d).value) - x(0))
              .attr(
                "y",
                (d) =>
                  ((next.get(d) || d).rank + 1) * (barSize / 2) + barSize / 4
              )
              .call((g) =>
                g
                  .select("tspan")
                  .tween("text", (d) =>
                    textTween(d.value, (next.get(d) || d).value)
                  )
              )
        )
        .call((bar) =>
          bar
            .transition(transition)
            .attr("x", (d) => padding + x(d.value) - x(0))
            .attr("y", (d) => (d.rank + 1) * (barSize / 2) + barSize / 4)
            .call((g) =>
              g
                .select("tspan")
                .tween("text", (d) =>
                  textTween((prev.get(d) || d).value, d.value)
                )
            )
        ));
  }

  function ticker(svg) {
    const now = svg
      .append("text")
      .style("font", `bold ${barSize}px var(--sans-serif)`)
      .style("font-size", "35px")
      .style("transition", "0.3s")
      .style("font-variant-numeric", "tabular-nums")
      .attr("text-anchor", "end")
      .attr("x", width / 2)
      .attr("y", height - 20)
      .attr("dy", "0.32em")
      .text(String(keyframes[0][0]));

    return ([year], transition) => {
      transition.end().then(() => now.text(year));
    };
  }

  const svg = d3.select("svg").attr("width", width).attr("height", height);

  const updateBars = bars(svg);
  const updateLabels = labels(svg);
  const updateTicker = ticker(svg);

  for (const keyframe of keyframes) {
    const transition = svg.transition().duration(duration).ease(d3.easeLinear);

    updateBars(keyframe, transition);
    updateLabels(keyframe, transition);
    updateTicker(keyframe, transition);

    await transition.end();

    //give 0.5 seconds to pause before continuing to the next data
    await new Promise((done) => setTimeout(() => done(), pauseTime));
  }
});


/*----------------------------------------------------------------------------
  //reformat the object value
  MODEL FOR THE JSON
[
    {
        "year":--,
        "region":--,
        "value":--
    },
]
-------------------------------------------------------------------------------*/
function reformatData(data) {

  let datasetLen = Object.keys(data[0]).length;
  console.log(datasetLen);
  let year_quarter = Object.keys(data[0]).splice(1, datasetLen);
  let year_quarter_len = year_quarter.length;
  //get the maximum and minimum values

  let dataset = [];

  for (let i = 0; i < year_quarter_len; i++) {
    let obj;
    data.map((val, key) => {
      //push region and value to the value reg
      let value = val[year_quarter[i]];
      //get the minimum and maximum value
      if (Number(value) >= maxValx) {
        maxValx = Number(value);
      }
      obj = {
        year: year_quarter[i],
        region: val["Region"],
        value: value,
      };
      dataset.push(obj);
    });
  }
  return dataset;
}
