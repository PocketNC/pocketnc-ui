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

                self.linuxCNCServer.vars.gcodes.data.subscribe( function(newVal) {
                    self.setFeedRateMode(newVal);
                });
                self.setFeedRateMode(self.linuxCNCServer.vars.gcodes.data());
            }
		};

        self.run = function()
        {
          if ( self.interlockClosed() ){
            if (self.singleStep())
                self.linuxCNCServer.runStep();
            else {
                self.linuxCNCServer.runFrom(self.linuxCNCServer.ui_motion_line())
            };
            return;
          }
          else{
            $.pnotify({
              type: "warning",
              title: "Alert",
              text: "Enclosure door must be closed to run program."
            });
            return;
          }
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
                if (self.programPausedByInterlock())
                    self.linuxCNCServer.interlockRelease();
                if (self.singleStep())
                    self.linuxCNCServer.runStep();
                else {
                    self.linuxCNCServer.resume();
                }
            }
        };

        self.singleStep = ko.observable(false);

        self.clockText = ko.observable("00:00:00");
        self.setClockText = function( totalSeconds ){
            var t = totalSeconds;
            var s = Math.floor(t % 60).toString().padStart(2, '0');
            var m = Math.floor((t / 60) % 60).toString().padStart(2, '0');
            var h = Math.floor(t / 3600).toString().padStart(2, '0');
            var txt = h + ':' + m + ':' + s;
            self.clockText(txt);
        };
        
        self.isClockLocked = true;
        
        self.linuxCNCServer.vars.rtc_seconds.data.subscribe( function() {
            self.setClockText( parseFloat( self.linuxCNCServer.vars.rtc_seconds.data() ) );
        });

        self.displayPrecision = 1;
        self.unit = ko.computed(function() {
            switch(lcncsvr.MachineUnitsToDisplayUnitsLinearScaleFactor()) {
                case 25.4:
                    self.displayPrecision = 0;
                    return "mm";
                case 2.54:
                    self.displayPrecision = 1;
                    return "cm";
            }
            self.displayPrecision = 1;
            return "in";
        });
        
        self.maxVelPerc = ko.computed( function() {
            //when initialized the halpin has a value of 1e101, so we need to clamp the displayed value
            var mvp = parseFloat(self.linuxCNCServer.vars["halpin_halui.max-velocity.value"].data()) * 100;
            mvp = Math.min(100, mvp);
            return mvp.toFixed(0);
        });

        self.maxVelText = ko.computed( function() {
            var maxVel = parseFloat(self.linuxCNCServer.vars["halpin_halui.max-velocity.value"].data());
            if(maxVel > 1) maxVel = 1;
            return lcncsvr.MachineUnitsToDisplayUnitsLinear(maxVel*60).toFixed(self.displayPrecision);
        });
        
        self.feedRateModes = {
            G93: 'INVERSE',
            G94: 'UNITS_PER_MINUTE',
            G95: 'UNITS_PER_REV'
        };

        self.feedRateMode = ko.observable(self.feedRateModes.G93); 

        self.setFeedRateMode = function(gcodes){
            if(gcodes.indexOf(930) !== -1)
                self.feedRateMode(self.feedRateModes.G93);
            else if(gcodes.indexOf(940) !== -1)
                self.feedRateMode(self.feedRateModes.G94);
            else if(gcodes.indexOf(950) !== -1)
                self.feedRateMode(self.feedRateModes.G95);
        };
       
        self.isFeedRateClamped = ko.observable(false);

        self.feedRatePerc = ko.computed( function() {
            return (self.linuxCNCServer.vars.feedrate.data() * 100).toFixed(0);
        });

        self.feedRateText = ko.computed( function() {
          var rate = self.linuxCNCServer.vars.settings.data()[1] * self.linuxCNCServer.vars.feedrate.data();
          var velInDisplayUnits, maxVel;
          if(self.linuxCNCServer.vars.rotary_motion_only.data()){
            velInDisplayUnits = rate;
            // V2 rotational axis max speed 40 deg/sec=2400 deg/min
            maxVel = 2400;
          }
          else{
            velInDisplayUnits = (rate / lcncsvr.DisplayUnitsToProgramUnits(1));
            maxVel = parseFloat(self.maxVelText()); 
          }

          if(self.feedRateMode() === self.feedRateModes.G95){
            //in G95 mode, linear velocity = feedrate * spindlerate
            velInDisplayUnits = velInDisplayUnits * self.linuxCNCServer.vars.settings.data()[2];
          }

          if( velInDisplayUnits > maxVel ){
            self.isFeedRateClamped(true);
            velInDisplayUnits = maxVel;
          }
          else{
            self.isFeedRateClamped(false);
          }
          
          return velInDisplayUnits.toFixed(self.displayPrecision);
        });

        self.spindleRatePerc = ko.computed( function() {
            return (self.linuxCNCServer.vars.spindlerate.data() * 100).toFixed(0);
        });
        
        self.spindleRateText = ko.computed( function() {
            return (self.linuxCNCServer.vars.settings.data()[2] * self.linuxCNCServer.vars.spindlerate.data()).toFixed(0);
        });

        self.performingWarmup = ko.computed(function() {
          if( lcncsvr.vars["halpin_hss_warmup.performing_warmup"].data() )
            return true
          else return false
        });

        self.pausedWarmupAlert = ko.computed(function() {
          if( self.performingWarmup() && self.linuxCNCServer.vars.paused.data() ){
            $.pnotify({
              type: "warning",
              title: "Alert",
              text: "The warmup routine has been paused and will not progress until resumed."
            });
          }
        });

        self.interlockClosed = ko.computed(function() {
          if( lcncsvr.vars.halsig_interlockClosed.data() )
            return true
          else return false
        });

        self.programPausedByInterlock = ko.computed(function() {
          if( lcncsvr.vars['halpin_interlock.program-paused-by-interlock'].data() )
            return true
          else return false
        });

	};

	return ViewModel;
});
