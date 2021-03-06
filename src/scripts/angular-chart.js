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
