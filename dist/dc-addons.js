/*!
 * dc-addons v0.10.1
 *
 * 2015-08-11 09:50:04
 *
 */
(function () {
    'use strict';

    dc.baseMapChart = function (_chart) {
        _chart = dc.baseChart(_chart);

        var _map;

        var _renderPopup = true;
        var _mapOptions = false;
        var _defaultCenter = false;
        var _defaultZoom = false;
        var _brushOn = false;

        var _tiles = function (map) {
            L.tileLayer(
                'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
                {
                    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                }
            ).addTo(map);
        };

        var _popup = function (d) {
            return _chart.title()(d);
        };

        _chart._doRender = function () {
            // abstract
        };

        _chart._postRender = function () {
            // abstract
        };

        _chart.toLocArray = function () {
            // abstract
        };

        _chart.mapOptions = function (_) {
            if (!arguments.length) {
                return _mapOptions;
            }

            _mapOptions = _;
            return _chart;
        };

        _chart.center = function (_) {
            if (!arguments.length) {
                return _defaultCenter;
            }

            _defaultCenter = _;
            return _chart;
        };

        _chart.zoom = function (_) {
            if (!arguments.length) {
                return _defaultZoom;
            }

            _defaultZoom = _;
            return _chart;
        };

        _chart.tiles = function (_) {
            if (!arguments.length) {
                return _tiles;
            }

            _tiles = _;
            return _chart;
        };

        _chart.map = function (_) {
            if (!arguments.length) {
                return _map;
            }

            _map = _;
            return _map;
        };

        _chart.popup = function (_) {
            if (!arguments.length) {
                return _popup;
            }

            _popup = _;
            return _chart;
        };

        _chart.renderPopup = function (_) {
            if (!arguments.length) {
                return _renderPopup;
            }

            _renderPopup = _;
            return _chart;
        };

        _chart.brushOn = function (_) {
            if (!arguments.length) {
                return _brushOn;
            }

            _brushOn = _;
            return _chart;
        };

        return _chart;
    };
})();

(function () {
    'use strict';

    dc.baseLeafletChart = function (_chart) {
        _chart = dc.baseMapChart(_chart);

        _chart._doRender = function () {
            var _map = L.map(_chart.root().node(), _chart.mapOptions());

            if (_chart.center() && _chart.zoom()) {
                _map.setView(_chart.toLocArray(_chart.center()), _chart.zoom());
            }

            _chart.tiles()(_map);

            _chart.map(_map);

            _chart._postRender();

            return _chart._doRedraw();
        };

        _chart.toLocArray = function (value) {
            if (typeof value === 'string') {
                // expects '11.111,1.111'
                value = value.split(',');
            }
            // else expects [11.111,1.111]
            return value;
        };

        return _chart;
    };
})();

(function () {
    'use strict';

    dc.leafletChoroplethChart = function (parent, chartGroup) {
        var _chart = dc.colorChart(dc.baseLeafletChart({}));

        var _geojsonLayer = false;
        var _dataMap = [];

        var _geojson = false;
        var _featureOptions = {
            fillColor: 'black',
            color: 'gray',
            opacity: 0.4,
            fillOpacity: 0.6,
            weight: 1
        };

        var _featureKey = function (feature) {
            return feature.key;
        };

        var _featureStyle = function (feature) {
            var options = _chart.featureOptions();
            if (options instanceof Function) {
                options = options(feature);
            }
            options = JSON.parse(JSON.stringify(options));
            var v = _dataMap[_chart.featureKeyAccessor()(feature)];
            if (v && v.d) {
                options.fillColor = _chart.getColor(v.d, v.i);
                if (_chart.filters().indexOf(v.d.key) !== -1) {
                    options.opacity = 0.8;
                    options.fillOpacity = 1;
                }
            }
            return options;
        };

        _chart._postRender = function () {
            _geojsonLayer = L.geoJson(_chart.geojson(), {
                style: _chart.featureStyle(),
                onEachFeature: processFeatures
            });
            _chart.map().addLayer(_geojsonLayer);
        };

        _chart._doRedraw = function () {
            _geojsonLayer.clearLayers();
            _dataMap = [];
            _chart._computeOrderedGroups(_chart.data()).forEach(function (d, i) {
                _dataMap[_chart.keyAccessor()(d)] = {d: d, i: i};
            });
            _geojsonLayer.addData(_chart.geojson());
        };

        _chart.geojson = function (_) {
            if (!arguments.length) {
                return _geojson;
            }

            _geojson = _;
            return _chart;
        };

        _chart.featureOptions = function (_) {
            if (!arguments.length) {
                return _featureOptions;
            }

            _featureOptions = _;
            return _chart;
        };

        _chart.featureKeyAccessor = function (_) {
            if (!arguments.length) {
                return _featureKey;
            }

            _featureKey = _;
            return _chart;
        };

        _chart.featureStyle = function (_) {
            if (!arguments.length) {
                return _featureStyle;
            }

            _featureStyle = _;
            return _chart;
        };

        var processFeatures = function (feature, layer) {
            var v = _dataMap[_chart.featureKeyAccessor()(feature)];
            if (v && v.d) {
                layer.key = v.d.key;

                if (_chart.renderPopup()) {
                    layer.bindPopup(_chart.popup()(v.d, feature));
                }

                if (_chart.brushOn()) {
                    layer.on('click', selectFilter);
                }
            }
        };

        var selectFilter = function (e) {
            if (!e.target) {
                return;
            }

            var filter = e.target.key;
            dc.events.trigger(function () {
                _chart.filter(filter);
                dc.redrawAll(_chart.chartGroup());
            });
        };

        return _chart.anchor(parent, chartGroup);
    };
})();

