define(function(require) {

    var template = require('text!./view_sensors.html');
    var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext) {

		var self = this;
		self.Panel = null;
    self.highPressureLimit = 0.172;
		self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
            
                self.hssSensorsDetected = ko.computed( function() {
                    return self.linuxCNCServer.vars['halpin_hss_sensors.detected'].data() == 'TRUE'
                });

                self.tempText = ko.observable("--.--");
                self.linuxCNCServer.vars["halpin_hss_sensors.temperature"].data.subscribe(
                    function(newval) {
                        t = parseFloat(newval);
                        if(self.linuxCNCServer.TemperatureUnits() == "F")
                            //Data is in degrees C by default, convert to F
                            t = t * 9 / 5 + 32
                        self.tempText(t.toFixed(1));
                    }
                );

                self.pressText = ko.observable("--.--");
                self.highPressure = ko.observable(false);
                self.linuxCNCServer.vars["halpin_hss_sensors.pressure"].data.subscribe(
                    function(newval) {
                        var p = parseFloat(newval);
                        self.highPressure(p > self.highPressureLimit);
                        if(self.linuxCNCServer.PressureUnits() == "PSIA"){
                            //Data is in MPA by default, convert to PSI
                            p = p * 145.038
                            self.pressText(p.toFixed(1));
                        }
                        else{
                            self.pressText(p.toFixed(3));
                        }
                    }
                );   


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
