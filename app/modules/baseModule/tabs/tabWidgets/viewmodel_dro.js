define(function(require) {

    var template = require('text!./view_dro.html');
    var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }

		this.initialize = function( Panel ) {
            self.Panel = Panel;
		};

        this.onDROFocus = function(data, event)
        {
            $(event.target.nextSibling).select();
            return true;
        }


        self.onHome = function(index)
        {
            self.linuxCNCServer.homeAxis(index);
        }

        self.onZeroDRO = function(index)
        {
            self.linuxCNCServer.touchoffCurrentDisplay( index, 0 );
        }

        self.onDROValChange=function(oldval,event,index)
        {
            if ($.isNumeric(event.currentTarget.value))
                if ( parseFloat(event.currentTarget.value) != self.linuxCNCServer.RmtDRO()[index])
                    self.linuxCNCServer.touchoffCurrentDisplay( index, event.currentTarget.value );
                else
                    $(event.currentTarget).val( self.linuxCNCServer.RmtDRO()[index].toFixed(self.linuxCNCServer.DisplayPrecision()) );
            else
                $(event.currentTarget).val( self.linuxCNCServer.RmtDRO()[index].toFixed(self.linuxCNCServer.DisplayPrecision()) );
        }

        self.spindleSpeed = ko.computed(
          function() {
            var spindleSpeedMeasured =  self.linuxCNCServer.vars['halpin_spindle_voltage.speed_measured'].data();
            var spindleSpeedCommanded = self.linuxCNCServer.vars.spindle_speed.data();
            var spindleSpeedMultiplier = self.linuxCNCServer.vars.spindlerate.data();
            var spindleOn = self.linuxCNCServer.vars.spindle_enabled.data();

            if(spindleOn && spindleSpeedMeasured) {
                return Math.round(spindleSpeedMeasured);
            } else {
                return Math.round(spindleSpeedCommanded*spindleSpeedMultiplier);
            }
          }
        );

        self.formatDisplayValue = function(rawVal)
        {
            if(Math.abs(rawVal) < 0.00001)
                return 0;
             return rawVal;
        }
	};

	return ViewModel;
});