(function () {
    'use strict';

    dc.leafletMarkerChart = function (parent, chartGroup) {
        var _chart = dc.baseLeafletChart({});

        var _cluster = false; // requires leaflet.markerCluster
        var _clusterOptions = false;
        var _rebuildMarkers = false;
        var _brushOn = true;
        var _filterByArea = false;
        var _fitOnRender = true;
        var _fitOnRedraw = false;
        var _disableFitOnRedraw = false;

        var _innerFilter = false;
        var _zooming = false;
        var _layerGroup = false;
        var _markerList = [];
        var _markerListFilterd = [];
        var _currentGroups = false;

        _chart.renderTitle(true);

        var _location = function (d) {
            return _chart.keyAccessor()(d);
        };

        var _marker = function (d) {
            var marker = new L.Marker(
                _chart.toLocArray(_chart.locationAccessor()(d)),
                    {
                        title: _chart.renderTitle() ? _chart.title()(d) : '',
                        alt: _chart.renderTitle() ? _chart.title()(d) : '',
                        icon: _icon(),
                        clickable: _chart.renderPopup() || (_chart.brushOn() && !_filterByArea),
                        draggable: false
                    }
                );

            return marker;
        };

        var _icon = function () {
            return new L.Icon.Default();
        };

        _chart._postRender = function () {
            if (_chart.brushOn()) {
                if (_filterByArea) {
                    _chart.filterHandler(doFilterByArea);
                }

                _chart.map().on('zoomend moveend', zoomFilter, this);

                if (!_filterByArea) {
                    _chart.map().on('click', zoomFilter, this);
                }

                _chart.map().on('zoomstart', zoomStart, this);
            }

            if (_cluster) {
                _layerGroup = new L.MarkerClusterGroup(_clusterOptions ? _clusterOptions : null);
            } else {
                _layerGroup = new L.LayerGroup();
            }

            _chart.map().addLayer(_layerGroup);
        };

        _chart._doRedraw = function () {
            var groups = _chart._computeOrderedGroups(_chart.data()).filter(function (d) {
                return _chart.valueAccessor()(d) !== 0;
            });

            _currentGroups = groups;

            if (_rebuildMarkers) {
                _markerList = [];
            }

            _layerGroup.clearLayers();

            var addList = [];
            var featureGroup = [];
            _markerListFilterd = [];

            groups.forEach(function (v) {
                if (v.value) {
                    var key = _chart.keyAccessor()(v);
                    var marker = null;

                    if (!_rebuildMarkers && key in _markerList) {
                        marker = _markerList[key];
                    } else {
                        marker = createmarker(v, key);
                    }

                    featureGroup.push(marker);

                    if (!_chart.cluster()) {
                        _layerGroup.addLayer(marker);
                    } else {
                        addList.push(marker);
                    }

                    _markerListFilterd.push(marker);
                }
            });

            if (_chart.cluster() && addList.length > 0) {
                _layerGroup.addLayers(addList);
            }

            if (featureGroup.length) {
                if (_fitOnRender || (_fitOnRedraw && !_disableFitOnRedraw)) {
                    featureGroup = new L.featureGroup(featureGroup);
                    _chart.map().fitBounds(featureGroup.getBounds());//.pad(0.5));
                }
            }

            _disableFitOnRedraw = false;
            _fitOnRender = false;
        };

        _chart.locationAccessor = function (_) {
            if (!arguments.length) {
                return _location;
            }

            _location =  _;
            return _chart;
        };

        _chart.marker = function (_) {
            if (!arguments.length) {
                return _marker;
            }

            _marker = _;
            return _chart;
        };

        _chart.icon = function (_) {
            if (!arguments.length) {
                return _icon;
            }

            _icon = _;
            return _chart;
        };

        _chart.cluster = function (_) {
            if (!arguments.length) {
                return _cluster;
            }

            _cluster = _;
            return _chart;
        };

        _chart.clusterOptions = function (_) {
            if (!arguments.length) {
                return _clusterOptions;
            }

            _clusterOptions = _;
            return _chart;
        };

        _chart.rebuildMarkers = function (_) {
            if (!arguments.length) {
                return _rebuildMarkers;
            }

            _rebuildMarkers = _;
            return _chart;
        };

        _chart.brushOn = function (_) {
            if (!arguments.length) {
                return _brushOn;
            }

            _brushOn = _;
            return _chart;
        };

        _chart.filterByArea = function (_) {
            if (!arguments.length) {
                return _filterByArea;
            }

            _filterByArea = _;
            return _chart;
        };

        _chart.fitOnRender = function (_) {
            if (!arguments.length) {
                return _fitOnRender;
            }

            _fitOnRender = _;
            return _chart;
        };

        _chart.fitOnRedraw = function (_) {
            if (!arguments.length) {
                return _fitOnRedraw;
            }

            _fitOnRedraw = _;
            return _chart;
        };

        _chart.markerGroup = function () {
            return _layerGroup;
        };

        _chart.markers = function (filtered) {
            if (filtered) {
                return _markerListFilterd;
            }

            return _markerList;
        };

        var createmarker = function (v, k) {
            var marker = _marker(v);
            marker.key = k;

            if (_chart.renderPopup()) {
                marker.bindPopup(_chart.popup()(v, marker));
            }

            if (_chart.brushOn() && !_filterByArea) {
                marker.on('click', selectFilter);
            }

            _markerList[k] = marker;

            return marker;
        };

        var zoomStart = function () {
            _zooming = true;
        };

        var zoomFilter = function (e) {
            if (e.type === 'moveend' && (_zooming || e.hard)) {
                return;
            }

            _zooming = false;

            _disableFitOnRedraw = true;

            if (_filterByArea) {
                var filter;
                if (_chart.map().getCenter().equals(_chart.center()) && _chart.map().getZoom() === _chart.zoom()) {
                    filter = null;
                } else {
                    filter = _chart.map().getBounds();
                }

                dc.events.trigger(function () {
                    _chart.filter(null);

                    if (filter) {
                        _innerFilter = true;
                        _chart.filter(filter);
                        _innerFilter = false;
                    }

                    dc.redrawAll(_chart.chartGroup());
                });
            } else if (
                _chart.filter() &&
                (
                    e.type === 'click' ||
                    (
                        _chart.filter() in _markerList &&
                        !_chart.map().getBounds().contains(_markerList[_chart.filter()].getLatLng())
                    )
                )
            ) {
                dc.events.trigger(function () {
                    _chart.filter(null);
                    if (_chart.renderPopup()) {
                        _chart.map().closePopup();
                    }

                    dc.redrawAll(_chart.chartGroup());
                });
            }
        };

        var doFilterByArea = function (dimension, filters) {
            _disableFitOnRedraw = true;
            _chart.dimension().filter(null);

            if (filters && filters.length > 0) {
                _chart.dimension().filter(function (d) {
                    if (!(d in _markerList)) {
                        return false;
                    }
                    var locO = _markerList[d].getLatLng();
                    return locO && filters[0].contains(locO);
                });

                if (!_innerFilter && _chart.map().getBounds().toString !== filters[0].toString()) {
                    _chart.map().fitBounds(filters[0]);
                }
            }
        };

        var selectFilter = function (e) {
            if (!e.target) {
                return;
            }

            _disableFitOnRedraw = true;
            var filter = e.target.key;

            dc.events.trigger(function () {
                _chart.filter(filter);
                dc.redrawAll(_chart.chartGroup());
            });
        };

        return _chart.anchor(parent, chartGroup);
    };
})();

(function () {
    'use strict';

    dc.baseGoogleChart = function (_chart) {
        _chart = dc.baseMapChart(_chart);

        _chart._doRender = function () {
            var _map = new google.maps.Map(_chart.root().node(), _chart.mapOptions());

            if (_chart.center() && _chart.zoom()) {
                _map.setCenter(_chart.toLocArray(_chart.center()));
                _map.setZoom(_chart.zoom());
            }

            _chart.map(_map);

            _chart._postRender();

            return _chart._doRedraw();
        };

        _chart.toLocArray = function (value) {
            if (typeof value === 'string') {
                // expects '11.111,1.111'
                value = value.split(',');
            }

            // else expects [11.111,1.111]
            return new google.maps.LatLng(value[0], value[1]);
        };

        return _chart;
    };
})();

(function () {
    'use strict';

    dc.googleChoroplethChart = function (parent, chartGroup) {
        var _chart = dc.colorChart(dc.baseGoogleChart({}));

        var _dataMap = [];

        var _geojson = false;
        var _feature = false;
        var _featureOptions = {
            fillColor: 'black',
            color: 'gray',
            opacity: 0.4,
            fillOpacity: 0.6,
            weight: 1
        };
        var _infoWindow = null;

        var _featureKey = function (feature) {
            return feature.key;
        };

        var _featureStyle = function (feature) {
            var options = _chart.featureOptions();
            if (options instanceof Function) {
                options = options(feature);
            }
            options = JSON.parse(JSON.stringify(options));
            var v = _dataMap[_chart.featureKeyAccessor()(feature)];
            if (v && v.d) {
                options.fillColor = _chart.getColor(v.d, v.i);
                if (_chart.filters().indexOf(v.d.key) !== -1) {
                    options.opacity = 0.8;
                    options.fillOpacity = 1;
                }
            }
            return options;
        };

        _chart._postRender = function () {
            if (typeof _geojson === 'string') {
                _feature = _chart.map().data.loadGeoJson(_geojson);
            } else {
                _feature = _chart.map().data.addGeoJson(_geojson);
            }

            _chart.map().data.setStyle(_chart.featureStyle());
            processFeatures();
        };

        _chart._doRedraw = function () {
            _dataMap = [];
            _chart._computeOrderedGroups(_chart.data()).forEach(function (d, i) {
                _dataMap[_chart.keyAccessor()(d)] = {d: d, i: i};
            });
            _chart.map().data.setStyle(_chart.featureStyle());
        };

        _chart.geojson = function (_) {
            if (!arguments.length) {
                return _geojson;
            }

            _geojson = _;
            return _chart;
        };

        _chart.featureOptions = function (_) {
            if (!arguments.length) {
                return _featureOptions;
            }

            _featureOptions = _;
            return _chart;
        };

        _chart.featureKeyAccessor = function (_) {
            if (!arguments.length) {
                return _featureKey;
            }

            _featureKey = _;
            return _chart;
        };

        _chart.featureStyle = function (_) {
            if (!arguments.length) {
                return _featureStyle;
            }

            _featureStyle = _;
            return _chart;
        };

        var processFeatures = function (feature, layer) {
            if (_chart.renderPopup()) {
                _chart.map().data.addListener('click', function (event) {
                    var anchor = new google.maps.MVCObject(),
                        data = _dataMap[_chart.featureKeyAccessor()(event.feature)];

                    if (_infoWindow) {
                        _infoWindow.close();
                    }

                    if (!data) {
                        data = {};
                    }

                    if (!data.d) {
                        data.d = {};
                    }

                    _infoWindow = new google.maps.InfoWindow({
                        content: _chart.popup()(data.d, event.feature)
                    });

                    anchor.set('position', event.latLng);
                    _infoWindow.open(_chart.map(), anchor);
                });
            }

            if (_chart.brushOn()) {
                _chart.map().data.addListener('click', selectFilter);
            }
        };

        var selectFilter = function (event) {
            console.log(event);
            if (!event.feature) {
                return;
            }

            var filter = _chart.featureKeyAccessor()(event.feature);

            dc.events.trigger(function () {
                _chart.filter(filter);
                dc.redrawAll(_chart.chartGroup());
            });
        };

        return _chart.anchor(parent, chartGroup);
    };
})();

