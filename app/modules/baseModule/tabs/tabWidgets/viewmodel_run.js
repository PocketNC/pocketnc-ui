define(function(require) {

    var template = require('text!./view_run.html');
    var nls = require('i18n!./nls/resources');
    var utils = require('../../../../core/helpers/utility.js');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.Panel = null;
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
            if (self.Panel == null)
            {
                self.Panel = Panel;
                $('.switch', self.Panel.getJQueryElement()).bootstrapSwitch();
                self.linuxCNCServer.vars.optional_stop.data.subscribe( function(newVal)
                {
                    $(self.Panel.getJQueryElement()).find('#run_opstop_toggle').bootstrapSwitch('setState',newVal);
                });
            
                utils.JQVSlider( $( "#run_spindle_rate_slider", self.Panel.getJQueryElement() ), self.linuxCNCServer.vars.spindlerate.data, 0, 2, 0.01, function(event,ui){ self.linuxCNCServer.setSpindleOverride(ui.value); } );
                utils.JQVSlider( $( "#run_feed_rate_slider", self.Panel.getJQueryElement() ), self.linuxCNCServer.vars.feedrate.data, 0, 2, 0.01, function(event,ui){ self.linuxCNCServer.setFeedrate(ui.value); } );
                utils.JQVSlider( $( "#run_maxvel_slider", self.Panel.getJQueryElement() ), self.linuxCNCServer.vars["halpin_halui.max-velocity.value"].data, 0, 1, 0.01, function(event,ui){ self.linuxCNCServer.setMaxVel(ui.value); } );
            }
		};

        self.run = function()
        {
            if (self.singleStep())
                self.linuxCNCServer.runStep();
            else {
                self.isClockLocked = false;
                self.linuxCNCServer.runFrom(self.linuxCNCServer.ui_motion_line())
            };
        };

        self.setOptionalStop = function()
        {
            self.linuxCNCServer.setOptionalStop( $( '#run_opstop_toggle', self.Panel.getJQueryElement() ).bootstrapSwitch('status'));
        };

        self.resume = function()
        {
            if (!self.linuxCNCServer.vars.paused.data())
                self.linuxCNCServer.pause();
            else {
                if (self.singleStep())
                    self.linuxCNCServer.runStep();
                else {
                    self.linuxCNCServer.resume();
                }
            }
        };

        self.singleStep = ko.observable(false);
      
        self.isClockLocked = true;
        self.clockText = ko.observable("00:00:00");
        self.setClockText = function( totalSeconds ){
            var t = totalSeconds;
            var s = Math.floor(t % 60).toString().padStart(2, '0');
            var m = Math.floor((t / 60) % 60).toString().padStart(2, '0');
            var h = Math.floor(t / 3600).toString().padStart(2, '0');
            var txt = h + ':' + m + ':' + s;
            self.clockText(txt);
        };
        self.linuxCNCServer.vars.rtc_seconds.data.subscribe( function() {
            if( !self.isClockLocked )
                self.setClockText( parseFloat( self.linuxCNCServer.vars.rtc_seconds.data() ) );
        });
        
        //zero the clock if a new program is opened
        self.linuxCNCServer.vars.file.data.subscribe( function(newval) {
            self.setClockText(0);
        });
       
        self.spindleRateText = ko.computed( function() {
            return (self.linuxCNCServer.vars.spindlerate.data() * 100).toFixed(0);
        });

        self.feedRateText = ko.computed( function() {
            return (self.linuxCNCServer.vars.feedrate.data() * 100).toFixed(0);
        });

        self.maxVelText = ko.computed( function() {
            var maxVel = parseFloat(self.linuxCNCServer.vars["halpin_halui.max-velocity.value"].data());
            if(maxVel > 1) maxVel = 1;
            return lcncsvr.MachineUnitsToDisplayUnitsLinear(maxVel*60).toFixed(0);
        });

        self.unit = ko.computed(function() {
            switch(lcncsvr.MachineUnitsToDisplayUnitsLinearScaleFactor()) {
                case 25.4:
                    return "mm";
                case 2.54:
                    return "cm";
            }
            return "in";
        });

	};

	return ViewModel;
});
