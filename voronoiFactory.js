'use strict';

function Voronoi(mapObject, geojson, legendElement, poi, options) {
    this.options = options || {};

    this.map = mapObject.map;
    this.map._initPathRoot(); // Appends an SVG layer to the map element

    _.defaults(this.options, {
        radius: 3000,
        lineWidth: 0.5,
        opacity: 0.5,
        fill: '#94d931',
        scaleField: "",
        idField: undefined,
        colors: ["#2c7bb6", "#00a6ca", "#00ccbc", "#90eb9d", "#ffff8c", "#f9d057", "#f29e2e", "#e76818", "#d7191c"]
    });

    this.destroy = () => {
      svg.html("");
    }

    this.points = poi;

    var svg = d3.select("#" + this.map._container.id).select("svg");

    svg.html(""); //Clears the SVG element of the previous drawing.

    var width = svg.attr("width"),
        height = svg.attr("height");

    var z = d3.scaleQuantile()
        .range(this.options.colors)
        .domain(d3.extent(this.points, (d) => { return d[this.options.scaleField] }));
    /*

    Legend section

    */
    if (legendElement) {

      var legend = d3.select("#" + legendElement).html("");

      var legendWidth = $("#" + legendElement).css("width").split("px")[0],
          legendHeight = $("#" + legendElement).css("height").split("px")[0];

      legend = legend.append("svg")
          .attr("width", legendWidth)
          .attr("height", legendHeight)
          .selectAll(".voronoi_legend_squares")
          .data([0].concat(z.quantiles()), (d) => { return d; })
          .enter().append("g")
          .attr("class", "voronoi_legend_squares");

      legend.append("rect")
          .attr("width", legendWidth / this.options.colors.length)
          .attr("height", legendWidth / this.options.colors.length)
          .style("fill", (d, i) => { return this.options.colors[i]; })
          .attr("opacity", this.options.opacity)
          .attr("x", (d, i) => { return (legendWidth / this.options.colors.length) * i; });

      legend.append("text")
          .attr("class", "voronoi_legend_text")
          .filter((d, i) => { //Returns only the first and last labels
              switch (i) {
                  case 0:
                  case this.options.colors.length - 1:
                      return true;
              }
          })
          .text((d) => { return Math.round(d).toLocaleString() })
          .style("font-size", "0.65em")
          .attr("text-anchor", (d, i) => { return i === 0 ? "start" : "end" })
          .attr("x", (d, i) => {
              return legendWidth * i;
          })
          .attr("y", legendHeight - 5);
    }


    /*

    End Legend Section

    */
    this.getVoronoiInfo = (data) => {
        var datarray = [];
        Object.values(data).map((point, i) => {
            var latLng = new L.LatLng(point.latitude, point.longitude);
            var inMapPoints = this.map.latLngToLayerPoint(latLng);

            datarray.push([inMapPoints.x, inMapPoints.y]);
        });
        return datarray;
    }

    this.getGeoJSONInfo = (data) => {
        var datarray = [];
        data.map((point, i) => {
            var latLng = new L.LatLng(point[1], point[0]);
            var inMapPoints = this.map.latLngToLayerPoint(latLng);

            datarray.push([inMapPoints.x, inMapPoints.y]);
        });
        return datarray;
    }

    this.vorPoints = this.getVoronoiInfo(this.points);

    var transform = d3.geoTransform({
        point: projectPoint
    });

    var path = d3.geoPath().projection(transform);

    var getMap = () => {
        return this.map;
    }

    function projectPoint(x, y) {
        var map = getMap();
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

    var bounds = path.bounds(geojson);

    // Zooms and centers the map to the feature of interest
    // this.map.fitBounds(new L.latLngBounds(this.map.layerPointToLatLng(bounds[0]), this.map.layerPointToLatLng(bounds[1])));

    var voronoi = d3.voronoi()
        .extent(bounds);

    var geojsonMask = svg.append("defs")
          .append("clipPath")
          .attr("id", "geojson_outline")
          .append("path")
          .data(geojson.features)
          .attr("d", path)

    var circle = svg.selectAll("g")
        .data(this.points)
        .enter().append("g");

    var cell = circle.append("path")
        .data(voronoi.polygons(this.vorPoints))
        .attr("fill", "transparent")
        .attr("id", function (d, i) {
            return "cell-" + i;
        });

    circle.append("clipPath")
        .attr("id", function (d, i) {
            return "clip-" + i;
        })
        .append("use")
        .attr("xlink:href", function (d, i) {
            return "#cell-" + i;
        });

    var polygon = svg.append("g")
        .attr("clip-path", "url(#geojson_outline)")
        .attr("class", "polygons")
        .selectAll("path")
        .data(voronoi.polygons(this.vorPoints))
        .enter().append("path")

    var site = svg.append("g")
        .attr("clip-path", "url(#geojson_outline)")
        .attr("class", "sites")
        .selectAll("circle")
        .data(this.vorPoints)
        .enter().append("circle")
        .attr("stroke", "black")
        .attr("stroke-width", this.options.lineWidth)
        .attr("fill", (d, i) => {
            return z(this.points[i][this.options.scaleField])
        })
        .attr("id", (d, i) => {
            return "circle_" + ( this.options.idField ? this.points[i][this.options.idField] : i);
        })
        .attr("clip-path", function (d, i) {
            return "url(#clip-" + i + ")";
        })
        .on("click", (d, i) => {
            let site = this.points[i];
            return this.getSite(d, i, site);
        })
        .attr("r", 0);

    this.redrawSites = (site) => {
        site
            .attr("cx", function (d) {
                return d[0];
            })
            .attr("cy", function (d) {
                return d[1];
            })
            .transition(50)
            .delay(function (d, i) {
                return i * 5;
            })
            .attr("r", (d) => {
                var latLng = this.map.layerPointToLatLng(d);

                var radius = Math.pow(2, this.map.getZoom(2) + 8) / 40075016.686 * Math.abs(Math.cos(latLng.lat * Math.PI / 180)) * this.options.radius; //Calculates the pixels/meter according to the equation S = C * cos(y) / 2^ (z+8) where C = circumference of the earth (in meters), y is the latitude (in radians) and z is the zoom level

                return radius;
            })
            .attr("opacity", (d, i) => {
                let opaque = true;

                for (var filter in this.options.filtersOver) {
                    if (this.points[i][filter] < this.options.filtersOver[filter]) {
                        opaque = false;
                    }
                }
                for (var filter in this.options.filtersUnder) {
                    if (this.points[i][filter] > this.options.filtersUnder[filter]) {
                        opaque = false;
                    }
                }

                return !opaque ? 0 : this.options.opacity;
            });
    }

    function redrawPolygons(polygon) {


        polygon
            .attr("d", (d, i) => {
                return d ? "M" + d.join("L") + "Z" : null;
            });
    }

    this.changeBuffer = (buffer) => {
        this.points = buffer;

        this.redraw();
    };



    this.redraw = () => {

        var diagram;

        transform = d3.geoTransform({
            point: projectPoint
        });

        bounds = path.bounds(geojson);

        voronoi = d3.voronoi()
            .extent(bounds);

        this.vorPoints = this.getVoronoiInfo(this.points);

        var geoPoints = this.getGeoJSONInfo(geojson.features[0].geometry.coordinates[0][0])



        cell = cell.data(voronoi.polygons(this.vorPoints)).call(redrawPolygons);
        polygon = polygon.data(voronoi.polygons(this.vorPoints)).call(redrawPolygons);
        site = site.data(this.vorPoints).call(this.redrawSites);
        geojsonMask = geojsonMask.data(geojson.features).attr("d", path)
    };


    this.getSite = (d, i) => {
        return (d, i, this.points[i]);
    }

    this.applyFilters = () => {
        return this.redraw;
    }

    this.redraw();
}