(function () {
    'use strict';

    dc.googleMarkerChart = function (parent, chartGroup) {
        var _chart = dc.baseGoogleChart({});

        var _cluster = false; // requires js-marker-clusterer
        var _clusterOptions = false;
        var _rebuildMarkers = false;
        var _brushOn = true;
        var _filterByArea = false;
        var _fitOnRender = true;
        var _fitOnRedraw = false;
        var _disableFitOnRedraw = false;

        var _innerFilter = false;
        var _layerGroup = false;
        var _markerList = [];
        var _markerListFilterd = [];
        var _currentGroups = false;
        var _icon = false;

        _chart.renderTitle(true);

        var _location = function (d) {
            return _chart.keyAccessor()(d);
        };

        var _marker = function (d) {
            var marker = new google.maps.Marker({
                position: _chart.toLocArray(_chart.locationAccessor()(d)),
                map: _chart.map(),
                title: _chart.renderTitle() ? _chart.title()(d) : '',
                clickable: _chart.renderPopup() || (_chart.brushOn() && !_filterByArea),
                draggable: false
            });

            return marker;
        };

        _chart._postRender = function () {
            if (_chart.brushOn()) {
                if (_filterByArea) {
                    _chart.filterHandler(doFilterByArea);
                }

                google.maps.event.addListener(_chart.map(), 'zoom_changed', function () {
                    zoomFilter('zoom');
                }, this);
                google.maps.event.addListener(_chart.map(), 'dragend', function () {
                    zoomFilter('drag');
                }, this);

                if (!_filterByArea) {
                    google.maps.event.addListener(_chart.map(), 'click', function () {
                        zoomFilter('click');
                    }, this);
                }
            }

            if (_cluster) {
                _layerGroup = new MarkerClusterer(_chart.map());
            } else {
                _layerGroup = new google.maps.OverlayView();
                _layerGroup.setMap(_chart.map());
            }
        };

        _chart._doRedraw = function () {
            var groups = _chart._computeOrderedGroups(_chart.data()).filter(function (d) {
                return _chart.valueAccessor()(d) !== 0;
            });

            _currentGroups = groups;

            if (_rebuildMarkers) {
                _markerList = [];
            }

            _layerGroup.clearMarkers();

            var addList = [];
            var featureGroup = [];
            var bounds = new google.maps.LatLngBounds();
            _markerListFilterd = [];

            groups.forEach(function (v) {
                var key = _chart.keyAccessor()(v);
                var marker = null;

                if (!_rebuildMarkers && key in _markerList) {
                    marker = _markerList[key];
                }

                if (v.value) {
                    if (marker === null) {
                        marker = createmarker(v, key);
                    } else {
                        marker.setVisible(true);
                    }

                    bounds.extend(marker.getPosition());
                    featureGroup.push(marker);

                    if (!_chart.cluster()) {
                        _layerGroup.addMarker(marker);
                    } else {
                        addList.push(marker);
                    }

                    _markerListFilterd.push(marker);
                } else {
                    if (marker !== null) {
                        marker.setVisible(false);
                    }
                }
            });

            if (_chart.cluster() && addList.length > 0) {
                _layerGroup.addMarkers(addList);

            }

            if (featureGroup.length) {
                if (_fitOnRender || (_fitOnRedraw && !_disableFitOnRedraw)) {
                    _chart.map().fitBounds(bounds);
                }
            }

            _disableFitOnRedraw = false;
            _fitOnRender = false;
        };

        _chart.locationAccessor = function (_) {
            if (!arguments.length) {
                return _location;
            }

            _location =  _;
            return _chart;
        };

        _chart.marker = function (_) {
            if (!arguments.length) {
                return _marker;
            }

            _marker = _;
            return _chart;
        };

        _chart.icon = function (_) {
            if (!arguments.length) {
                return _icon;
            }

            _icon = _;
            return _chart;
        };

        _chart.cluster = function (_) {
            if (!arguments.length) {
                return _cluster;
            }

            _cluster = _;
            return _chart;
        };

        _chart.clusterOptions = function (_) {
            if (!arguments.length) {
                return _clusterOptions;
            }

            _clusterOptions = _;
            return _chart;
        };

        _chart.rebuildMarkers = function (_) {
            if (!arguments.length) {
                return _rebuildMarkers;
            }

            _rebuildMarkers = _;
            return _chart;
        };

        _chart.brushOn = function (_) {
            if (!arguments.length) {
                return _brushOn;
            }

            _brushOn = _;
            return _chart;
        };

        _chart.filterByArea = function (_) {
            if (!arguments.length) {
                return _filterByArea;
            }

            _filterByArea = _;
            return _chart;
        };

        _chart.fitOnRender = function (_) {
            if (!arguments.length) {
                return _fitOnRender;
            }

            _fitOnRender = _;
            return _chart;
        };

        _chart.fitOnRedraw = function (_) {
            if (!arguments.length) {
                return _fitOnRedraw;
            }

            _fitOnRedraw = _;
            return _chart;
        };

        _chart.markerGroup = function () {
            return _layerGroup;
        };

        _chart.markers = function (filtered) {
            if (filtered) {
                return _markerListFilterd;
            }

            return _markerList;
        };

        var createmarker = function (v, k) {
            var marker = _marker(v);
            marker.key = k;

            if (_chart.renderPopup()) {
                google.maps.event.addListener(marker, 'click', function () {
                    _chart.popup()(v, marker).open(_chart.map(), marker);
                });
            }

            if (_chart.brushOn() && !_filterByArea) {
                google.maps.event.addListener(marker, 'click', selectFilter);
            }

            _markerList[k] = marker;

            return marker;
        };

        var zoomFilter = function (type) {
            _disableFitOnRedraw = true;
            if (_filterByArea) {
                var filter;
                if (
                    _chart.map().getCenter().equals(_chart.toLocArray(_chart.center())) &&
                    _chart.map().getZoom() === _chart.zoom()
                ) {
                    filter = null;
                } else {
                    filter = _chart.map().getBounds();
                }

                dc.events.trigger(function () {
                    _chart.filter(null);

                    if (filter) {
                        _innerFilter = true;
                        _chart.filter(filter);
                        _innerFilter = false;
                    }

                    dc.redrawAll(_chart.chartGroup());
                });
            } else if (
                _chart.filter() &&
                (
                    type === 'click' ||
                    (
                        _chart.filter() in _markerList &&
                        !_chart.map().getBounds().contains(_markerList[_chart.filter()].getLatLng())
                    )
                )
            ) {
                dc.events.trigger(function () {
                    _chart.filter(null);
                    if (_chart.renderPopup()) {
                        _chart.map().closePopup();
                    }

                    dc.redrawAll(_chart.chartGroup());
                });
            }
        };

        var doFilterByArea = function (dimension, filters) {
            _disableFitOnRedraw = true;
            _chart.dimension().filter(null);

            if (filters && filters.length > 0) {
                _chart.dimension().filter(function (d) {
                    if (!(d in _markerList)) {
                        return false;
                    }
                    var locO = _markerList[d].position;
                    return locO && filters[0].contains(locO);
                });

                if (!_innerFilter && _chart.map().getBounds().toString !== filters[0].toString()) {
                    _chart.map().fitBounds(filters[0]);
                }
            }
        };

        var selectFilter = function (e) {
            if (!e.target) {
                return;
            }

            _disableFitOnRedraw = true;
            var filter = e.target.key;

            dc.events.trigger(function () {
                _chart.filter(filter);
                dc.redrawAll(_chart.chartGroup());
            });
        };

        return _chart.anchor(parent, chartGroup);
    };
})();

(function () {
    'use strict';

    dc.tooltipMixin = function (_chart) {

        if (_chart) {
            _chart.tip = function () {
                var selector = 'rect.bar,circle.dot,g.pie-slice path,circle.bubble,g.row rect',
                    svg = _chart.svg(),
                    tip = d3.tip()
                        .attr('class', 'tip')
                        .html(function (d) {
                            if (d.data) {
                                return _chart.title()(d.data);
                            }

                            return _chart.title()(d);
                        });

                svg.selectAll(selector).call(tip);
                svg.selectAll(selector).on('mouseover', tip.show).on('mouseleave', tip.hide);

                // remove standard tooltip
                svg.selectAll('title').remove();
            };

            _chart.tip();
        }

        return _chart;
    };
})();

// Code copied and changed from https://github.com/vlandham/gates_bubbles

