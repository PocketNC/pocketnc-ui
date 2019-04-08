define(function(require) {

  var template = require('text!./view_sensors.html');
  var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext) {

		var self = this;
		self.Panel = null;
    self.chartWidth = 210;
    self.chartHeight = 50;
    self.chartTimespan = 3600;
    self.strokeWidth = 2;
    self.lineColor = "#0074d9";
    self.timeOriginLabel = "-1hr";
    self.timeOriginLabelX = 0;
    self.timeEndLabel = "Now";
    self.timeEndLabelX = self.chartWidth - 20;
    self.timeLabelY = self.chartHeight + 10;
    self.vertAxisMaxLabelY = 4;
    self.vertAxisLabelX = -15;
 
  	self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
            
    self.hssSensorsDetected = ko.computed( function() {
        return self.linuxCNCServer.vars['halpin_hss_sensors.detected'].data() == 'TRUE';
    });


    //--------TEMPERATURE SECTION--------
    //Data from server will always be in Celsius
    self.temperatureInDisplayUnits = function( tData ){
      tNum = parseFloat(tData);
      if(self.linuxCNCServer.TemperatureUnits() == "F")
        tNum = ( tNum * 9 / 5 ) + 32;
      return tNum.toFixed(1);
    };
    
    self.temperatureText = ko.computed( function() {
      tData = self.linuxCNCServer.vars["halpin_hss_sensors.temperature"].data();
      return self.temperatureInDisplayUnits( tData );
    });

    self.temperaturePoints = ko.observable("");

    self.minTemperature = ko.observable( self.linuxCNCServer.vars["halpin_hss_sensors.temperature"].data() - 1 );

    self.minScaleTemperature = ko.computed( function(newval) {
      //Bottom of scale will be: minimum temperature minus 5, then rounded down to next multiple of 5
      return ( Math.floor( ( self.minTemperature() - 5 ) / 5 ) * 5 );
    });

    self.maxTemperature = ko.observable( self.linuxCNCServer.vars["halpin_hss_sensors.temperature"].data() + 1 );

    self.maxScaleTemperature = ko.computed( function(newval) {
      //Top of scale will be: maximum temperature plus 5, then rounded up to next multiple of 5
      return ( Math.ceil( ( parseFloat(self.maxTemperature()) + 5 ) / 5 ) * 5 );
    });

    self.temperatureScaleY = ko.computed( function() {
      return self.chartHeight / ( self.maxScaleTemperature() - self.minScaleTemperature() );
    });

    self.temperatureTransformScale = ko.computed( function(){
      return "scale(" + self.chartWidth / self.chartTimespan + ", -" + self.temperatureScaleY() + ")";
    });
    self.temperatureTransformTranslate = ko.computed( function(){
      return "translate(" + self.chartTimespan + ", -" + self.maxScaleTemperature() + ")";
    });

    self.temperatureDisplayUnitsConverter = function() {
      var conversionFunction;
      if( self.linuxCNCServer.TemperatureUnits() === "F" ){
        conversionFunction = function(x) {
          return ( x * 9 / 5 + 32 ).toFixed(2);
        };
      }
      else{
        conversionFunction = function(x) {
          return x.toFixed(2);
        };
      }
      return conversionFunction;
    };

    self.processTemperatureData = function( tData ) {
      if( tData.length === 0 )
        return;
      var processedData = self.processData( tData, self.temperatureDisplayUnitsConverter() );
      self.temperaturePoints( processedData.pointStr );
      self.maxTemperature( processedData.maxVal );
      self.minTemperature( processedData.minVal );
    };

    self.linuxCNCServer.vars.temperature_data.data.subscribe( function( newval ) {
        self.processTemperatureData( newval );
    });

    self.linuxCNCServer.TemperatureUnits.subscribe( function() {
      self.processTemperatureData( self.linuxCNCServer.vars.temperature_data.data() );
    });
    //^^^^^^^^TEMPERATURE SECTION^^^^^^^^


    //--------PRESSURE SECTION--------
    //Data from server will be in MPaA
    self.pressureInDisplayUnits = function( pVal ){
      pNum = parseFloat( pVal );
      if( self.linuxCNCServer.PressureUnits() == "PSIA" ){
        pNum = pNum * 145.038
        return pNum.toFixed(1);
      }
      else
        return pNum.toFixed(3);
    };

    self.pressureText = ko.computed( function() {
      pData = self.linuxCNCServer.vars["halpin_hss_sensors.pressure"].data();
      return self.pressureInDisplayUnits( pData );
    });

    self.highPressureLimit = 0.172; //in MPAa

    self.isPressureHigh = ko.computed( function() {
      return ( self.linuxCNCServer.vars["halpin_hss_sensors.pressure"] > self.highPressureLimit );
    });

    self.pressurePoints = ko.observable("");

    self.pressureMinLabelX = -10;
    self.pressureMaxLabelX = ko.computed( function() {
      if( self.linuxCNCServer.PressureUnits() === "PSIA" ){
        return -15;
      }
      else{
        return -28;
      }
    });

    self.minPressure = ko.observable(0);
    self.maxPressure = ko.computed( function(){
      if( self.linuxCNCServer.PressureUnits() === "PSIA" ){
        return 28;
      }
      else{
        return 0.193;
      }
    });

    self.pressureScaleY = ko.computed( function() {
      return self.chartHeight / ( self.maxPressure() - self.minPressure() );
    });
    self.pressureTransformScale = ko.computed( function(){
      return "scale(" + self.chartWidth / self.chartTimespan + ", -" + self.pressureScaleY() + ")";
    });
    self.pressureTransformTranslate = ko.computed( function(){
      return "translate(" + self.chartTimespan + ", -" + self.maxPressure() + ")";
    });

    self.pressureDisplayUnitsConverter = function() {
      var conversionFunction;
      if( self.linuxCNCServer.PressureUnits() === "PSIA" ){
        conversionFunction = function(x) {
          return ( 145.038 * x ).toFixed(2);
        };
      }
      else{
        conversionFunction = function(x) {
          return x.toFixed(4);
        };
      }
      return conversionFunction;
    };

    self.processPressureData = function( pData ) {
      if( pData.length === 0 )
          return;
      
      var processedData = self.processData( pData, self.pressureDisplayUnitsConverter() );
      self.pressurePoints( processedData.pointStr );
    };

    self.linuxCNCServer.vars.pressure_data.data.subscribe( function( newval ) {
        self.processPressureData( newval );
    });

    self.linuxCNCServer.PressureUnits.subscribe( function() {
      self.processPressureData( self.linuxCNCServer.vars.pressure_data.data() );
    });
    //^^^^^^^^PRESSURE SECTION^^^^^^^^


    self.processData = function( points, unitConversionFunction ) {
      var newestTime = points.slice(-1).pop()[0];
      var oldestTime = points[0][0];
      var pointStr = "", maxVal = Number.NEGATIVE_INFINITY, minVal = Number.POSITIVE_INFINITY;
      var i;
      for( i = 0; i < points.length; ++i ){
        val = unitConversionFunction( points[i][1] );
        if( val > maxVal )
          maxVal = val;
        if( val < minVal )
          minVal = val;

        pointStr += (points[i][0] - newestTime).toFixed(2);
        pointStr += ",";
        pointStr += val;
        pointStr += " ";
      }
      package = {};
      package.pointStr = pointStr;
      package.minVal = minVal;
      package.maxVal = maxVal;
      return package;
    };
      
    this.getTemplate = function()
		{
		    return template;
		};
		this.getNls = function()
		{
		    return nls;
		};

		this.initialize = function( Panel ) {
		    if (self.Panel == null)
		    {
			self.Panel = Panel;
		    }
		};
	};

	return ViewModel;
});
