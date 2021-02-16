//test if browser supports webGL

if (Modernizr.webgl) {

  //setup pymjs
  var pymChild = new pym.Child();

  //first load config file


  //Load data and config file
  d3.queue()
    .defer(d3.csv, "data/data.csv")
    .defer(d3.json, "data/config.json")
    .defer(d3.json, "data/nutsmortalitycountries2.json")
    .defer(d3.json, "data/nutsmortalitycountries2boundaries.json")
    .await(ready);


  function ready(error, data, config, geog, geogCtry) {

    //Set up global variables
    dvc = config.ons;
    oldAREACD = "";
    selected = false;
    firsthover = true;
    chartDrawn = false;
    thisdata = data;
    overallwidth = d3.select("body").node().getBoundingClientRect().width;
    timePeriod = null;

    if (overallwidth < 600) {
      mobile = true;
    } else {
      mobile = false;
    };



    //Get column names and number
    variables = [];
    for (var column in data[0]) {
      if (column == 'AREACD') continue;
      if (column == 'AREANM') continue;
      variables.push(column);
    }

    b = 0;

    if (dvc.timeload == "last") {
      a = variables.length - 1;
    } else {
      a = dvc.timeload;
    }

    console.log('Setting a');
    console.log(a)

    //BuildNavigation
    if (dvc.varlabels.length > 1) {
      buildNav();
    } else {
      d3.select("#topNav").attr("display", "none")
    }
    //set title of page
    //Need to test that this shows up in GA
    document.title = dvc.maptitle;

    //Fire design functions
    selectlist(data);

    //Set up number formats
    displayformat = d3.format("." + dvc.displaydecimals + "f");
    legendformat = d3.format("." + dvc.legenddecimals + "f");
    dateparse = d3.timeParse(dvc.dateParse)
    dateformat = d3.timeFormat(dvc.dateFormat)

    //set up basemap
    map = new mapboxgl.Map({
      container: 'map', // container id
      style: 'data/style.json', //stylesheet location //includes key for API
      center: [-2.5, 54], // starting position
      minZoom: 2, //
      zoom: 2, // starting zoom
      maxZoom: 13, //
      attributionControl: false
    });
    //add fullscreen option
    //map.addControl(new mapboxgl.FullscreenControl());

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');

    // Disable map rotation using right click + drag
    map.dragRotate.disable();

    // Disable map rotation using touch rotation gesture
    map.touchZoomRotate.disableRotation();

    // Add geolocation controls to the map.
    // map.addControl(new mapboxgl.GeolocateControl({
    //     positionOptions: {
    //       enableHighAccuracy: true
    //     }
    //   }),
    //   'bottom-left'
    // );

    //add compact attribution
    map.addControl(new mapboxgl.AttributionControl({
      compact: true
    }));

    //get location on click
    d3.select(".mapboxgl-ctrl-geolocate").on("click", geolocate);

    //addFullscreen();

    setRates(thisdata);

    defineBreaks(thisdata);

    setupScales(thisdata);

    setTimeLabel(a);

    //now ranges are set we can call draw the key
    createKey(config);

    //convert topojson to geojson
    for (key in geog.objects) {
      var areas = topojson.feature(geog, geog.objects[key])
    }

    for (key in geogCtry.objects) {
      var areasCtry = topojson.feature(geogCtry, geogCtry.objects[key])
    }

    //Work out extend of loaded geography file so we can set map to fit total extent
    bounds = turf.extent(areas);

    // temporary hack to change bounds until I've sorted final boundaries
    console.log(bounds)
    // bounds[0] = -25
    bounds[1] = 36
    // bounds[2] = 30
    bounds[3] = 67

    //set map to total extent
    // setTimeout(function() {
    //   map.fitBounds([
    //     [bounds[0], bounds[1]],
    //     [bounds[2], bounds[3]]
    //   ])
    // }, 1000);

    map.fitBounds([
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]]
    ])