(function () {
    'use strict';

    dc.bubbleCloud = function (parent, chartGroup) {
        var _chart = dc.bubbleMixin(dc.capMixin(dc.bubbleChart()));

        var LAYOUT_GRAVITY = 0.2;
        var RADIUS_TRANSITION = 1500;
        var FRICTION = 0.5;
        var PADDING = 10;
        var MIN_RADIUS = 5;

        var _force = null;
        var _circles = [];
        var _g = null;
        var _gs = null;

        _chart._doRender = function () {
            _chart.resetSvg();

            _g = _chart.svg().append('g');

            _circles = [];

            drawChart();

            return _chart;
        };

        _chart._doRedraw = function () {
            drawChart();

            return _chart;
        };

        function drawChart() {

            if (_chart.elasticRadius()) {
                _chart.r().domain([_chart.rMin(), _chart.rMax()]);
            }

            _chart.r().range([MIN_RADIUS, _chart.xAxisLength() * _chart.maxBubbleRelativeSize()]);

            if (_circles.length === 0) {
                createBubbles();
            } else {
                updateBubbles();
            }

            highlightFilter();

            _force = d3.layout.force()
                .nodes(_chart.data())
                .size([_chart.width(), _chart.height()]);

            _force
                .gravity(LAYOUT_GRAVITY)
                .charge(charge)
                .friction(FRICTION)
                .on('tick', function (e) {
                    _circles
                        .each(moveTowardsCenter(e.alpha))
                        .attr('cx', function (d) {
                            if (d.x && d.y) {
                                d3.select(this.parentNode).attr('transform', 'translate(' + d.x + ',' + d.y + ')');
                            }
                            // return d.x;
                            return 0;
                        })
                        .attr('cy', function (d) {
                            // return d.y;
                            return 0;
                        });
                });

            _force.start();
        }

        function createBubbles() {
            _gs = _g
                .selectAll('g')
                .data(_chart.data())
                .enter()
                .append('g')
                .attr('class', _chart.BUBBLE_NODE_CLASS)
                .on('click', _chart.onClick);

            _circles = _gs
                .append('circle')
                .attr('class', _chart.BUBBLE_CLASS)
                .attr('r', 0)
                .attr('fill-opacity', 1)
                .attr('fill', function (d, i) {
                    return _chart.getColor(d, i);
                })
                .attr('stroke-width', 2)
                .on('mouseenter', function (d, i) {
                    d3.select(this).attr('stroke', '#303030');
                })
                .on('mouseout', function (d, i) {
                    d3.select(this).attr('stroke', 'none');
                });

            _chart._doRenderLabel(_gs);
            _chart._doRenderTitles(_gs);

            _circles.transition().duration(RADIUS_TRANSITION).attr('r', function (d) {
                d.radius = _chart.bubbleR(d);
                d.x = Math.random() * _chart.width();
                d.y = Math.random() * _chart.height();
                return d.radius;
            });
        }

        function updateBubbles() {
            _circles.data(_chart.data())
                .attr('r', function (d) {
                    d.radius = _chart.bubbleR(d);
                    return d.radius;
                });

            _chart.doUpdateLabels(_gs);
            _chart.doUpdateTitles(_gs);
        }

        function moveTowardsCenter(alpha) {
            var quadtree = d3.geom.quadtree(_chart.data());

            return function (d) {
                var r = d.radius + d3.max(_chart.data().map(function (d) { return d.radius; })) + PADDING,
                nx1 = d.x - r,
                nx2 = d.x + r,
                ny1 = d.y - r,
                ny2 = d.y + r;

                quadtree.visit(function (quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== d)) {
                        var x = d.x - quad.point.x,
                            y = d.y - quad.point.y,
                            l = Math.sqrt(x * x + y * y),
                            r = d.radius + quad.point.radius + PADDING;

                        if (l < r) {
                            l = (l - r) / l * alpha;
                            d.x -= x *= l;
                            d.y -= y *= l;
                            quad.point.x += x;
                            quad.point.y += y;
                        }
                    }

                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                });
            };
        }

        function charge(d) {
            return -Math.pow(d.radius, 2.0) / 8;
        }

        function highlightFilter() {
            if (_chart.hasFilter()) {
                _gs.each(function (d) {
                    if (_chart.hasFilter(_chart.keyAccessor()(d))) {
                        _chart.highlightSelected(this);
                    } else {
                        _chart.fadeDeselected(this);
                    }
                });
            } else {
                _gs.each(function () {
                    _chart.resetHighlight(this);
                });
            }
        }

        return _chart.anchor(parent, chartGroup);
    };
})();

(function () {
    'use strict';

    dc.pairedRowChart = function (parent, chartGroup) {
        var _chart = dc.capMixin(dc.marginMixin(dc.colorMixin(dc.baseMixin({}))));

        var _leftChartWrapper = d3.select(parent).append('div');
        var _rightChartWrapper = d3.select(parent).append('div');

        var _leftChart = dc.rowChart(_leftChartWrapper[0][0], chartGroup);
        var _rightChart = dc.rowChart(_rightChartWrapper[0][0], chartGroup);

        _leftChart.useRightYAxis(true);

        // data filtering

        // we need a way to know which data belongs on the left chart and which data belongs on the right
        var _leftKeyFilter = function (d) {
            return d.key[0];
        };

        var _rightKeyFilter = function (d) {
            return d.key[0];
        };

        /**
        #### .leftKeyFilter([value]) - **mandatory**
        Set or get the left key filter attribute of a chart.

        For example
        function (d) {
            return d.key[0] === 'Male';
        }

        If a value is given, then it will be used as the new left key filter. If no value is specified then
        the current left key filter will be returned.

        **/
        _chart.leftKeyFilter = function (_) {
            if (!arguments.length) {
                return _leftKeyFilter;
            }

            _leftKeyFilter = _;
            return _chart;
        };

        /**
        #### .rightKeyFilter([value]) - **mandatory**
        Set or get the right key filter attribute of a chart.

        For example
        function (d) {
            return d.key[0] === 'Female';
        }

        If a value is given, then it will be used as the new right key filter. If no value is specified then
        the current right key filter will be returned.

        **/
        _chart.rightKeyFilter = function (_) {
            if (!arguments.length) {
                return _rightKeyFilter;
            }

            _rightKeyFilter = _;
            return _chart;
        };

        // when trying to get the data for the left chart then filter all data using the leftKeyFilter function
        _leftChart.data(function (data) {
            var cap = _leftChart.cap(),
                d = data.all().filter(function (d) {
                return _chart.leftKeyFilter()(d);
            });

            if (cap === Infinity) {
                return d;
            }

            return d.slice(0, cap);
        });

        // when trying to get the data for the right chart then filter all data using the rightKeyFilter function
        _rightChart.data(function (data) {
            var cap = _rightChart.cap(),
                d = data.all().filter(function (d) {
                return _chart.rightKeyFilter()(d);
            });

            if (cap === Infinity) {
                return d;
            }

            return d.slice(0, cap);
        });

        // chart filtering
        // on clicking either chart then filter both

        _leftChart.onClick = _rightChart.onClick = function (d) {
            var filter = _leftChart.keyAccessor()(d);
            dc.events.trigger(function () {
                _leftChart.filter(filter);
                _rightChart.filter(filter);
                _leftChart.redrawGroup();
            });
        };

        // margins
        // the margins between the charts need to be set to 0 so that they sit together

        var _margins = _chart.margins(); // get the default margins

        _chart.margins = function (_) {
            if (!arguments.length) {
                return _margins;
            }
            _margins = _;

            // set left chart margins
            _leftChart.margins({
                top: _.top,
                right: 0,
                bottom: _.bottom,
                left: _.left,
            });

            // set right chart margins
            _rightChart.margins({
                top: _.top,
                right: _.right,
                bottom: _.bottom,
                left: 0,
            });

            return _chart;
        };

        _chart.margins(_margins); // set the new margins

        // svg
        // return an array of both the sub chart svgs

        _chart.svg = function () {
            return d3.selectAll([_leftChart.svg()[0][0], _rightChart.svg()[0][0]]);
        };

        // data
        // we need to make sure that the extent is the same for both charts

        // this way we need a new function that is overridable
        if (_leftChart.calculateAxisScaleData) {
            _leftChart.calculateAxisScaleData = _rightChart.calculateAxisScaleData = function () {
                return _leftChart.data().concat(_rightChart.data());
            };
        // this way we can use the current dc.js library but we can't use elasticX
        } else {
            _chart.group = function (_) {
                if (!arguments.length) {
                    return _leftChart.group();
                }
                _leftChart.group(_);
                _rightChart.group(_);

                // set the new x axis scale
                var extent = d3.extent(_.all(), _chart.cappedValueAccessor);
                if (extent[0] > 0) {
                    extent[0] = 0;
                }
                _leftChart.x(d3.scale.linear().domain(extent).range([_leftChart.effectiveWidth(), 0]));
                _rightChart.x(d3.scale.linear().domain(extent).range([0, _rightChart.effectiveWidth()]));

                return _chart;
            };
        }

        // functions that we just want to pass on to both sub charts

        var _getterSetterPassOn = [
            // display
            'height', 'width', 'minHeight', 'minWidth', 'renderTitleLabel', 'fixedBarHeight', 'gap', 'othersLabel',
            'transitionDuration', 'label', 'renderLabel', 'title', 'renderTitle', 'chartGroup',
            //colors
            'colors', 'ordinalColors', 'linearColors', 'colorAccessor', 'colorDomain', 'getColor', 'colorCalculator',
            // x axis
            'x', 'elasticX', 'valueAccessor', 'labelOffsetX', 'titleLabelOffsetx',
            // y axis
            'keyAccessor', 'labelOffsetY',
            // data
            'cap', 'ordering' , 'dimension', 'group', 'othersGrouper', 'data'
        ];

        function addGetterSetterfunction (functionName) {
            _chart[functionName] = function (_) {
                if (!arguments.length) {
                    return _leftChart[functionName]();
                }
                _leftChart[functionName](_);
                _rightChart[functionName](_);
                return _chart;
            };
        }

        for (var i = 0; i < _getterSetterPassOn.length; i++) {
            addGetterSetterfunction (_getterSetterPassOn[i]);
        }

        var _passOnFunctions = [
            '_doRedraw', 'redraw', '_doRender', 'render', 'calculateColorDomain', 'filterAll', 'resetSvg', 'expireCache'
        ];

        function addPassOnFunctions(functionName) {
            _chart[functionName] = function () {
                _leftChart[functionName]();
                _rightChart[functionName]();
                return _chart;
            };
        }

        for (i = 0; i < _passOnFunctions.length; i++) {
            addPassOnFunctions(_passOnFunctions[i]);
        }

        return _chart.anchor(parent, chartGroup);
    };

})();

