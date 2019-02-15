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
                self.isTiming = true;
                self.lastUpdateTime = Date.now();
                self.runClock();
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
                    self.isTiming = true;
                    self.lastUpdateTime = Date.now();
                    self.runClock();
                    self.linuxCNCServer.resume();
                }
            }
        };

        self.singleStep = ko.observable(false);
       
        self.clockText = ko.observable("00:00:00");
        self.lastUpdateTime = 0;
        self.isTiming = false;
        
        //if the program is paused, pause the clock and set the clock text using the halpin value
        self.linuxCNCServer.vars.paused.data.subscribe( function(newval) {
            if(newval){
                self.isTiming = false;
                self.setClockText(parseFloat( self.linuxCNCServer.vars["halpin_run_time_clock.seconds"].data() ) );
            }
        });
        
        //Stop the clock if the interpreter enters the idle state
        //Don't set the clock to the current HAL pin value, because we want clock to be zeroed if the user stopped manually 
        self.linuxCNCServer.vars.interp_state.data.subscribe( function(newval) {
            if( newval === self.linuxCNCServer.TASK_INTERP_IDLE ){
                self.isTiming = false;
            }
            else if( newval === self.linuxCNCServer.TASK_INTERP_READING ){
                self.isTiming = true;
                self.runClock();
            }

        });
        
        self.linuxCNCServer.vars["halpin_run_time_clock.seconds"].data.subscribe( function() {
            //We might get a final clock update after stopping due to lag/async
            //If we stopped manually, ignore it so the clock stays zeroed 
            if( self.ignoreNextClockUpdate ){
                self.ignoreNextClockUpdate = false;
                return;
            }
       
            self.lastUpdateTime = Date.now();
            if( !self.isTiming && ( self.linuxCNCServer.vars.interp_state.data() === self.linuxCNCServer.TASK_INTERP_READING ) )
            {
                self.isTiming = true;
                self.runClock();
            }
            else if ( self.linuxCNCServer.vars.paused.data() ) {
                self.setClockText(parseFloat( self.linuxCNCServer.vars["halpin_run_time_clock.seconds"].data() ) );
            }
        });
       
        //keep the clock ticking between updates from HAL
        self.runClock = function() {
            if( self.isTiming && ( self.linuxCNCServer.vars.interp_state.data() !== self.linuxCNCServer.TASK_INTERP_IDLE ) )
            {
                var time = parseFloat( self.linuxCNCServer.vars["halpin_run_time_clock.seconds"].data() )
                                + ( ( Date.now() - self.lastUpdateTime ) / 1000 ) ;

                self.setClockText(time);
                setTimeout(function() { self.runClock(); }, 100);
            }
        };
        
        //zero the clock if a new program is opened
        self.linuxCNCServer.vars.file.data.subscribe( function(newval) {
            self.setClockText(0);
        });
       
        //if a program is stopped early, the clock should stop, zero, and not display a potential final update
        self.resetClock = function(){
            self.ignoreNextClockUpdate = true;
            self.isTiming = false;
            self.setClockText(0);
        };
 
        self.setClockText = function( totalSeconds ){
            var t = totalSeconds;
            var s = (t % 60).toFixed(0).toString().padStart(2, '0');
            var m = Math.floor((t / 60) % 60).toString().padStart(2, '0');
            var h = Math.floor(t / 3600).toString().padStart(2, '0');
            var txt = h + ':' + m + ':' + s;
            self.clockText(txt);
        };

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