map.on('zoom', function() {console.log(map.getZoom())})

    //and add properties to the geojson based on the csv file we've read in
    areas.features.map(function(d, i) {

      d.properties.fill = color(rateById[d.properties.NUTS_ID])
    });


    map.on('load', defineLayers);

    setButtons();
    setSource();

    //setInterval(function(){animate()}, 3000);

    function buildNav() {

      formgroup = d3.select('#nav')
        .append('form')
        .attr('class', 'form-group-fullwidth')
        .attr('role', 'radiogroup')
        .selectAll('div')
        .data(dvc.varlabels)
        .enter()
        .append('div')
        .attr("class", 'form-group-fullwidth')
        .attr("role", "radio")
        .attr("tabindex", "1");

      formgroup.append('input')
        .attr("id", function(d, i) {
          return "button" + i
        })
        .attr('class', 'radio-primary-fullwidth')
        .attr("type", "radio")
        .attr("name", "button")
        .attr("value", function(d, i) {
          return i
        })
        .attr("aria-checked", function(d, i) {
          if (i == b) {
            return true
          }
        })
        .property("checked", function(d, i) {
          return i === b;
        })

      formgroup.append('label')
        .attr('class', 'label-primary-fullwidth')
        .attr("for", function(d, i) {
          return "button" + i
        })
        .text(function(d, i) {
          return dvc.varlabels[i]
        })
        .on('click', function(d, i) {
          onchange(i)
        })

      selectgroup = d3.select('#selectnav')
        .append('select')
        .attr('class', 'dropdown')
        .on('change', onselect)
        .selectAll("option")
        .data(dvc.varlabels)
        .enter()
        .append('option')
        .attr("value", function(d, i) {
          return i
        })
        .property("selected", function(d, i) {
          return i === b;
        })
        .text(function(d, i) {
          return dvc.varlabels[i]
        });




    }

    function setRates(thisdata) {

      rateById = {};
      areaById = {};

      thisdata.forEach(function(d) {
        rateById[d.AREACD] = parseFloat(d[variables[a]]);
        areaById[d.AREACD] = d.AREANM
      });

    }

    function setTimeLabel() {
      if (mobile == false) {
        timePeriod = d3.select('#timePeriodDesktop')
      } else {
        timePeriod = d3.select('#timePeriodMobile')
      }
      console.log(variables[a])
      timePeriod.text(dateformat(dateparse(variables[a])));
    }

    function checkIfFirstorLast() {
      if (a = 0) {

      }


    }



    function defineBreaks(data) {
      //Flatten data values and work out breaks
      var values = thisdata.map(function(d) {
        return parseFloat(d[variables[a]]);
      }).filter(function(d) {
        return !isNaN(d)
      }).sort(d3.ascending);

      //If jenks or equal then flatten data so we can work out what the breaks need to be

      // Work out how many timepoints we have in our dataset; number of rows - area name & code // Look at linechart templates to see how?
      // parse data into columns
      if (config.ons.breaks == "jenks" || config.ons.breaks == "equal") {
        var values = [];
        allvalues = [];

        for (var column in data[0]) {
          if (column != 'AREANM' && column != 'AREACD') {
            values[column] = data.map(function(d) {
              return +eval("d." + column);
            }).filter(function(d) {
              return !isNaN(d)
            }).sort(d3.ascending);
            allvalues = allvalues.concat(values[column]);
          }

        }

        allvalues.sort(d3.ascending);

      }

      if (config.ons.breaks == "jenks") {
        breaks = [];

        ss.ckmeans(allvalues, (dvc.numberBreaks)).map(function(cluster, i) {
          if (i < dvc.numberBreaks - 1) {
            breaks.push(cluster[0]);
          } else {
            breaks.push(cluster[0])
            //if the last cluster take the last max value
            breaks.push(cluster[cluster.length - 1]);
          }
        });
      } else if (config.ons.breaks == "equal") {
        breaks = ss.equalIntervalBreaks(allvalues, dvc.numberBreaks);
      } else {
        breaks = config.ons.breaks;
      };


      //round breaks to specified decimal places
      breaks = breaks.map(function(each_element) {
        return Number(each_element.toFixed(dvc.legenddecimals));
      });

      //work out halfway point (for no data position)
      midpoint = breaks[0] + ((breaks[dvc.numberBreaks] - breaks[0]) / 2)

    }

    function setupScales() {
      //set up d3 color scales
      //Load colours
      if (typeof dvc.varcolour === 'string') {
        // colour = colorbrewer[dvc.varcolour][dvc.numberBreaks];
        color = chroma.scale(dvc.varcolour).colors(dvc.numberBreaks)
        colour = []
        color.forEach(function(d) {
          colour.push(chroma(d).darken(0.4).saturate(0.6).hex())
        })


      } else {
        colour = dvc.varcolour;
      }

      //set up d3 color scales
      color = d3.scaleThreshold()
        .domain(breaks.slice(1))
        .range(colour);

    }

    function defineLayers() {

      map.addSource('area', {
        'type': 'geojson',
        'data': areas
      });

      map.addSource('nations', {
        'type': 'geojson',
        'data': areasCtry
      });

      map.addLayer({
        'id': 'area',
        'type': 'fill',
        'source': 'area',
        'layout': {},
        'paint': {
          'fill-color': {
            type: 'identity',
            property: 'fill'
          },
          'fill-opacity': 0.7,
          'fill-outline-color': '#fff'
        }
      }, 'place_city');


      //Get current year for copyright
      today = new Date();
      copyYear = today.getFullYear();
      map.style.sourceCaches['area']._source.attribution = "Contains OS data &copy; Crown copyright and database right " + copyYear;

      map.addLayer({
        "id": "state-fills-hover-nations",
        "type": "line",
        "source": "nations",
        "layout": {},
        "paint": {
          "line-color": "#666",
          "line-width": 1
        }
      }, 'place_city');

      map.addLayer({
        "id": "state-fills-hover",
        "type": "line",
        "source": "area",
        "layout": {},
        "paint": {
          "line-color": "#000",
          "line-width": 2
        },
        "filter": ["==", "NUTS_ID", ""]
      }, 'place_city');


      // map.addLayer({
      //   'id': 'area_labels',
      //   'type': 'symbol',
      //   'source': 'area',
      //   'minzoom': 10,
      //   'layout': {
      //     "text-field": '{AREANM}',
      //     "text-font": ["Open Sans", "Arial Unicode MS Regular"],
      //     "text-size": 14
      //   },
      //   'paint': {
      //     "text-color": "#666",
      //     "text-halo-color": "#fff",
      //     "text-halo-width": 1,
      //     "text-halo-blur": 1
      //   }
      // });


      //test whether ie or not
      function detectIE() {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
          // IE 10 or older => return version number
          return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
          // IE 11 => return version number
          var rv = ua.indexOf('rv:');
          return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
          // Edge (IE 12+) => return version number
          return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
      }


      if (detectIE()) {
        onMove = onMove.debounce(200);
        onLeave = onLeave.debounce(200);
      };

      //Highlight stroke on mouseover (and show area information)
      map.on("mousemove", "area", onMove);

      // Reset the state-fills-hover layer's filter when the mouse leaves the layer.
      map.on("mouseleave", "area", onLeave);

      //Add click event
      map.on("click", "area", onClick);

      console.log('start animating')
      // start animation going by default
      onPlay();

    }


    function updateLayers() {

      //update properties to the geojson based on the csv file we've read in
      areas.features.map(function(d, i) {
        var fillNum = rateById[d.properties.NUTS_ID];
        d.properties.fill = (isNaN(fillNum) ? "#dadada" : color(fillNum))
      });

      //Reattach geojson data to area layer
      map.getSource('area').setData(areas);

      //set up style object
      styleObject = {
        type: 'identity',
        property: 'fill'
      }
      //repaint area layer map usign the styles above
      map.setPaintProperty('area', 'fill-color', styleObject);

    }


    function onchange(i) {

      chartDrawn = false;
      navvalue = i;
      //load new csv file

      filepth = "data/data" + i + ".csv"

      d3.csv(filepth, function(data) {
        thisdata = data;
        setRates(thisdata);
        defineBreaks(thisdata);
        setupScales(thisdata);
        createKey(config);

        if (selected) {
          setAxisVal($("#areaselect").val());
          if (mobile == false) {
            updateChart($("#areaselect").val());
          }
        }
        updateLayers();

        dataLayer.push({
          'event': 'navSelect',
          'selected': i
        })
      });



    }

    function setButtons() {
      d3.select("#play").on("click", onPlay)
      d3.select("#forward").on("click", fwd_animate);
      d3.select("#back").on("click", rev_animate);
    }

    function onPlay() {
      dataLayer.push({
        'event': 'playButton',
        'selected': 'play'
      })

      fwd_animate() // don't need a delay before first animation
      animating = setInterval(function() {
        fwd_animate()
      }, 1500);

      // disable forward and back buttons
      // d3.selectAll(".btn--neutral").classed("btn--neutral-disabled", true)

      // replace play image with pause
      // d3.select("#playImage").attr("src", "images/pause.svg");
      d3.select("#play").select("span")
        .classed("glyphicon-play", false)
        .classed("glyphicon-pause", true)

      // switch id/class of play to pause
      d3.select("#play").attr("id", "pause");

      d3.select("#pause").on("click", onPause)
    } // end onplay

    function onPause() {
      // dataLayer.push({
      //   'event': 'playButton',
      //   'selected': 'pause'
      // })

      // replace pause symbol with play symbol
      d3.select("#pause").select("span")
        .classed("glyphicon-pause", false)
        .classed("glyphicon-play", true);
      d3.select("#pause").attr("id", "play")
      // make symbols clickable - TODO is this required?
      setButtons();
      clearInterval(animating);
    };


    function fwd_animate() {
      // go forwards in time
      if (a < variables.length - 1) {
        a = a + 1;
      } else {
        a = 0;
      }

      moveSliderToVal();
      updateVisuals();
    }

    function rev_animate() {
      // go back in time
      if (a > 0) {
        a = a - 1;
      } else {
        a = variables.length - 1;
      }

      moveSliderToVal();
      updateVisuals();
    }

    function moveSliderToVal() {
      sliderSimple.silentValue(a);
    }

    function updateVisuals() {
      console.log('Newly set a:')
      console.log(a);
      setRates(thisdata);
      updateLayers();
      updateTimeLabel();

      if (selected) {
        setAxisVal($("#areaselect").val());
        if (mobile == false) {
          updateChart($("#areaselect").val());
        }
      }

      if (mobile == false) {
        d3.select("#currPoint2")
          .transition()
          .ease(d3.easeQuadOut)
          .duration(200)
          .attr("cx", x(dateparse(variables[a])))
          .attr("cy", y(dvc.average[0][a]));
      }
    }

    function updateTimeLabel() {
      timePeriod.text(dateformat(dateparse(variables[a])))
    }

    // time slider