(function () {
    'use strict';

    if (!('dc' in window)) {
        window.dc = {};
    }

    dc.serverChart = function (parent) {
        var _chart = {},
            socket = null,
            hasInit = false,
            connected = false,
            element = d3.select(parent),
            _options = {
                name: null,
                server: 'http://127.0.0.1:3000/',
                errorMessage: 'A problem occurred creating the charts. Please try again later',
                loadingMessage: 'Loading',
                reconnectingMessage: 'There appears to be a problem connecting to the server. Retyring...',
                connectionErrorMessage: 'Could not connect to the server.',
            },
            _conditions = null,
            mouseDownCoords = null,
            east = null,
            west = null,
            prevEast = null,
            prevWest = null,
            extentMouse = false,
            resizeEastMouse = false,
            resizeWestMouse = false,
            chartWrapperClass = '.dc-server-chart';

        //---------------------
        // Browser Events
        //---------------------

        function attachEvents () {
            element.selectAll(chartWrapperClass).each(function (chartData, chartIndex) {
                var chartWrapper = d3.select(this),
                    chartType = getChartType(chartWrapper);

                if (typeof dc.serverChart['attachEvents' + chartType] === 'function') {
                    dc.serverChart['attachEvents' + chartType](chartIndex, chartWrapper);
                }
            });
        }

        dc.serverChart.attachEventsBarChart  = function (chartIndex, chartWrapper) {
            chartWrapper
                .selectAll('rect.bar')
                .on('click', function (barData, barIndex) {
                    sendFilter(chartIndex, barIndex);
                });

            attachEventsBrush(chartIndex, chartWrapper);
        };

        dc.serverChart.attachEventsPieChart = function (chartIndex, chartWrapper) {
            chartWrapper
                .selectAll('g.pie-slice')
                .on('click', function (sliceData, sliceIndex) {
                    sendFilter(chartIndex, sliceIndex);
                });
        };

        dc.serverChart.attachEventsRowChart = function (chartIndex, chartWrapper) {
            chartWrapper
                .selectAll('rect')
                .on('click', function (rowData, rowIndex) {
                    sendFilter(chartIndex, rowIndex);
                });
        };

        dc.serverChart.attachEventsPairedRowChart = function (chartIndex, chartWrapper) {
            chartWrapper
                .selectAll('svg')
                .selectAll('rect')
                .on('click', function (rowData, rowIndex, svgIndex) {
                    sendFilter(chartIndex, rowIndex * 2 - svgIndex);
                });
        };

        dc.serverChart.attachEventsLineChart = function (chartIndex, chartWrapper) {
            chartWrapper
                .selectAll('circle.dot')
                .on('mousemove', function () {
                    var dot = d3.select(this);
                    dot.style('fill-opacity', 0.8);
                    dot.style('stroke-opacity', 0.8);
                })
                .on('mouseout', function () {
                    var dot = d3.select(this);
                    dot.style('fill-opacity', 0.01);
                    dot.style('stroke-opacity', 0.01);
                });

            attachEventsBrush(chartIndex, chartWrapper);
        };

        function attachEventsBrush(chartIndex, chartWrapper) {
            if (chartWrapper.select('g.brush').size() > 0) {
                var maxEast = chartWrapper
                    .select('g.brush')
                    .select('.background')
                    .attr('width');

                chartWrapper
                    .select('g.brush')
                    .on('mousedown', function () {
                        mouseDownCoords = d3.mouse(this);
                        prevWest = west;
                        prevEast = east;
                    })
                    .on('mousemove', function () {
                        if (mouseDownCoords !== null) {
                            var coords = d3.mouse(this),
                                el = d3.select(this),
                                tmp = null;

                            if (extentMouse) {
                                var diff = coords[0] - mouseDownCoords[0];

                                west = prevWest + diff;
                                east = prevEast + diff;

                                if (west < 0) {
                                    west = 0;
                                    east = prevEast - prevWest;
                                }

                                if (east > maxEast) {
                                    east = maxEast;
                                    west = maxEast - (prevEast - prevWest);
                                }

                            } else if (resizeEastMouse) {
                                west = west;
                                east = coords[0];

                                if (east < west) {
                                    tmp = west;
                                    west = east;
                                    east = tmp;
                                    resizeEastMouse = false;
                                    resizeWestMouse = true;
                                }

                                if (west < 0) {
                                    west = 0;
                                }

                                if (east > maxEast) {
                                    east = maxEast;
                                }
                            } else if (resizeWestMouse) {
                                west = coords[0];
                                east = east;

                                if (east < west) {
                                    tmp = west;
                                    west = east;
                                    east = tmp;
                                    resizeEastMouse = true;
                                    resizeWestMouse = false;
                                }

                                if (west < 0) {
                                    west = 0;
                                }

                                if (east > maxEast) {
                                    east = maxEast;
                                }
                            } else {
                                west = d3.min([coords[0], mouseDownCoords[0]]);
                                east = d3.max([coords[0], mouseDownCoords[0]]);

                                if (west < 0) {
                                    west = 0;
                                }

                                if (east > maxEast) {
                                    east = maxEast;
                                }
                            }

                            el
                                .select('.extent')
                                .attr('x', west)
                                .attr('width', east - west);

                            el
                                .selectAll('g.resize')
                                .style('display', 'inline');

                            el
                                .select('g.resize.e')
                                .attr('transform', 'translate(' + east + ', 0)');

                            el
                                .select('g.resize.w')
                                .attr('transform', 'translate(' + west + ', 0)');
                        }
                    })
                    .on('mouseup', function () {
                        var coords = d3.mouse(this),
                            el = d3.select(this);

                        if (mouseDownCoords === null || coords[0] === mouseDownCoords[0]) {
                            el
                                .select('.extent')
                                .attr('width', 0);

                            el
                                .selectAll('g.resize')
                                .style('display', 'none');

                            sendFilter(chartIndex, [null, null]);
                        } else {
                            // somehow calculate what was selected
                            sendFilter(chartIndex, [west, east]);
                        }

                        mouseDownCoords = null;
                    });

                chartWrapper
                    .select('g.brush')
                    .select('.extent')
                    .on('mousedown', function () {
                        extentMouse = true;
                    })
                    .on('mouseup', function () {
                        extentMouse = false;
                    });

                chartWrapper
                    .select('g.brush')
                    .select('g.resize.e')
                    .on('mousedown', function () {
                        resizeEastMouse = true;
                    })
                    .on('mouseup', function () {
                        resizeEastMouse = false;
                    });

                chartWrapper
                    .select('g.brush')
                    .select('g.resize.w')
                    .on('mousedown', function () {
                        resizeWestMouse = true;
                    })
                    .on('mouseup', function () {
                        resizeWestMouse = false;
                    });
            }
        }

        //---------------------
        // Chart Events
        //---------------------

        _chart.render = function () {
            init();
            sendRender();
            return _chart;
        };

        _chart.options = function (_) {
            if (arguments.length === 0) {
                return _options;
            }

            for (var key in _) {
                if (_.hasOwnProperty(key)) {
                    _options[key] = _[key];
                }
            }

            return _chart;
        };

        _chart.conditions = function (_) {
            if (arguments.length === 0) {
                return _conditions;
            }

            _conditions = _;
            updateConditions();

            return _chart;
        };

        //---------------------
        // Socket Events
        //---------------------

        function sendFilter (chartIndex, index) {
            socket.emit('filter', [chartIndex, index]);
        }

        function sendRender () {
            onRefresh();

            if (!_options.name) {
                throw Error('Name is a required option');
            }

            socket.emit('render', _options.name);
        }

        function preRender (charts) {
            element.selectAll('*').remove();

            for (var i = 0; i < charts.length; i++) {
                element
                    .append('div')
                    .style('width', charts[i].width + 'px')
                    .style('height', charts[i].height + 'px')
                    .style('float', 'left')
                    .style('text-align', 'center')
                    .style('line-height', charts[i].height + 'px')
                    .html(_options.loadingMessage);

            }
        }

        function render (response) {
            element.html(response);
            attachEvents();
        }

        function renderError (response) {
            element.html(_options.errorMessage);
            console.warn(response);
        }

        function redraw (response) {
            var next = document.createElement('div');
            next.innerHTML = response;
            next = d3.select(next);

            element.selectAll(chartWrapperClass).each(function (el, chartIndex) {
                var chartWrapper = d3.select(this),
                    nextWrapper = next.selectAll(chartWrapperClass).filter(function (d, j) {
                        return j === chartIndex;
                    }),
                    chartType = getChartType(chartWrapper);

                if (chartType) {
                    if (typeof dc.serverChart['redraw' + chartType] === 'function') {
                        dc.serverChart['redraw' + chartType](chartIndex, chartWrapper, nextWrapper);
                    } else {
                        chartWrapper.html(nextWrapper.html());
                        attachEvents();
                    }
                }
            });
        }

        function updateConditions () {
            if (hasInit) {
                socket.emit('updateConditions', _conditions);
            }
        }

        //---------------------
        // Helper Functions
        //---------------------

        function onRefresh () {
            element.html(_options.loadingMessage);
        }

        function init () {
            socket = io(_options.server, {
                reconnectionDelay: 500,
                reconnectionDelayMax: 2000,
                reconnectionAttempts: 4,
            });

            // socket events
            socket.io.on('open', function () {
                connected = true;
            });

            socket.io.on('reconnecting', function () {
                if (!connected) {
                    element.html(_options.reconnectingMessage);
                }
            });

            socket.io.on('reconnect_failed', function () {
                if (!connected) {
                    element.html(_options.connectionErrorMessage);
                }
            });

            // custom events
            socket.on('preRender', preRender);
            socket.on('afterRender', render);
            socket.on('afterRenderError', renderError);
            socket.on('afterFilter', redraw);
            socket.on('afterFilterError', renderError);

            hasInit = true;
        }

        function getChartType (chartWrapper) {
            try {
                var chartType = chartWrapper.attr('data-type').split('');
                chartType[0] = chartType[0].toUpperCase();
                return chartType.join('');
            } catch (ex) {
                return null;
            }
        }

        //---------------------
        // Init
        //---------------------

        onRefresh();

        return _chart;
    };

})();

(function () {
    'use strict';

    var duration = 5000;
    var ease = 'quad-in-out';
    var pieRegEx = new RegExp([
        'M ?([\\d\\.e-]+) ?, ?([\\d\\.e-]+) ?', // move to starting point
        // see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#Arcs
        'A ?', // start arc
            '[\\d\\.e-]+ ?, ?[\\d\\.e-]+ ?,? ', // arc x radius and y radius
            '\\d ,? ?', // arc x-axis-rotation
            '\\d ?,? ?', // arc large-arc-flag
            '\\d ?,? ?', // arc sweep-flag
            '([\\d\\.e-]+) ?,? ?([\\d\\.e-]+) ?', // arc finishing points
        'L ?([\\d\\.e-]+) ?,? ?([\\d\\.e-]+)', // draw line too
        'Z', // close off
    ].join(''));

    dc.serverChart.redrawPieChart = function (chartIndex, chartWrapper, nextWrapper) {
        var svg = chartWrapper.select('svg'),
            currentSlices = chartWrapper.selectAll('g.pie-slice'),
            nextSlices = nextWrapper.selectAll('g.pie-slice');

        chartWrapper
            .select('g')
            .attr('class', nextWrapper.select('g').attr('class'));

        chartWrapper
            .selectAll('text')
            .each(function (textData, textIndex) {
                var textElement = d3.select(this),
                    nextText = filterNextItem(nextWrapper.selectAll('text'), textIndex);

                if (nextText.empty()) {
                    textElement
                        .text('');
                } else {
                    textElement
                        .text(nextText.text())
                        .transition()
                            .duration(duration)
                            .ease(ease)
                            .attr('transform', nextText.attr('transform'));
                }
            });

        currentSlices
            .each(function (sliceData, sliceIndex) {
                var sliceElement = d3.select(this),
                    nextSlice = filterNextItem(nextSlices, sliceIndex);

                if (!nextSlice.empty()) {
                    sliceElement
                        .attr('class', nextSlice.attr('class'));

                    var nextText = nextSlice.select('text');

                    if (!nextText.empty()) {
                        sliceElement
                            .select('title')
                            .text(nextText.text());
                    }
                }
            });

        currentSlices
            .select('path')
            .each(function (sliceData, sliceIndex) {
                var sliceElement = d3.select(this),
                    nextSlice = filterNextItem(nextSlices, sliceIndex).select('path');

                if (!nextSlice.empty()) {
                    sliceElement
                        .attr('class', nextSlice.attr('class'))
                        .attr('fill', nextSlice.attr('fill'));
                }
            })
            .transition()
                .duration(duration)
                .ease(ease)
                .attrTween('d', function (pathData, pathIndex, attrValue) {
                    var radius = d3.min([svg.attr('width'), svg.attr('height')]) / 2,
                        arc = d3.svg.arc().outerRadius(radius).innerRadius(0),
                        nextSlice = filterNextItem(nextSlices, pathIndex),
                        nextD = '';

                    if (!nextSlice.empty()) {
                        nextD = nextSlice.select('path').attr('d');
                    }

                    var interpolate = d3.interpolate(
                            pathToInterpolateAngles(attrValue),
                            pathToInterpolateAngles(nextD)
                        );

                    return function (t) {
                        return arc(interpolate(t));
                    };
                });
    };

    dc.serverChart.redrawBarChart = function (chartIndex, chartWrapper, nextWrapper) {
        var currentBars = chartWrapper.selectAll('rect.bar'),
            nextBars = nextWrapper.selectAll('rect.bar');

        currentBars
            .each(function (barData, barIndex) {
                var barElement = d3.select(this),
                    nextBar = filterNextItem(nextBars, barIndex);

                barElement
                    .attr('class', nextBar.attr('class'))
                    .attr('fill', nextBar.attr('fill'))
                    .transition()
                        .duration(duration)
                        .ease(ease)
                        .attr('x', nextBar.attr('x'))
                        .attr('y', nextBar.attr('y'))
                        .attr('width', nextBar.attr('width'))
                        .attr('height', nextBar.attr('height'));
            });

        currentBars
            .select('title')
            .each(function (titleData, titleIndex) {
                var titleElement = d3.select(this),
                    nextTitle = filterNextItem(nextBars, titleIndex).select('title');

                titleElement
                    .text(nextTitle.text());
            });

        redrawAxis(chartIndex, chartWrapper, nextWrapper);
    };

    dc.serverChart.redrawRowChart = dc.serverChart.redrawPairedRowChart = function (chartIndex, chartWrapper, nextWrapper) {
        chartWrapper
            .selectAll('g.row')
            .each(function (rowData, rowIndex) {
                var rowElement = d3.select(this),
                    nextRow = filterNextItem(nextWrapper.selectAll('g.row'), rowIndex),
                    nextRect = nextRow.select('rect'),
                    nextText = nextRow.select('text'),
                    nextTitle = nextRow.select('title');

                rowElement
                    .transition()
                    .duration(duration)
                    .ease(ease)
                    .attr('transform', nextRow.attr('transform'));

                rowElement
                    .select('rect')
                    .attr('class', nextRect.attr('class'))
                    .transition()
                        .duration(duration)
                        .ease(ease)
                        .attr('width', nextRect.attr('width'))
                        .attr('height', nextRect.attr('height'))
                        .attr('fill', nextRect.attr('fill'))
                        .attr('transform', nextRect.attr('transform'));

                rowElement
                    .select('text')
                    .text(nextText.text())
                    .transition()
                        .duration(duration)
                        .ease(ease)
                        .attr('x', nextText.attr('x'))
                        .attr('y', nextText.attr('y'))
                        .attr('dy', nextText.attr('dy'))
                        .attr('transform', nextText.attr('transform'));

                rowElement
                    .select('title')
                    .text(nextTitle.text());
            });

        redrawAxis(chartIndex, chartWrapper, nextWrapper);
    };

    dc.serverChart.redrawLineChart = function (chartIndex, chartWrapper, nextWrapper) {
        chartWrapper
            .selectAll('g.stack')
            .each(function (stackData, stackIndex) {
                var stackElement = d3.select(this),
                    nextStack = filterNextItem(nextWrapper.selectAll('g.stack'), stackIndex);

                stackElement
                    .selectAll('path')
                    .each(function (pathData, pathIndex) {
                        var pathElement = d3.select(this),
                            nextPath = filterNextItem(nextStack.selectAll('path'), pathIndex);

                        pathElement
                            .transition()
                                .duration(duration)
                                .ease(ease)
                                .attr('stroke', nextPath.attr('stroke'))
                                .attr('d', nextPath.attr('d'));
                    });
            });

        redrawAxis(chartIndex, chartWrapper, nextWrapper);
    };

    dc.serverChart.redrawNumberDisplay = function (chartIndex, chartWrapper, nextWrapper) {
        var spanElement = chartWrapper.select('span.number-display'),
            spanText = spanElement.text(),
            textParts = spanText.match(/([^\d]*)([\d\.]+)([^\d]*)/i),
            currentNumber = textParts === null ? 0 : parseFloat(textParts[2]),
            nextSpan = nextWrapper.select('span.number-display'),
            nextText = nextSpan.text(),
            nextParts = nextText.match(/([^\d]*)([\d\.]+)([^\d]*)/i),
            nextNumber = nextParts === null ? 0 : parseFloat(nextParts[2]);

        spanElement.transition()
            .duration(duration)
            .ease(ease)
            .tween('text', function () {
                var interp = d3.interpolateNumber(currentNumber, nextNumber);
                return function (t) {
                    var num = d3.format('.2s')(interp(t));
                    this.innerHTML = nextParts[1] + num + nextParts[3];
                };
            });
    };

    function redrawAxis (chartIndex, chartWrapper, nextWrapper) {
        chartWrapper
            .selectAll('.axis')
            .each(function (axisData, axisIndex) {
                var axisElement = d3.select(this),
                    axisBBox = axisElement.select('path.domain').node().getBBox(),
                    axisTicks = axisElement.selectAll('g.tick'),
                    isHorizontal = axisTicks.empty() ? null : /translate\([\d.]+,0\)/i.exec(d3.select(axisTicks[0][1]).attr('transform')) !== null,
                    firstRow = d3.select(axisElement[0][0].nextElementSibling),
                    isRightYAxis = firstRow.empty() ? null : /translate\(0,[\d.]+\)/i.exec(firstRow.attr('transform')) === null,
                    nextAxis = filterNextItem(nextWrapper.selectAll('.axis'), axisIndex),
                    nextTicks = nextAxis.selectAll('g.tick'),
                    minTickValue = nextTicks.empty() ? 0 : parseFloat(d3.select(nextTicks[0][0]).select('text').text()),
                    maxTickValue = nextTicks.empty() ? 1 : parseFloat(d3.select(nextTicks[0][nextTicks[0].length - 1]).select('text').text()),
                    grid = chartWrapper.select(isHorizontal ? '.grid-line.vertical' : '.grid-line.horizontal'),
                    nextGrid = nextWrapper.select(isHorizontal ? '.grid-line.vertical' : '.grid-line.horizontal');

                axisElement
                    .transition()
                        .duration(duration)
                        .ease(ease)
                        .attr('transform', nextAxis.attr('transform'));

                if (!grid.empty()) {
                    grid
                        .transition()
                            .duration(duration)
                            .ease(ease)
                            .attr('transform', nextGrid.attr('transform'));
                }

                axisTicks
                    .each(function (tickData, tickIndex) {
                        var tickElement = d3.select(this),
                            tickText = tickElement.select('text'),
                            tickValue = parseFloat(tickText.text()),
                            tickPercentage = (tickValue - minTickValue) / (maxTickValue - minTickValue) * 100,
                            matched = false;

                        nextTicks
                            .each(function (nextData, nextIndex) {
                                var nextTick = d3.select(this),
                                    nextText = nextTick.select('text');

                                if (parseFloat(nextText.text()) === tickValue) {
                                    matched = true;

                                    tickElement
                                        .transition()
                                            .duration(duration)
                                            .ease(ease)
                                            .attr('transform', nextTick.attr('transform'))
                                            .attr('opacity', null)
                                            .style('opacity', nextTick.attr('opacity'))
                                        .each('end', function () {
                                            tickElement
                                                .select('text')
                                                .text(nextTick.select('text').text());
                                        });

                                    if (!grid.empty()) {
                                        var gridLine = filterNextItem(grid.selectAll('line'), tickIndex),
                                            nextGridLine = filterNextItem(nextGrid.selectAll('line'), nextIndex);

                                        gridLine
                                            .transition()
                                                .duration(duration)
                                                .ease(ease)
                                                .attr('x1', nextGridLine.attr('x1'))
                                                .attr('y1', nextGridLine.attr('y1'))
                                                .attr('x2', nextGridLine.attr('x2'))
                                                .attr('y2', nextGridLine.attr('y2'))
                                                .attr('transform', null)
                                                .style('opacity', nextGridLine.attr('opacity'));
                                    }

                                }
                            });

                        if (!matched) {
                            var transform = '';

                            if (isHorizontal) {
                                var translate = (axisBBox.width * tickPercentage / 100);
                                if (isRightYAxis) {
                                    transform = 'translate(-' + translate + ', 0)';
                                } else {
                                    transform = 'translate(' + translate + ', 0)';
                                }
                            } else {
                                transform = 'translate(0, ' +
                                    (axisBBox.height - (axisBBox.height * tickPercentage / 100)) +
                                ')';
                            }

                            tickElement
                                .transition()
                                    .duration(duration)
                                    .ease(ease)
                                    .attr('transform', transform)
                                    .style('opacity', 0)
                                .each('end', function () {
                                    tickElement.remove();
                                });

                            if (!grid.empty()) {
                                var gridLine = filterNextItem(grid.selectAll('line'), tickIndex);

                                gridLine
                                    .transition()
                                        .duration(duration)
                                        .ease(ease)
                                        .attr('transform', transform)
                                        .style('opacity', 0)
                                    .each('end', function () {
                                        gridLine.remove();
                                    });
                            }
                        }
                    });
            });

        nextWrapper
            .selectAll('.axis')
            .each(function (d, axisIndex, tickIndex) {
                var nextAxis = d3.select(this),
                    nextTicks = nextAxis.selectAll('g.tick');

                if (!nextTicks.empty()) {
                    var isHorizontal = /translate\([\d.]+,0\)/i.exec(d3.select(nextTicks[0][1]).attr('transform')) !== null,
                        firstRow = d3.select(nextAxis[0][0].nextElementSibling),
                        isRightYAxis = firstRow.empty() ? null : /translate\(0,[\d.]+\)/i.exec(firstRow.attr('transform')) === null,
                        axisElement = filterNextItem(chartWrapper.selectAll('.axis'), axisIndex),
                        axisBBox = axisElement.select('path.domain').node().getBBox(),
                        axisTicks = axisElement.selectAll('g.tick'),
                        minTickValue = axisTicks.empty() ? 0 : parseFloat(d3.select(axisTicks[0][0]).select('text').text()),
                        maxTickValue = axisTicks.empty() ? 1 : parseFloat(d3.select(axisTicks[0][axisTicks[0].length - 1]).select('text').text()),
                        grid = chartWrapper.select(isHorizontal ? '.grid-line.vertical' : '.grid-line.horizontal'),
                        nextGrid = nextWrapper.select(isHorizontal ? '.grid-line.vertical' : '.grid-line.horizontal');

                    nextTicks
                        .each(function (nextData, nextIndex) {
                            var nextTick = d3.select(this),
                                nextText = nextTick.select('text'),
                                nextLine = nextTick.select('line'),
                                nextValue = parseFloat(nextText.text()),
                                tickPercentage = (nextValue - minTickValue) / (maxTickValue - minTickValue) * 100,
                                matched = false;

                            axisTicks
                                .each(function (tickData, tickIndex) {
                                    var tickElement = d3.select(this),
                                        tickText = tickElement.select('text');

                                    if (parseFloat(tickText.text()) === nextValue) {
                                        matched = true;
                                    }
                                });

                            if (!matched) {
                                var translate = 0,
                                    transform = '',
                                    gridLineTransform = '',
                                    nextGridLine = null;

                                if (grid.empty()) {
                                    nextGridLine = nextTick.select('line.grid-line');
                                } else {
                                    nextGridLine = filterNextItem(nextGrid.selectAll('line'), nextIndex);
                                }

                                if (isHorizontal) {
                                    translate = axisBBox.width * tickPercentage / 100;

                                    if (isRightYAxis) {
                                        transform = 'translate(-' + translate + ', 0)';
                                    } else {
                                        transform = 'translate(' + translate + ', 0)';
                                    }

                                    if (!nextGridLine.empty()) {
                                        gridLineTransform = 'translate(' + (translate - nextGridLine.attr('x1')) + ', 0)';
                                    }
                                } else {
                                    translate = axisBBox.height - (axisBBox.height * tickPercentage / 100);
                                    transform = 'translate(0, ' + translate + ')';

                                    if (!nextGridLine.empty()) {
                                        gridLineTransform = 'translate(0, ' + (translate - nextGridLine.attr('y1')) + ')';
                                    }
                                }

                                var addedTick = axisElement
                                    .append('g')
                                    .attr('class', 'tick')
                                    .attr('transform', transform)
                                    .attr('opacity', 0);

                                addedTick
                                    .transition()
                                        .duration(duration)
                                        .ease(ease)
                                        .attr('transform', nextTick.attr('transform'))
                                        .style('opacity', 1);

                                addedTick
                                    .append('text')
                                    .attr('x', nextText.attr('x'))
                                    .attr('y', nextText.attr('y'))
                                    .attr('dy', nextText.attr('dy'))
                                    .attr('style', nextText.attr('style'))
                                    .text(nextText.text());

                                addedTick
                                    .append('line')
                                    .attr('x1', nextLine.attr('x1'))
                                    .attr('y1', nextLine.attr('y1'))
                                    .attr('x2', nextLine.attr('x2'))
                                    .attr('y2', nextLine.attr('y2'));

                                if (!nextGridLine.empty()) {
                                    if (grid.empty()) {
                                        addedTick
                                            .append('line')
                                            .attr('class', nextGridLine.attr('class'))
                                            .attr('x1', nextGridLine.attr('x1'))
                                            .attr('y1', nextGridLine.attr('y1'))
                                            .attr('x2', nextGridLine.attr('x2'))
                                            .attr('y2', nextGridLine.attr('y2'));
                                    } else {
                                        grid
                                            .append('line')
                                            .attr('x1', nextGridLine.attr('x1'))
                                            .attr('y1', nextGridLine.attr('y1'))
                                            .attr('x2', nextGridLine.attr('x2'))
                                            .attr('y2', nextGridLine.attr('y2'))
                                            .attr('transform', gridLineTransform)
                                            .attr('opacity', 0)
                                            .transition()
                                                .duration(duration)
                                                .ease(ease)
                                                .attr('transform', 'translate(0, 0)')
                                                .style('opacity', 1);
                                    }
                                }
                            }
                        });
                }
            });
    }

    function filterNextItem (next, i) {
        return next.filter(function (d, j) {
            return j === i;
        });
    }

    function pathToInterpolateAngles(path) {
        // get the points of the pie slice
        var p = path.match(pieRegEx);

        if (!p) {
            return {
                startAngle: 0,
                endAngle: Math.PI * 2,
            };
        }

        var coords = {
            x1: parseFloat(p[5]),
            y1: parseFloat(p[6]),
            x2: parseFloat(p[1]),
            y2: parseFloat(p[2]),
            x3: parseFloat(p[3]),
            y3: parseFloat(p[4]),
        };

        // convert the points into angles
        var angles = {
            startAngle: switchRadians(Math.atan2((coords.y2 - coords.y1), (coords.x2 - coords.x1))),
            endAngle:   switchRadians(Math.atan2((coords.y3 - coords.y1), (coords.x3 - coords.x1))),
        };

        if (angles.startAngle < 0) {
            angles.startAngle = 0;
        }

        if (angles.endAngle > (Math.PI * 2) || angles.endAngle < angles.startAngle) {
            angles.endAngle = Math.PI * 2;
        }

        return angles;
    }

    // since silly maths makes the following angles we have to convert it from
    //      -90               -(PI / 2)
    // -180     0   or    -PI             0
    //       90                  PI / 2
    //
    // to
    //
    //     360                   PI * 2
    // 270     90   or    PI * 1.5     PI / 2
    //     180                      PI
    function switchRadians(angle) {
        var quarter     = Math.PI * 0.5;

        if (angle >= 0) {
            return quarter + angle;
        } else if (angle >= -quarter) {
            return quarter - Math.abs(angle);
        }

        return (Math.PI * 2.5) - Math.abs(angle);
    }
})();