console.log(variables)
    var parseTime = d3.timeParse("%d/%m/%Y")
    var sliderScale = d3.scaleLinear()
      .domain([0, variables.length-1])
      .range([0, keywidth - dvc.keyMargin.right]);
    var sliderSimple = d3
      .sliderBottom(sliderScale)
      // .min(0)
      // .max(variables.length)
      .displayValue(false)
      .step(1)
      // .marks(d3.timeWeek.range(timeRange[0], timeRange[1]))
      // .min(parseTime("01/03/2020"))
      // .max(parseTime("01/01/2021"))
      // .width(parseInt(d3.select('body').style("width"))-210)
      .default(a)
      // .displayFormat(formatDate)
      // .marks([parseTime("01/03/2020"), parseTime("01/01/2021")])
      .handle(
        d3.symbol()
          .type(d3.symbolCircle)
          .size(500)
      )
      .fill("#206095")
      .ticks([]);

      // if (parseInt(d3.select('body').style('width')) > 1500) {
        //console.log("wide")
        // sliderSimple
          // .ticks([])
        //   .tickFormat(formatDate)
        //   .tickValues(headingsParsed);
      // }else{
      //   //console.log("thin")
      //   sliderSimple
      //     .tickFormat(d3.timeFormat("%b"))
      //     .ticks(5);
      // }

    sliderSimple.on('onchange', function(val) {
      // a is the master variable for the current timepoint
      console.log('SLIDER VAL:')
      console.log(a)
      a = val;
      onPause();
      updateVisuals();
    });

    var gSimple = d3
    .select('div#slider-simple')
    .append('svg')
    // .attr('width', parseInt(d3.select('#').style("width"))-140)
    .attr('height', 75)
    .append('g')
    .attr('transform', 'translate(' + dvc.keyMargin.left + ',20)');

    gSimple.call(sliderSimple);

    //Time slider accessibility

    // d3.select('.playbackcontrols').on('keydown',function(){
    //   //console.log("keypress")
    //
    //   if (d3.event.key=='ArrowRight' || d3.event.key=='ArrowUp') {
    //     changeDate("forward")
    //   }
    //   if (d3.event.key=='ArrowLeft' || d3.event.key=='ArrowDown') {
    //     changeDate("back")
    //   }
    //   if (d3.event.key=='PageUp' || d3.event.key=='End') {
    //     changeDate("end")
    //   }
    //   if (d3.event.key=='PageDown' || d3.event.key=='Home') {
    //     changeDate("start")
    //   }
    //
    // })

    function onselect() {
      b = $(".dropdown").val();
      onchange(b);

    }


    function onMove(e) {

      map.getCanvasContainer().style.cursor = 'pointer';

      newAREACD = e.features[0].properties.NUTS_ID;

      if (firsthover) {
        dataLayer.push({
          'event': 'mapHoverSelect',
          'selected': newAREACD
        })

        firsthover = false;
      }

      if (newAREACD != oldAREACD) {
        selected = true;

        oldAREACD = e.features[0].properties.NUTS_ID;
        map.setFilter("state-fills-hover", ["==", "NUTS_ID", e.features[0].properties.NUTS_ID]);

        selectArea(e.features[0].properties.NUTS_ID);
        setAxisVal(e.features[0].properties.NUTS_ID);
        if (mobile == false) {
          updateChart(e.features[0].properties.NUTS_ID);
        }
      }
    };


    function onLeave() {
      selected = false;

      map.getCanvasContainer().style.cursor = null;
      map.setFilter("state-fills-hover", ["==", "NUTS_ID", ""]);
      oldAREACD = "";
      $("#areaselect").val(null).trigger('chosen:updated');
      hideaxisVal();
    };

    function onClick(e) {
      disableMouseEvents();
      newAREACD = e.features[0].properties.NUTS_ID;

      if (newAREACD != oldAREACD) {
        selected = true;

        oldAREACD = e.features[0].properties.NUTS_ID;
        map.setFilter("state-fills-hover", ["==", "NUTS_ID", e.features[0].properties.NUTS_ID]);

        selectArea(e.features[0].properties.NUTS_ID);
        setAxisVal(e.features[0].properties.NUTS_ID);
        if (mobile == false) {
          updateChart(e.features[0].properties.NUTS_ID);
        }
      }

      dataLayer.push({
        'event': 'mapClickSelect',
        'selected': newAREACD
      })

    };

    function disableMouseEvents() {
      map.off("mousemove", "area", onMove);
      map.off("mouseleave", "area", onLeave);

    }

    function enableMouseEvents() {
      map.on("mousemove", "area", onMove);
      map.on("click", "area", onClick);
      map.on("mouseleave", "area", onLeave);

    }

    function selectArea(code) {
      $("#areaselect").val(code).trigger('chosen:updated');
    }



    function zoomToArea(code) {

      specificpolygon = areas.features.filter(function(d) {
        return d.properties.NUTS_ID == code
      })

      specific = turf.extent(specificpolygon[0].geometry);

      map.fitBounds([
        [specific[0], specific[1]],
        [specific[2], specific[3]]
      ], {
        padding: {
          top: 150,
          bottom: 150,
          left: 100,
          right: 100
        }
      });

    }

    function resetZoom() {

      map.fitBounds([
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ]);

    }


    function setAxisVal(code) {
      if (mobile == false) {
        d3.select("#currLine")
          .style("opacity", function() {
            if (!isNaN(rateById[code])) {
              return 1
            } else {
              return 0
            }
          })
          .transition()
          .ease(d3.easeQuadOut)
          .duration(200)
          .attr("y1", function() {
            if (!isNaN(rateById[code])) {
              return y(rateById[code])
            } else {
              return y(midpoint)
            }
          })
          .attr("y2", function() {
            if (!isNaN(rateById[code])) {
              return y(rateById[code])
            } else {
              return y(midpoint)
            }
          })
          .attr("x2", x(dateparse(variables[a])))
          .attr("x1", x(0));

        d3.select("#currVal")
          .text(function() {
            if (!isNaN(rateById[code])) {
              return displayformat(rateById[code]) + "%"
            } else {
              return "Data unavailable"
            }
          })
          .style("opacity", 1)
          .attr("text-anchor", "middle")
          .transition()
          .ease(d3.easeQuadOut)
          .duration(200)
          .attr("x", function() {
            if (!isNaN(rateById[code])) {
              console.log(x(dateparse(variables[a])))
              return x(dateparse(variables[a]))
            } else {
              return x.range().reduce(function(a, b) {return a + b}, 0) / 2 // plop it in the middle
            }
          })
          .attr("y", function() {
            if (!isNaN(rateById[code])) {
              return y(rateById[code]) - 20
            } else {
              return y(midpoint-90)
            }
          });

        // d3.select("#currVal2")
        //   .text(function() {
        //     if (!isNaN(rateById[code])) {
        //       return displayformat(rateById[code])
        //     } else {
        //       return "Data unavailable"
        //     }
        //   })
        //   .style("opacity", 1)
        //   .transition()
        //   .duration(300)
        //   .attr("x", x(variables[a]))
        //   .attr("y", function() {
        //     if (!isNaN(rateById[code])) {
        //       return y(rateById[code]) - 20
        //     } else {
        //       return y(midpoint)
        //     }
        //   });

        d3.select("#currPoint")
          .text(function() {
            if (!isNaN(rateById[code])) { // there's a value so show data
              return displayformat(rateById[code])
            } else { // there's no value so show it's unavailable
              return "Data unavailable"
            }
          })
          .style("opacity", function() {
            if (!isNaN(rateById[code])) {
              return 1
            } else {
              return 0
            }
          })
          .transition()
          .ease(d3.easeQuadOut)
          .duration(200)
          .attr("cx", x(dateparse(variables[a])))
          .attr("cy", function() {
            if (!isNaN(rateById[code])) {
              return y(rateById[code])
            } else {
              return y(0)
            }
          });


      } else {

        d3.select("#currLine")
          .style("opacity", function() {
            if (!isNaN(rateById[code])) {
              return 1
            } else {
              return 0
            }
          })
          .transition()
          .duration(400)
          .attr("x1", function() {
            if (!isNaN(rateById[code])) {
              return xkey(rateById[code])
            } else {
              return xkey(midpoint)
            }
          })
          .attr("x2", function() {
            if (!isNaN(rateById[code])) {
              return xkey(rateById[code])
            } else {
              return xkey(midpoint)
            }
          });


        d3.select("#currVal")
          .text(function() {
            if (!isNaN(rateById[code])) {
              return displayformat(rateById[code])
            } else {
              return "Data unavailable"
            }
          })
          .style("opacity", 1)
          .attr("text-anchor", "middle")
          .transition()
          .duration(400)
          .attr("x", function() {
            if (!isNaN(rateById[code])) {
              return xkey(rateById[code])
            } else {
              return xkey(midpoint)
            }
          })
      }

    }


    function updateChart(code, selectlist) {
      console.log(code)

      if (chartDrawn == false) {



        selectedarea = thisdata.filter(function(d) {
          return d.AREACD == code
        });

        // chart drawn only if the first area selected is in the data. Only required if bad boundaries are left in
        if (isNaN(selectedarea)) {
          chartDrawn = true;
        }

        selectedarea.forEach(function(d) {
          valuesx = variables.map(function(name) {
            return +d[name]
          });
        });

        values = valuesx.slice(0);



        linedata = d3.zip(variables, values);

        line1 = d3.line()
          .defined(function(linedata) {
            return !isNaN(linedata[1]);
          })
          .x(function(d, i) {
            return x(dateparse(linedata[i][0]));
          })
          .y(function(d, i) {
            return y(linedata[i][1]);
          });



        var gline1 = svgkey.append("g")
          .attr("transform", "translate(45,10)")
          .attr("id", "chartgroup")

        // TODO: the following code initiates the responsive line on the line chart
        // This is bad - the code that create and updates the line chart should be in the same place!
        // The line chart is initiated with data for the first area the user selects.
        // It's redundant because elsewhere there is code to update it with new data!
        gline1.append("path")
          .attr("id", "line1")
          .style("opacity", 1)
          .attr("d", line1(linedata))
          .attr("stroke", "#666")
          .attr("stroke-width", "2px")
          .attr("fill", "none");

        gline1.append("circle")
          .attr("id", "currPoint")
          .attr("r", "4px")
          .attr("cy", y(linedata[a][1]))
          .attr("cx", x(dateparse(variables[a])))
          .attr("fill", "#999")
          .attr("stroke", "black")
          // .attr("opacity", 0);

          gline1.append("text")
            .attr("id", "currVal")
            .attr("y", y(linedata[a][1]) - 20)
            .attr("fill", "#000")
            .attr("paint-order", "stroke")
            .attr("stroke", "#fff")
            .attr("stroke-width", "5px")
            .attr("stroke-linecap", "butt")
            .attr("stroke-linejoin", "miter");
            // .text("");

      } else {

        selectedarea = thisdata.filter(function(d) {
          return d.AREACD == code
        });

        // if selectedarea is empty replace old values with NaN
        if (selectedarea.length == 0) {
          valuesx = Array.from(valuesx, function() {return NaN})
        } else { // else get new selectedarea values
          selectedarea.forEach(function(d) {
            valuesx = variables.map(function(name) {
              return +d[name]
            });
          });
        }

        values = valuesx.slice(0);

        linedata = d3.zip(variables, values);

        d3.select("#line1")
          .style("opacity", 1)
          .transition()
          .duration(300)
          .attr("d", line1(linedata))

      }

    }

    function hideaxisVal() {
      d3.select("#line1")
        .style("opacity", 0);

      d3.select("#currPoint")
        .style("opacity", 0);

      d3.select("#currLine")
        .style("opacity", 0);

      d3.select("#currVal").text("")
        .style("opacity", 0);

      // d3.select("#currVal2")
      //   .style("opacity", 0);
    }

    function createKey(config, i) {

      d3.select("#keydiv").selectAll("*").remove();

      var color = d3.scaleThreshold()
        .domain(breaks)
        .range(colour);

      if (mobile == false) {

        d3.select("#keydiv")
          .append("p")
            .attr("id", "keyunit")
            .text(dvc.varunit);

        keyheight = dvc.keyHeight;

        keywidth = d3.select("#keydiv").node().getBoundingClientRect().width;

        svgkey = d3.select("#keydiv")
          .append("svg")
          .attr("id", "key")
          .attr("width", keywidth)
          .attr("height", keyheight + 30);

        // Set up scales for legend
        y = d3.scaleLinear()
          .domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
          .range([keyheight, dvc.keyMargin.top]); /*range for pixels*/

        // Set up scales for chart
        timeRange = [dateparse(variables[0]), dateparse(variables[variables.length - 1])]
        x = d3.scaleLinear()
          .domain(timeRange)
          .range([0, keywidth - dvc.keyMargin.right]);


        var yAxis = d3.axisLeft(y)
          .tickSize(15)
          .tickValues(color.domain())
          .tickFormat(legendformat);

        //Add
        var xAxisTime = d3.axisBottom(x)
          .tickValues([
            dateparse('3/1/2020'),
            dateparse('23/3/2020'),
            dateparse('12/6/2020')
          ])
          // .ticks(3)
          // .tickSize(5)
          // .tickValues(dvc.timelineLabelsDT)
          .tickFormat(dateformat);

        // create g2 before g so that its contents sit behind
        var g2 = svgkey.append("g")
          .attr("transform", "translate(45,10)")
          .attr("id", "chartgroup2")

        var g = svgkey.append("g").attr("id", "vert")
          .attr("transform", "translate(45,10)")
          // .attr("font-weight", "600")
          .style("font-family", "'open sans'")
          .style("font-size", "12px");

        d3.selectAll("path").attr("display", "none")

        g.selectAll("rect")
          .data(color.range().map(function(d, i) {
            return {
              y0: i ? y(color.domain()[i]) : y.range()[0],
              y1: i < color.domain().length ? y(color.domain()[i + 1]) : y.range()[1],
              z: d
            };
          }))
          .enter().append("rect")
          .attr("width", 8)
          .attr("x", -8)
          .attr("y", function(d) {
            return d.y1;
          })
          .attr("height", function(d) {
            return d.y0 - d.y1;
          })
          .style("fill", function(d) {
            return d.z;
          });

        g.call(yAxis).append("text");

        svgkey.append("g").attr("id", "timeaxis")
          .attr("transform", "translate(" + dvc.keyMargin.left + "," + (10 + keyheight) + ")")
          // .attr("font-weight", "600")
          .style("font-family", "'open sans'")
          .style("font-size", "12px")
          .call(xAxisTime)

        if (typeof navvalue === 'undefined') {
          linedata2 = d3.zip(variables, dvc.average[0]);
        } else {
          linedata2 = d3.zip(variables, dvc.average[navvalue]);
        };

        line2 = d3.line()
          // .defined(function(d) {
          //   console.log('undefined point');
          //   return !isNaN(d[0]);
          // })
          .x(function(d) {
            return x(dateparse(d[0]));
          })
          .y(function(d) {
            return y(d[1]);
          });

        g2.append("path")
          .attr("id", "line2")
          .style("opacity", 0.3)
          .attr("d", line2(linedata2))
          .attr("stroke", "#666")
          .attr("stroke-width", "2px")
          .attr("fill", "none");

        // add time dot for linedata2
        g2.append("circle")
          .attr("id", "currPoint2")
          .attr("r", "4px")
          .attr("cy", y(dvc.average[0][dvc.timeload])) // default position is at start time
          .attr("cx", x(dateparse(variables[a])))
          .attr("fill", "#cacaca")
          .attr("stroke", "black");

        var gannotation = g2.append("g").attr("id", "annotation-group")
        gannotation.append("line")
          .attr("id", "annotation-line")
          .attr("x1", x(dateparse("15/2/2020")))
          .attr("x2", x(dateparse("15/2/2020")))
          .attr("y1", y(-100))
          .attr("y2", y(600))
          .attr("stroke-width", 1)
          .attr("stroke", "#666")
          .attr("stroke-dasharray", 1)

        annotationText = gannotation.append("text")
          .attr("id", "annotation-text")
          .attr("font-size", "12px")
          .attr("text-anchor", "middle")
          .attr("transform", "translate(" + 55 + "," + y(300) + ")")
          .attr("fill", "#000")
          .attr("paint-order", "stroke")
          .attr("stroke", "#fff")
          .attr("stroke-width", "5px")
          .attr("stroke-linecap", "butt")
          .attr("stroke-linejoin", "miter");

        annotationText.append("tspan").text("First European")
          .attr("x", "0")
        annotationText.append("tspan").text("COVID-19 death")
          .attr("x", "0")
          .attr("dy", "1.1em")

        svgkey.append("text")
          .attr("id", "averagelabel")
          .attr("x", function(d) {
            return x(dateparse(linedata2[linedata2.length - 1][0]))
          })
          // y value of England & Wales just above line
          .attr("y", function(d) {
            return y(d3.max(dvc.average[0]))
          })
          .attr("font-size", "12px")
          .style("opacity", 0.5)
          .attr("fill", "#666")
          .attr("text-anchor", "middle")
          .text(dvc.averageText);

      } else {
        // Horizontal legend
        keyheight = 65;

        keywidth = d3.select("#keydiv").node().getBoundingClientRect().width;

        svgkey = d3.select("#keydiv")
          .append("svg")
          .attr("id", "key")
          .attr("width", keywidth)
          .attr("height", keyheight);


        xkey = d3.scaleLinear()
          .domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
          .range([0, keywidth - 30]); /*range for pixels*/

        y = d3.scaleLinear()
          .domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
          .range([0, keywidth - 30]); /*range for pixels*/

        var xAxis = d3.axisBottom(xkey)
          .tickSize(15)
          .tickValues(color.domain())
          .tickFormat(legendformat);

        var keyhor = svgkey.append("g").attr("id", "horiz")
          .attr("transform", "translate(15,30)");


        keyhor.selectAll("rect")
          .data(color.range().map(function(d, i) {

            return {
              x0: i ? xkey(color.domain()[i + 1]) : xkey.range()[0],
              x1: i < color.domain().length ? xkey(color.domain()[i + 1]) : xkey.range()[1],
              z: d
            };
          }))
          .enter().append("rect")
          .attr("class", "blocks")
          .attr("height", 8)
          .attr("x", function(d) {
            return d.x0;
          })
          .attr("width", function(d) {
            return d.x1 - d.x0;
          })
          .style("opacity", 0.8)
          .style("fill", function(d) {
            return d.z;
          });


        keyhor.append("line")
          .attr("id", "currLine")
          .attr("x1", xkey(10))
          .attr("x2", xkey(10))
          .attr("y1", -10)
          .attr("y2", 8)
          .attr("stroke-width", "2px")
          .attr("stroke", "#000")
          .attr("opacity", 0);

        keyhor.append("text")
          .attr("id", "currVal")
          .attr("x", xkey(10))
          .attr("y", -15)
          .attr("fill", "#000")
          .text("");



        keyhor.selectAll("rect")
          .data(color.range().map(function(d, i) {
            return {
              x0: i ? xkey(color.domain()[i]) : xkey.range()[0],
              x1: i < color.domain().length ? xkey(color.domain()[i + 1]) : xkey.range()[1],
              z: d
            };
          }))
          .attr("x", function(d) {
            return d.x0;
          })
          .attr("width", function(d) {
            return d.x1 - d.x0;
          })
          .style("fill", function(d) {
            return d.z;
          });

        keyhor.append('g').classed("xaxis", true)
          .call(xAxis)
          .append("text")
          .attr("id", "caption")
          .attr("x", -63)
          .attr("y", -20)
          .text("");

        keyhor.append("rect")
          .attr("id", "keybar")
          .attr("width", 8)
          .attr("height", 0)
          .attr("transform", "translate(15,0)")
          .style("fill", "#ccc")
          .attr("x", xkey(0));

        d3.select("#keydiv")
          .append("p")
          .attr("id", "keyunit")
          .style("text-align", "right")
          // .style("margin-top", "-10px")
          // .style("margin-left", "10px") // for when text-align is not set to right
          // .style("margin-right", "10px")
          .text(dvc.varunit);


        if (dvc.dropticks) {
          d3.select("#timeaxis").selectAll("text").attr("transform", function(d, i) {
            // if there are more that 4 breaks, so > 5 ticks, then drop every other.
            if (i % 2) {
              return "translate(0,10)"
            }
          });
        }
      }



    } // Ends create key

    function addFullscreen() {

      currentBody = d3.select("#map").style("height");
      d3.select(".mapboxgl-ctrl-fullscreen").on("click", setbodyheight)

    }

    function setbodyheight() {
      d3.select("#map").style("height", "100%");

      document.addEventListener('webkitfullscreenchange', exitHandler, false);
      document.addEventListener('mozfullscreenchange', exitHandler, false);
      document.addEventListener('fullscreenchange', exitHandler, false);
      document.addEventListener('MSFullscreenChange', exitHandler, false);

    }


    function exitHandler() {

      if (document.webkitIsFullScreen === false) {
        shrinkbody();
      } else if (document.mozFullScreen === false) {
        shrinkbody();
      } else if (document.msFullscreenElement === false) {
        shrinkbody();
      }
    }

    function shrinkbody() {
      d3.select("#map").style("height", currentBody);
      pymChild.sendHeight();
    }

    function geolocate() {
      dataLayer.push({
        'event': 'geoLocate',
        'selected': 'geolocate'
      })

      var options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(success, error, options);
    }

    function success(pos) {
      crd = pos.coords;

      //go on to filter
      //Translate lng lat coords to point on screen
      point = map.project([crd.longitude, crd.latitude]);

      //then check what features are underneath
      var features = map.queryRenderedFeatures(point);

      //then select area
      disableMouseEvents();

      map.setFilter("state-fills-hover", ["==", "NUTS_ID", features[0].properties.NUTS_ID]);

      selectArea(features[0].properties.NUTS_ID);
      setAxisVal(features[0].properties.NUTS_ID);
      if (mobile == false) {
        updateChart(e.features[0].properties.NUTS_ID);
      }


    };

    function setSource() {
      d3.select("#source")
        .append("h5")
        .attr("class", "source")
        .style("font-size", "14px")
        .style("fill", "#323132")
        .style("font-weight", 700)
        .text("Source: "+dvc.sourcetext)
    }

    function selectlist(datacsv) {

      var areacodes = datacsv.map(function(d) {
        return d.AREACD;
      });
      var areanames = datacsv.map(function(d) {
        return d.AREANM;
      });
      var menuarea = d3.zip(areanames, areacodes).sort(function(a, b) {
        return d3.ascending(a[0], b[0]);
      });

      // Build option menu for occupations
      var optns = d3.select("#selectNav").append("div").attr("id", "sel").append("select")
        .attr("id", "areaselect")
        .attr("style", "width:98%")
        .attr("class", "chosen-select");


      optns.append("option")


      optns.selectAll("p").data(menuarea).enter().append("option")
        .attr("value", function(d) {
          return d[1]
        })
        .text(function(d) {
          return d[0]
        });

      myId = null;

      $('#areaselect').chosen({
        placeholder_text_single: "Search for an area",
        allow_single_deselect: true
      })

      $('#areaselect').on('change', function() {

        if ($('#areaselect').val() != "") {

          selected = true;

          areacode = $('#areaselect').val()

          disableMouseEvents();

          map.setFilter("state-fills-hover", ["==", "NUTS_ID", areacode]);

          selectArea(areacode);
          setAxisVal(areacode);
          if (mobile == false) {
            updateChart(areacode);
          }
          zoomToArea(areacode);

          dataLayer.push({
            'event': 'mapDropSelect',
            'selected': areacode
          })
        } else {

          dataLayer.push({
            'event': 'deselectCross',
            'selected': 'deselect'
          })

          enableMouseEvents();
          hideaxisVal();
          onLeave();
          resetZoom();
        }

      });

    };
    pymChild.sendHeight()
  }

} else {
  //provide fallback for browsers that don't support webGL
  d3.select('#map').remove();
  d3.select('body').append('p').html("Unfortunately your browser does not support WebGL. <a href='https://www.gov.uk/help/browsers' target='_blank>'>If you're able to please upgrade to a modern browser</a>")

}