(function () {
    'use strict';

    angular.module('AngularDc', []);
})();

(function () {
    'use strict';

    var dcChart = function ($timeout) {
        return {
            restrict: 'E',
            scope: {
                chartType: '=',
                chartGroup: '=',
                chartOptions: '='
            },
            link: function ($scope, element) {
                $scope.drawChart = function () {
                    if (typeof $scope.chartType === 'string' && typeof $scope.chartOptions === 'object') {
                        if ($scope.chart !== null) {
                            dc.chartRegistry.clear();
                        }

                        $scope.chart = dc[$scope.chartType](element[0], $scope.chartGroup || undefined);

                        if ($scope.chartType === 'compositeChart') {
                            for (var i = 0; i < $scope.chartOptions.compose.length; i++) {
                                if ($scope.chartOptions.compose[i].chartType && typeof $scope.chartOptions.compose[i].useRightYAxis !== 'function') {
                                    $scope.chartOptions.compose[i] =
                                        dc[$scope.chartOptions.compose[i].chartType]($scope.chart)
                                            .options($scope.chartOptions.compose[i]);
                                }
                            }
                        }

                        $scope.chart.options($scope.chartOptions);
                        $scope.chart.render();
                        $scope.resize();
                    }
                };

                $scope.resetChart = function () {
                    $scope.chart = null;
                    element.empty();
                };

                $scope.resize = function () {
                    try {
                        if ($scope.chart.data().length > 0) {
                            $scope.chart.root().select('svg').attr('width', '100%');
                            $timeout(function () {
                                if ($scope.chart.hasOwnProperty('rescale')) {
                                    $scope.chart.rescale();
                                }
                                $scope.chart.redraw();
                            }, 100);
                        }
                    } catch (err) {

                    }
                };

                $scope.$watch('chartType', function () {
                    $scope.resetChart();
                    $scope.drawChart();
                });

                $scope.$watch('chartOptions', function () {
                    $scope.resetChart();
                    $scope.drawChart();
                });

                $scope.resetChart();
            }
        };
    };

    dcChart.$inject = ['$timeout'];

    angular.module('AngularDc').directive('dcChart', dcChart);

})();

(function () {
    'use strict';

    var dcServerChart = function () {
        return {
            restrict: 'E',
            scope: {
                options: '=',
                conditions: '=',
            },
            link: function ($scope, element) {
                var chart = dc.serverChart(element[0]),
                    hasInit = false;

                $scope.$watch('options', function () {
                    if (!hasInit && $scope.options) {
                        chart.options($scope.options).render();
                        hasInit = true;
                    }
                });

                $scope.$watch('conditions', function () {
                    if ($scope.conditions) {
                        chart.conditions($scope.conditions);
                    }
                });
            }
        };
    };

    dcServerChart.$inject = [];

    angular.module('AngularDc').directive('dcServerChart', dcServerChart);

})();
