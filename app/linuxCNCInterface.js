/**
 * User: Peter Jensen
 * Date: 4/29/13
 * Time: 10:52 PM
 */

define(function (require) {

    console.debug("LINUXCNC SERVER STARTUP");

    //dependencies
    var Boiler = require("Boiler"); // BoilerplateJS namespace used to access core classes, see above for the definition

    var lcncsvr = {};

    // constants
    lcncsvr.STATE_ESTOP=1;
    lcncsvr.STATE_ESTOP_RESET=2;
    lcncsvr.STATE_OFF=3;
    lcncsvr.STATE_ON=4;

    lcncsvr.TASK_MODE_AUTO=2;
    lcncsvr.TASK_MODE_MANUAL=1;
    lcncsvr.TASK_MODE_MDI=3;

    lcncsvr.TASK_INTERP_IDLE=1;
    lcncsvr.TASK_INTERP_READING=2;
    lcncsvr.TASK_INTERP_PAUSED=3;
    lcncsvr.TASK_INTERP_WAITING=4;

    lcncsvr.UNITS_INCHES=1;
    lcncsvr.UNITS_MM=2;
    lcncsvr.UNITS_CM=3;

    lcncsvr.axisNames = ["X", "Y", "Z", "A", "B", "C", "U", "V", "W"];

    // Network settings
    lcncsvr.server_address = ko.observable(location.hostname);
    lcncsvr.server_port = ko.observable("8000");
    lcncsvr.server_username = ko.observable("default");
    lcncsvr.server_password = ko.observable("default");


    lcncsvr.server_open = ko.observable(false);
    lcncsvr.server_logged_in = ko.observable(false);
    lcncsvr.serverReconnectCheckInterval = 2000;
    lcncsvr.serverReconnectHBTimeoutInterval = 5000;

    lcncsvr.jog_step = ko.observable(0.001);
    lcncsvr.jog_speed_fast = ko.observable(1);
    lcncsvr.jog_speed_slow = ko.observable(1);

    lcncsvr.features = ko.observableArray([]);
    lcncsvr.featuresMap = ko.computed(function() {
      var features = lcncsvr.features();
      var map = {};
      features.forEach(function(feature) {
        map[feature] = true;
      });

      return map;
    });

    lcncsvr.featuresMap.subscribe(function(newval) {
      lcncsvr.sendAllWatchRequests(true);
    });

    lcncsvr.vars = {};
    lcncsvr.vars.client_config = { data: ko.observable({invalid:true}), watched: true };
    lcncsvr.vars.config_overlay = { data: ko.observable(), watched: true };
    lcncsvr.vars.linear_units = { data: ko.observable(1), watched: true };
    lcncsvr.vars.program_units = { data: ko.observable(0), watched: true };
    lcncsvr.vars["halpin_halui.max-velocity.value"] = { data: ko.observable("1"), watched: true };
    lcncsvr.vars["halpin_spindle_voltage.speed_measured"] = { data: ko.observable("1"), watched: true };
    lcncsvr.vars["halpin_hss_warmup.full_warmup_needed"] = { data: ko.observable(true), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars["halpin_hss_warmup.warmup_needed"] = { data: ko.observable(true), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars["halpin_hss_warmup.performing_warmup"] = { data: ko.observable(false), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars["halpin_hss_sensors.pressure"] = { data: ko.observable(""), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars["halpin_hss_sensors.temperature"] = { data: ko.observable(""), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars.pressure_data = { data: ko.observableArray([]), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };
    lcncsvr.vars.temperature_data = { data: ko.observableArray([]), watched: true, requiresFeature: 'HIGH_SPEED_SPINDLE' };

    lcncsvr.isClientConfigValid = function()
    {
        try {
            return (lcncsvr.vars.client_config.data().invalid) != true;
        } catch(ex) { return false; }
    }

    // Client settings
    lcncsvr.DisplayUnitsPerMM = ko.observable(1);
    lcncsvr.DisplayPrecision = ko.computed(function(){ if (lcncsvr.DisplayUnitsPerMM() >= 1) return 3; return 4; });
    lcncsvr.ChangeDisplayUnitsToProgramUnits = ko.observable(false);
    
    lcncsvr.PressureUnits = ko.observable("PSIA");
    lcncsvr.TemperatureUnits = ko.observable("F");


    lcncsvr.CheckingUSBFileForUpdates = ko.observable(false);
    lcncsvr.CheckingForUpdates = ko.observable(false);
    lcncsvr.SettingVersion = ko.observable(false);

    lcncsvr.vars.program_units.data.subscribe( function(newvalue) {
        if (lcncsvr.ChangeDisplayUnitsToProgramUnits())
        {
            if (newvalue == 1)
                lcncsvr.DisplayUnitsPerMM(1/25.4);
            else if (newvalue == 2)
                lcncsvr.DisplayUnitsPerMM(1);
            else if (newvalue == 3)
                lcncsvr.DisplayUnitsPerMM(0.1);
        }
    });

    lcncsvr.vars.client_config.data.subscribe( function(newval){
        if ("ChangeDisplayUnitsToProgramUnits" in lcncsvr.vars.client_config.data())
        {
            lcncsvr.ChangeDisplayUnitsToProgramUnits(lcncsvr.vars.client_config.data().ChangeDisplayUnitsToProgramUnits);
            lcncsvr.vars.program_units.data.valueHasMutated();
        } else
        if ("DisplayUnitsPerMM" in lcncsvr.vars.client_config.data())
            lcncsvr.DisplayUnitsPerMM(lcncsvr.vars.client_config.data().DisplayUnitsPerMM);
    });

    // UNIT CONVERSION

    lcncsvr.MachineUnitsToDisplayUnitsLinearScaleFactor = ko.computed(function()
    {
        var MachineUnitPerMM = lcncsvr.vars.linear_units.data();
        return lcncsvr.DisplayUnitsPerMM() / MachineUnitPerMM;
    });

    lcncsvr.MachineUnitsToDisplayUnitsLinear = function(val)
    {
        try {
            return val * lcncsvr.MachineUnitsToDisplayUnitsLinearScaleFactor();
        } catch(ex) {}
    }

    lcncsvr.MachineUnitsToDisplayUnitsLinearPos = function(v)
    {
        try {
            var val = v.slice(0);
            var sf = lcncsvr.MachineUnitsToDisplayUnitsLinearScaleFactor();

            for (i = 0; i < 3; i++)
                val[i] = val[i] * sf;
            for (i = 6; i < 9; i++)
                val[i] = val[i] * sf;
            return val;
        } catch(ex) {}
    }

    lcncsvr.DisplayUnitsToMachineUnits = function(val)
    {
        try {
            var MachineUnitPerMM = lcncsvr.vars.linear_units.data();
            return val * MachineUnitPerMM / lcncsvr.DisplayUnitsPerMM();
        } catch(ex) {}
    }

    lcncsvr.DisplayUnitsToMachineUnitsPos = function(v)
    {
        try{
            var MachineUnitPerMM = lcncsvr.vars.linear_units.data();
            var DisplayUnitsPerMM = lcncsvr.DisplayUnitsPerMM()
            var val = v.slice(0);

            for (i = 0; i < 3; i++)
                val[i] = val[i] * MachineUnitPerMM / DisplayUnitsPerMM;
            for (i = 6; i < 9; i++)
                val[i] = val[i] * MachineUnitPerMM / DisplayUnitsPerMM;
            return val;
        } catch(ex) {}
    }

    lcncsvr.ProgramUnitsPerMM = ko.computed(function()
    {
        var punits = lcncsvr.vars.program_units.data();
        var vProgramUnitsPerMM = 1;
        if (punits == lcncsvr.UNITS_INCHES )
            vProgramUnitsPerMM = 1/25.4;
        else
        if (punits == lcncsvr.UNITS_CM )
            vProgramUnitsPerMM = 1/10;
        return vProgramUnitsPerMM;
    });

    lcncsvr.DisplayUnitsToProgramUnits = function(val)
    {
        try {
            return val * lcncsvr.ProgramUnitsPerMM() / lcncsvr.DisplayUnitsPerMM();
        } catch(ex) {}
    }

    lcncsvr.DisplayUnitsToProgramUnitsPos = function(v)
    {
        try{
            var val = v.slice(0);
            var pupmm = lcncsvr.ProgramUnitsPerMM();
            var dupmm = lcncsvr.DisplayUnitsPerMM();

            for (i = 0; i < 3; i++)
                val[i] = val[i] * pupmm / dupmm;
            for (i = 6; i < 9; i++)
                val[i] = val[i] * pupmm / dupmm;
            return val;
        } catch(ex) {}
    }

    // Function to format position values for display and avoid flickering negative sign on near-zero values

    lcncsvr.FormatDisplayNumber = function(rawVal)
    {
        minAbsVal = Math.pow(0.1, lcncsvr.DisplayPrecision());
        if(Math.abs(rawVal) < minAbsVal){
            rawVal = 0;
        }
        return rawVal.toFixed(lcncsvr.DisplayPrecision());
    }

    // ***************
    // ***************
    // state variables
    // ***************
    // ***************


    lcncsvr.vars.actual_position = { data: ko.observableArray([0, 0, 0, 0, 0, 0, 0, 0, 0]), watched: true };
    lcncsvr.vars.actual_positionDisplay = { data: ko.computed(function(){ return lcncsvr.MachineUnitsToDisplayUnitsLinearPos(lcncsvr.vars.actual_position.data()) }), watched: false, local:true };

    lcncsvr.vars.g5x_offset = { data: ko.observableArray([0, 0, 0, 0, 0, 0, 0, 0, 0]), watched: true };
    lcncsvr.vars.g5x_offsetDisplay = { data: ko.computed(function(){ return lcncsvr.MachineUnitsToDisplayUnitsLinearPos(lcncsvr.vars.g5x_offset.data()) }), watched: false, local:true };

    lcncsvr.vars.g5x_index = { data: ko.observable(1), watched: true };
    
    //Clamp g5x_index because LinuxCNC improperly sets it to 0 on startup
    lcncsvr.vars.g5x_index.data.subscribe( function(newval) {
        if(newval < 1)
            lcnc.vars.g5x_index(1);
        else if (newval > 9)
            lcnc.vars.g5x_index(9);
    });

    lcncsvr.vars.g92_offset = { data: ko.observableArray([0, 0, 0, 0, 0, 0, 0, 0, 0]), watched: true };
    lcncsvr.vars.g92_offsetDisplay = { data: ko.computed(function(){ return lcncsvr.MachineUnitsToDisplayUnitsLinearPos(lcncsvr.vars.g92_offset.data()) }), watched: false, local:true };

    lcncsvr.vars.tool_offset = { data: ko.observableArray([0, 0, 0, 0, 0, 0, 0, 0, 0]), watched: true };
    lcncsvr.vars.tool_offsetDisplay = { data: ko.computed(function(){ return lcncsvr.MachineUnitsToDisplayUnitsLinearPos(lcncsvr.vars.tool_offset.data()) }), watched: false, local:true };

    lcncsvr.vars.estop = { data: ko.observable(0), watched: true };
    lcncsvr.vars.task_state = { data: ko.observable(0), watched: true };
    lcncsvr.vars.task_mode = { data: ko.observable(0), watched: true };
    lcncsvr.vars.interp_state = { data: ko.observable(0), watched: true };
    lcncsvr.vars.queue_full = { data: ko.observable(false), watched: true };
    lcncsvr.vars.paused = { data: ko.observable(false), watched: true };
    lcncsvr.vars.mist =  { data: ko.observable(false), watched: true };
    lcncsvr.vars.flood =  { data: ko.observable(false), watched: true };
    lcncsvr.vars.spindle_enabled = { data: ko.observable(false), watched: true };
    lcncsvr.vars.spindle_brake = { data: ko.observable(false), watched: true };
    lcncsvr.vars.spindle_speed = { data: ko.observable(0), watched: true };
    lcncsvr.vars.tool_in_spindle = { data: ko.observable(0), watched: true };
    lcncsvr.vars.homed = { data: ko.observableArray([0, 0, 0, 0, 0, 0, 0, 0, 0]), watched: true };
    lcncsvr.vars.gcodes = { data: ko.observableArray([]), watched: true };
    lcncsvr.vars.mcodes = { data: ko.observableArray([]), watched: true };
    lcncsvr.vars.settings = { data: ko.observableArray([]), watched: true };
    lcncsvr.vars.file = { data: ko.observable(""), watched: true };
    lcncsvr.vars.motion_line = { data: ko.observable(0), watched: true };
    lcncsvr.vars.optional_stop = { data: ko.observable(false), watched: true };
    lcncsvr.vars.error = { data: ko.observable(""), watched: true };
    lcncsvr.vars.spindlerate = { data: ko.observable(1), watched: true };
    lcncsvr.vars.feedrate = { data: ko.observable(1), watched: true };
    lcncsvr.vars.ls = { data: ko.observableArray([]), watched: true };
    lcncsvr.vars.usb_detected = { data: ko.observable(false), watched: true };
    lcncsvr.vars.usb_detected.data.subscribe(function (newval) {
      lcncsvr.request_usb_map();
      lcncsvr.request_usb_software_files();
    });
    lcncsvr.vars.usb_map = { data: ko.observable(""), watched: false };
    lcncsvr.vars.usb_software_files = { data: ko.observable([]), watched: false };
    lcncsvr.vars.tool_table = {data: ko.observableArray([]), watched: true };
    lcncsvr.vars.rtc_seconds = { data: ko.observable(0), watched: true };
    lcncsvr.vars.rotary_motion_only = {data: ko.observable(false), watched: true };
    lcncsvr.vars.halsig_interlockClosed = { data: ko.observable(true), watched: true, requiresFeature: 'INTERLOCK' };
    lcncsvr.vars['halpin_interlock.program-paused-by-interlock'] = { data: ko.observable(false), watched: true, requiresFeature: 'INTERLOCK' };

    lcncsvr.ui_motion_line = ko.observable(0); // motion_line gives incorrect values sometimes, settings[0] seems to give better results
                                               // we'll use ui_motion_line in all the component that would otherwise use motion_line and 
                                               // populate it ourselves with the best value
    lcncsvr.vars.settings.data.subscribe(function (newval) {
        if(lcncsvr.vars.interp_state.data() != 1) {
            lcncsvr.ui_motion_line(newval[0]);
        }
    });
    lcncsvr.vars.interp_state.data.subscribe(function (newval) {
        if(newval == lcncsvr.TASK_INTERP_IDLE){
            lcncsvr.vars.motion_line.data(0);
            lcncsvr.ui_motion_line(0);
        }
    });

    lcncsvr.settings = ko.observable({});

    lcncsvr.vars.axis_mask = { data: ko.observable(0), watched: true };
//    lcncsvr.vars.backplot_async = { data: ko.observable(""), watched: false, convert_to_json: true, local:true };
//    lcncsvr.vars.file.data.subscribe( function(newval){ lcncsvr.socket.send(JSON.stringify({"id": "backplot_async", "command": "get", "name": "backplot_async"})); });
    lcncsvr.vars.file_content = { data: ko.observableArray([]), watched: false, local:true };

    lcncsvr.vars.versions = { data: ko.observableArray([]), watched: false }; 
    lcncsvr.vars.current_version = { data: ko.observable("").extend({withScratch:true}), watched: false };
    lcncsvr.vars.board_revision = { data: ko.observable(""), watched: false };
    lcncsvr.vars.dogtag = { data: ko.observable(""), watched: false };
    lcncsvr.vars.system_status = { data: ko.observable(""), watched: false };
    
    lcncsvr.strippedSoftwareNames = ko.computed(function() {
      return lcncsvr.vars.usb_software_files.data().map(function(file) {
//	return file;
	return {
	  label: file.replace(/^pocketnc-/, '').replace(/.p$/, ''),
	  value: file
	};
      });
    });
    lcncsvr.filteredVersions = ko.computed(function() {
        var versions = lcncsvr.vars.versions.data();
        var boardRev = lcncsvr.vars.board_revision.data();
        var dogtag = lcncsvr.vars.dogtag.data();

        if(boardRev != "v2revP") {
            var index = versions.indexOf("v3.0.0");
            if(index > -1) {
                versions = versions.slice(index);
            } else {
                versions = [];
            }
        }

        if(dogtag != "BeagleBoard.org Debian Image 2015-02-01") {
            var index = versions.indexOf("v4.0.0");
            if(index > -1) {
                versions = versions.slice(index);
            } else {
                versions = [];
            }
        }

        return versions;
    }); 

    lcncsvr.vars.versions.data.subscribe( function(newval) {
    });

    lcncsvr.server_logged_in.subscribe( function(newval) {
        if (!newval)
        {
            console.log("SERVER_LOGGED_IN: " + newval);
            lcncsvr.vars.file.data("");
//            lcncsvr.vars.backplot_async.data("");
        }
    });

    // calculated variables
    lcncsvr.AllHomed = ko.computed(function() {
        var homed = lcncsvr.vars.homed.data();

        if(lcncsvr.AxesNumbers) {
            var axes = lcncsvr.AxesNumbers();
            for(var i = 0; i < axes.length; i++) {
                if(!homed[axes[i]]) {
                    return false;
                }
            }
            return true;
        }

        return false;
    });
    lcncsvr.estop_inverse = ko.computed(function () {
        return !lcncsvr.vars.estop.data();
    });
    lcncsvr.power_is_on = ko.computed(function () {
        return lcncsvr.vars.task_state.data() === lcncsvr.STATE_ON;
    });

    /**
     * Synthetic Variables
     */
     lcncsvr.RmtRunning = ko.computed(function(){
        return lcncsvr.vars.task_mode.data() === lcncsvr.TASK_MODE_AUTO && lcncsvr.vars.interp_state.data() !== lcncsvr.TASK_INTERP_IDLE;
     });
    lcncsvr.RmtManualInputAllowed = ko.computed( function(){
        return lcncsvr.vars.task_state.data() === lcncsvr.STATE_ON && ( lcncsvr.vars.interp_state.data() === lcncsvr.TASK_INTERP_IDLE || ( lcncsvr.vars.task_mode.data() === lcncsvr.TASK_MODE_MDI && !lcncsvr.vars.queue_full.data() ) );
    });

    lcncsvr.RmtDROProgram = ko.observable([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    lcncsvr.RmtDRO = ko.observable([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    lcncsvr.RmtDROReal = ko.computed({
        read: function () {
            var ret = [0, 0, 0, 0, 0, 0, 0, 0, 0];
            var idx;
            var act = lcncsvr.vars.actual_position.data();
            var g5x = lcncsvr.vars.g5x_offset.data();
            var g92 = lcncsvr.vars.g92_offset.data();
            var tlo = lcncsvr.vars.tool_offset.data();

            for (idx = 0; idx < 9; idx++)
                ret[idx] = act[idx] - g5x[idx] - g92[idx] - tlo[idx];
            return lcncsvr.MachineUnitsToDisplayUnitsLinearPos(ret);
        }
    });
    lcncsvr.RmtDROReal.subscribe(function(newval){
        lcncsvr.RmtDRO(newval);
        lcncsvr.RmtDROProgram( lcncsvr.DisplayUnitsToProgramUnitsPos(newval) );
    });

    lcncsvr.AxesNumbers = ko.observable([]);
    lcncsvr.AxesNumbersReal = ko.computed(function(){

        var axismask = lcncsvr.vars.axis_mask.data();
        var idx;
        var ret = [];
        for (idx = 0; idx < 9; idx++)
            if (axismask & (1 << idx))
                ret.push(idx);;
        return ret;
    });
    lcncsvr.AxesNumbersReal.subscribe(function(newval){lcncsvr.AxesNumbers(newval);});


    lcncsvr.RmtG5xString = ko.computed( function (){
        if (lcncsvr.vars.g5x_index.data() <= 6)
            return "G5" + (lcncsvr.vars.g5x_index.data() + 3);
        else
            return "G59." + (lcncsvr.vars.g5x_index.data() - 6);
     });

    lcncsvr.RmtPaused = ko.computed( function() {
       return lcncsvr.vars.interp_state.data() == lcncsvr.TASK_INTERP_PAUSED;
    });

    lcncsvr.filename_short = ko.computed( function() {
        var str = lcncsvr.vars.file.data();
        var parts = str.split('/');
        str = parts[parts.length-1];

        if (str.length > 32)
            return "..." + str.substr( str.length - 29 );
        return str;
    });

    lcncsvr.filename_nopath = ko.computed( function() {
        var str = lcncsvr.vars.file.data();
        str = str.split("/");
        str = $(str).last()[0];
        str = str || "";
        return str;
    });


    /**
     * Client Functions
    */
    lcncsvr.notifyFromServer = function ( notify ){
      lcncsvr.notify( notify['type'], notify['title'], notify['text'] );
    }

    lcncsvr.notify = function ( iType='error', iTitle='Alert', iText=''){
      iType = iType || 'error';
      iTitle = iTitle || 'Alert';
      iText = iText || '';
      $.pnotify({
        type: iType,
        title: iTitle,
        text: iText
      });
     }

    /**
     * Server Functions
     */

    lcncsvr.sendCommand = function( id, name, ordinals )
    {
        try {
            if ( lcncsvr.server_logged_in() )
            {
                var obj = { id:id, command:"put", name:name };
                if (!$.isEmptyObject(ordinals))
                    $.each( ordinals, function(idx,val){ obj[idx.toString()] = val; } );
                lcncsvr.socket.send( JSON.stringify( obj ) );
            }
        } catch (ex) { 
            console.log(ex);
            return false; 
        }
        return true;
    }

    lcncsvr._pendingCommands = [];
    lcncsvr.sendCommandWhenReady = function( id, name, ordinals )
    {
        try {
            if (lcncsvr.server_logged_in() )
                lcncsvr.sendCommand(id,name,ordinals);
            else
                lcncsvr._pendingCommands.push([id,name,ordinals]);
        } catch (e) {}
    }
    lcncsvr.server_logged_in.subscribe(function(isLoggedIn){
        if (isLoggedIn)
        {
            lcncsvr._pendingCommands.forEach(function(cmd){
                lcncsvr.sendCommand(cmd[0],cmd[1],cmd[2]);
            });
            lcncsvr._pendingCommands = [];
        }
    });

    lcncsvr.setRmtAnyMode = function( modes )
    {
        if ($.isEmptyObject(modes) || !$.isArray(modes) )
            return false;
        try {
            if ($.inArray( lcncsvr.vars.task_mode.data(), modes ) >= 0 )
                return true;
            if (lcncsvr.RmtRunning())
                return false;
            return lcncsvr.setRmtMode(modes[0]);
        } catch (ex) {
            return false;
        }
    }

    lcncsvr.setRmtMode = function( mode )
    {
        if ( lcncsvr.vars.task_mode.data() == mode )
            return true;
        if (lcncsvr.RmtRunning())
            return false;
        switch ( mode )
        {
            case lcncsvr.TASK_MODE_AUTO:
                lcncsvr.sendCommand("mode","mode",["MODE_AUTO"]);
                break;
            case lcncsvr.TASK_MODE_MANUAL:
                lcncsvr.sendCommand("mode","mode",["MODE_MANUAL"]);
                break;
            case lcncsvr.TASK_MODE_MDI:
                lcncsvr.sendCommand("mode","mode",["MODE_MDI"]);
                break;
        }
        lcncsvr.sendCommand("wait_complete","wait_complete",["1"]);
        return true;
    }

    lcncsvr.abort = function()
    {
        lcncsvr.sendCommand("abort","abort");
        return;
    }

    lcncsvr.estop = function( onoff )
    {
        if (onoff)
            lcncsvr.sendCommand("set_estop","state",["STATE_ESTOP"]);
        else
            if (lcncsvr.vars.task_state.data() === lcncsvr.STATE_ESTOP)
                lcncsvr.sendCommand("set_estop","state",["STATE_ESTOP_RESET"]);
    }

    lcncsvr.toggleEstop = function( )
    {
        if ( lcncsvr.vars.task_state.data() === lcncsvr.STATE_ESTOP )
            lcncsvr.estop( false );
        else
            lcncsvr.estop( true );
    }

    lcncsvr.toggleOptionalStop = function( )
    {
        lcncsvr.setOptionalStop(!lcncsvr.vars.optional_stop.data());
    }

    lcncsvr.setOptionalStop = function( onoff )
    {
        lcncsvr.sendCommand("set_optional_stop","set_optional_stop",[onoff]);
    }

    lcncsvr.setM6ToolProbe = function( onoff )
    {
        lcncsvr.sendCommand("set_m6_tool_probe","set_m6_tool_probe",[onoff]);
    }

    lcncsvr.machinePower = function( onoff )
    {
        if (lcncsvr.vars.task_state.data() === lcncsvr.STATE_ESTOP)
            return;

        if (onoff)
            lcncsvr.sendCommand("power","state",["STATE_ON"]);
        else
            lcncsvr.sendCommand("power","state",["STATE_OFF"]);
    }

    lcncsvr.togglePower = function( )
    {
        if (lcncsvr.vars.task_state.data() === lcncsvr.STATE_ESTOP)
            return;

        if ( lcncsvr.vars.task_state.data() === lcncsvr.STATE_OFF || lcncsvr.vars.task_state.data() === lcncsvr.STATE_ESTOP_RESET )
            lcncsvr.machinePower( true );
        else
            lcncsvr.machinePower( false );
    }

    lcncsvr.runFrom = function( lineNum )
    {
        if ( !lcncsvr.setRmtMode(lcncsvr.TASK_MODE_AUTO))
            return;

        lcncsvr.sendCommand("auto","auto",["AUTO_RUN",lineNum.toString()])
    }

    lcncsvr.runStep = function( )
    {
        if ( !lcncsvr.setRmtMode(lcncsvr.TASK_MODE_AUTO))
            return;
        lcncsvr.sendCommand("auto","auto",["AUTO_STEP"])
        return;
    }

    lcncsvr.pause = function(  )
    {
        if ( lcncsvr.vars.interp_state.data() !== lcncsvr.TASK_INTERP_READING && lcncsvr.vars.interp_state.data() !== lcncsvr.TASK_INTERP_WAITING )
            return;
        lcncsvr.sendCommand("auto","auto",["AUTO_PAUSE"])
        return;
    }


    lcncsvr.resume = function()
    {
        if (!lcncsvr.vars.paused.data())
            return;

        if (lcncsvr.vars.task_mode.data() !== lcncsvr.TASK_MODE_AUTO && lcncsvr.vars.task_mode.data() !== lcncsvr.TASK_MODE_MDI )
            return;

        if ( !lcncsvr.setRmtAnyMode([lcncsvr.TASK_MODE_AUTO,lcncsvr.TASK_MODE_MDI]))
            return;
        lcncsvr.sendCommand("auto","auto",["AUTO_RESUME"])
        return;
    }

    lcncsvr.interlockRelease = function(){
      lcncsvr.sendCommand("interlock_release", "interlock_release");
      return;
    }

    lcncsvr.togglePause = function()
    {
        if (lcncsvr.vars.paused.data())
            return lcncsvr.resume();
        else
            return lcncsvr.pause();
    }

    lcncsvr.shutdown_computer = function() {
      lcncsvr.sendCommand("shutdown_computer","shutdown_computer");
    }

    lcncsvr.request_usb_map = function(){
      lcncsvr.socket.send(JSON.stringify({"id": "usb_map", "command": "get", "name": "usb_map "}));
    }

    lcncsvr.request_usb_software_files = function(){
      lcncsvr.socket.send(JSON.stringify({"id": "usb_software_files", "command": "get", "name": "usb_software_files"}));
    }
    
    lcncsvr.eject_usb = function(){
      lcncsvr.sendCommand("eject_usb", "eject_usb");
    }

    lcncsvr.stop = function()
    {
        lcncsvr.abort();
        lcncsvr.resetClock();
        return;
    }
    
    lcncsvr.mdi = function( cmd, id )
    {
        if ($.isEmptyObject(cmd)) {
            return false;
        }
        id = id || "mdi";

        var errorText = "MDI command cannot be executed, ";
        var isError = false;
        if( lcncsvr.vars.task_state.data() !== lcncsvr.STATE_ON ){
            errorText += "machine must be out of E-stop and turned on";
            isError = true;
        }
        else if( !lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MDI) ) {
            errorText += "unable to set mode to MDI";
            isError = true;
        }
        else if( ( lcncsvr.vars.interp_state.data() !== lcncsvr.TASK_INTERP_IDLE ) && lcncsvr.vars.queue_full.data() ){
            errorText += "interpreter not idle and trajectory planner queue is full"
            isError = true;
        }
        else if( (!lcncsvr.vars.halsig_interlockClosed.data()) && lcncsvr.doesMdiEnableSpindle(cmd) ){
          errorText += "spindle cannot be turned on while enclosure is open.";
          isError = true;
        }
        if(isError){
            $.pnotify({
                type: "warning",
                title: "Alert",
                text: errorText
            });
            return false;
        }

        lcncsvr.sendCommand(id,"mdi",[cmd]);
        return true;
    }

    lcncsvr.doesMdiEnableSpindle = function( cmd )
    {
      var commentlessCmd = cmd.replace(/ *\([^)]*\) */g, '');
      var hasSCode = ( commentlessCmd.toLowerCase().indexOf('s') !== -1 )
      return hasSCode
    }
    
    lcncsvr.prepare_for_mdi = function()
    {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MDI);
        return lcncsvr.RmtManualInputAllowed();
    }

    lcncsvr.setFeedrate = function( rate )
    {
        if (!$.isNumeric(rate))
            return;
        if (rate < 0)
            rate = 0;
        lcncsvr.sendCommand("set_feed_override","set_feed_override", ["1"]);
        lcncsvr.sendCommand("set_feedrate","feedrate", [rate.toString()] );
        return;
    }

    lcncsvr.setMaxVel = function(rate) {
        if (!$.isNumeric(rate))
            return;
        if (rate < 0)
            rate = 0;
        lcncsvr.sendCommand("set_maxvel","maxvel", [rate.toString()] );
        return;
    }
    lcncsvr.incrementMaxVel = function(delta) {
        if (!$.isNumeric(delta))
            return;
        lcncsvr.sendCommand("set_maxvel","maxvel", [parseFloat(lcncsvr.vars["halpin_halui.max-velocity.value"].data()) + delta] );
        return;
    }

    lcncsvr.incrementFeedrate = function( delta )
    {
        if (!$.isNumeric(delta))
            return;

        lcncsvr.sendCommand("set_feed_override","set_feed_override", ["1"]);
        lcncsvr.sendCommand("set_feedrate","feedrate", [lcncsvr.vars.feedrate.data() + delta] );
        return;
    }

    lcncsvr.setSpindleOverride = function( rate )
    {
        if (!$.isNumeric(rate))
            return;
        if (rate < 0)
            rate = 0;

        lcncsvr.sendCommand("set_spindle_override","set_spindle_override", ["1"]);
        lcncsvr.sendCommand("setspindleoverride","spindleoverride", [rate.toString()] );
        return;
    }

    lcncsvr.incrementSpindleOverride = function( delta )
    {
        if (!$.isNumeric(delta))
            return;

        lcncsvr.sendCommand("set_spindle_override","set_spindle_override", ["1"]);
        lcncsvr.sendCommand("setspindleoverride","spindleoverride", [lcncsvr.vars.spindlerate.data() + delta] );
        return;
    }

    lcncsvr.setEnableSpindleOverride = function( onoff )
    {
        if (onOff)
            lcncsvr.sendCommand("set_spindle_override","set_spindle_override",["1"]);
        else
            lcncsvr.sendCommand("set_spindle_override","set_spindle_override",["0"]);
        return;
    }

    lcncsvr.stripPath = function(filepath) {
        var parts = filepath.split('/');
        return parts[parts.length-1];
    }

    lcncsvr.openFile = function( filename )
    {
        lcncsvr.resetClock();
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MDI);
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_AUTO);
        lcncsvr.sendCommand("program_open","program_open",[filename]);
        return;
    }


    lcncsvr.touchoff = function( g5x, axis, offset )
    {
        var cmd = "G10 L20 P" + g5x;
        if (! $.isNumeric(axis))
            cmd = cmd + axis;
        else
            cmd = cmd + lcncsvr.axisNames[axis];

        if (_.isNumber(offset))
            offset = offset.toFixed(6);

        cmd = cmd + (offset);

        lcncsvr.mdi(cmd);
    }

    lcncsvr.touchoffDisplay = function( g5x, axis, offset )
    {
        if (axis < 3 || axis > 5 )
            offset = lcncsvr.DisplayUnitsToProgramUnits(offset);
        lcncsvr.touchoff( g5x, axis, offset );
    }

    lcncsvr.touchoffCurrent = function( axis, offset )
    {
        lcncsvr.touchoff( lcncsvr.vars.g5x_index.data(), axis, offset );
    }

    lcncsvr.touchoffCurrentDisplay = function( axis, offset )
    {
        if (axis < 3 || axis > 5 )
            offset = lcncsvr.DisplayUnitsToProgramUnits(offset);
        lcncsvr.touchoff( lcncsvr.vars.g5x_index.data(), axis, offset );
    }


    lcncsvr.clearG5xAll = function( g5x )
    {
        var cmd = "G10 L2 P" + g5x;
        var axismask = lcncsvr.vars.axis_mask.data();
        var idx;
        for (idx = 0; idx < 9; idx++)
            if (axismask & (1 << idx))
                cmd = cmd + lcncsvr.axisNames[idx] + "0";
        return lcncsvr.mdi(cmd);
    }

    lcncsvr.clearG5xAllCurrent = function( )
    {
        lcncsvr.clearG5xAll(0);
    }

    lcncsvr.setG5x = function( index )
    {
        if (index <= 0 || index > 9)
            return;
        
        if (index <= 6)
            lcncsvr.mdi("G5" + (index + 3));
        else
            lcncsvr.mdi("G59." + (index - 6));
    }

    lcncsvr.touchoffAll = function( g5x )
    {
        var cmd = "G10 L20 P" + g5x;
        var axismask = lcncsvr.vars.axis_mask.data();
        var idx;
        for (idx = 0; idx < 9; idx++)
            if (axismask & (1 << idx))
                cmd = cmd + lcncsvr.axisNames[idx] + "0";
        return lcncsvr.mdi(cmd);
    }

    lcncsvr.isAxisAvailable  = function( axisnum )
    {
        return (lcncsvr.vars.axis_mask.data() & (1<<axisnum)) != 0;
    }

    lcncsvr.isAnyAxisAvailable = function()
    {
        return (lcncsvr.vars.axis_mask.data()) != 0;
    };

    lcncsvr.clearG92 = function()
    {
        return lcncsvr.mdi("G92.1");
    };

    lcncsvr.g92Set = function( axis, offset )
    {
        if (_.isNumber(offset))
            offset = offset.toFixed(6);

        var cmd = "G92 " + lcncsvr.axisNames[axis] + offset;
        return lcncsvr.mdi(cmd);
    };

    lcncsvr.g92SetDisplay = function( axis, offset )
    {
        if (axis < 3 || axis > 5)
            offset = lcncsvr.DisplayUnitsToProgramUnits(offset);

        if (_.isNumber(offset))
            offset = offset.toFixed(6);

        var cmd = "G92 " + lcncsvr.axisNames[axis] + offset;
        return lcncsvr.mdi(cmd);
    };

    lcncsvr.setG92Enable = function( onoff )
    {
        if (onoff)
            lcncsvr.mdi("G92.3");
        else
            lcncsvr.mdi("G92.2");
    };

    lcncsvr.jogIncr = function( axisNumber, dist )
    {
        try {
            lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
            if(axisNumber <= 2) {
              distMachineUnits = lcncsvr.DisplayUnitsToMachineUnits(dist);
            } else {
              distMachineUnits = dist;
            }
            lcncsvr.sendCommand( "JOG", "jog", ["JOG_INCREMENT", axisNumber, lcncsvr.jog_speed_fast(), distMachineUnits ])
        } catch(ex){}
    };

    lcncsvr.jogCont = function( axisNumber, speed )
    {
        try {
            speed = speed / 60;
            speed = speed.toFixed(3);
        } catch(ex){}

        try {
            lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
            lcncsvr.sendCommand( "JOG", "jog", ["JOG_CONTINUOUS", axisNumber, speed ])
        } catch(ex){}
    };

    lcncsvr.jogStop = function( axisNumber )
    {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
        lcncsvr.sendCommand( "JOG", "jog", ["JOG_STOP", axisNumber])
    };

    lcncsvr.homeAll = function()
    {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
        lcncsvr.sendCommand("home","home",["-1"]);
    };

    lcncsvr.homeAxis = function( axis )
    {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
        lcncsvr.sendCommand("home","home",[axis.toString()]);
    };

    lcncsvr.home = function( axis )
    {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MANUAL);
        lcncsvr.sendCommand("home","home",[ axis.toString() ]);
    };

    lcncsvr.overrideLimits = function()
    {
        lcncsvr.sendCommand("override_limits","override_limits");
    }

    lcncsvr.toggleMist = function()
    {
        var val;
        if ( lcncsvr.vars.mist.data() )
            val = "MIST_OFF";
        else
            val = "MIST_ON";
        return lcncsvr.sendCommand("mist_toggle","mist",[val]);
    }

    lcncsvr.setMist = function( onoff )
    {
        var val;
        if ( onoff )
            val = "MIST_ON";
        else
            val = "MIST_OFF";
        return lcncsvr.sendCommand("mist_toggle","mist",[val]);
    }

    lcncsvr.toggleFlood = function()
    {
        var val;
        if ( lcncsvr.vars.flood.data() )
            val = "FLOOD_OFF";
        else
            val = "FLOOD_ON";
        return lcncsvr.sendCommand("flood_toggle","flood",[val]);
    }

    lcncsvr.setFlood = function( onoff )
    {
        var val;
        if ( onoff )
            val = "FLOOD_ON";
        else
            val = "FLOOD_OFF";
        return lcncsvr.sendCommand("flood_toggle","flood",[val]);
    }

    lcncsvr.spindleForward = function() {
        return lcncsvr.sendCommand("spindle_forward","spindle",["SPINDLE_FORWARD"]);
    }
    lcncsvr.spindleOff = function() {
        return lcncsvr.sendCommand("spindle_off","spindle",["SPINDLE_OFF"]);
    }
    lcncsvr.spindleReverse = function() {
        return lcncsvr.sendCommand("spindle_reverse","spindle",["SPINDLE_REVERSE"]);
    }


    lcncsvr.toggleSpindleBrake = function()
    {
        var val;
        if ( lcncsvr.vars.spindle_brake.data() )
            val = "BRAKE_RELEASE";
        else
            val = "BRAKE_ENGAGE";
        return lcncsvr.sendCommand("spindle_brake_toggle","brake",[val]);
    }

    lcncsvr.setSpindleBrake = function( onoff )
    {
        var val;
        if ( onoff )
            val = "BRAKE_ENGAGE";
        else
            val = "BRAKE_RELEASE";
        return lcncsvr.sendCommand("spindle_brake_set","brake",[val]);
    }

    lcncsvr.loadTool = function(toolNum) {
        try {
            if(!lcncsvr.mdi("M654 T" + toolNum)) {
                console.log("failed to send load tool command");
            }
        } catch(ex) {
            console.log(ex);
        }
    }

    lcncsvr.setToolTableFull = function( toolnum, zofs, xofs, diam, front, back, orient )
    {
        try {
            var cmd = "G10 L1 P" + toolnum + " Z" + zofs + " X" + xofs + " R" + (parseFloat(diam)/2).toFixed(5) + " I" + front + " J" + back + " Q" + orient ;
            if(!lcncsvr.mdi(cmd)) {
                console.log("failed to send set tool table mdi command");
            }
        } catch (ex) {
            console.log(ex);
        }

    }

    lcncsvr.setToolTableZ = function( zOffset )
    {
        if (_.isNumber(zOffset))
            zOffset = zOffset.toFixed(6);
 
        lcncsvr.mdi( "G10 L10 P" + lcncsvr.vars.tool_in_spindle.data() + " Z" + zOffset );
        lcncsvr.mdi( "G43" );
    }

    lcncsvr.setToolTable = function( zOffset, diameter )
    {
        lcncsvr.mdi( "G10 L10 P" + lcncsvr.vars.tool_in_spindle.data() + "R" + (diameter/2) + " Z" + zOffset );
        lcncsvr.mdi( "G43" );
    }

    lcncsvr.setToolNumber = function( toolNum )
    {
        if (!_.isNaN( parseInt( toolNum)))
            lcncsvr.mdi( "M6T" + parseInt(toolNum) );
    }

    lcncsvr.clearLastError = function()
    {
        lcncsvr.sendCommand("clear_error","clear_error",[]);
    }

    lcncsvr.check_usb_file_for_updates = function(file, require_valid_signature) {
      lcncsvr.usbCheckingFile(true);
      lcncsvr.usbUpdateError("");
      lcncsvr.usbUpdateSuccess("");
      lcncsvr.sendCommandWhenReady("check_usb_file_for_updates", "check_usb_file_for_updates", [ file, require_valid_signature ]);
    };
    lcncsvr.check_for_updates = function() {
        lcncsvr.CheckingForUpdates(true);
        lcncsvr.sendCommandWhenReady("check_for_updates", "check_for_updates");
    }

    lcncsvr.setVersion = function(version) {
        lcncsvr.SettingVersion(true);
        lcncsvr.sendCommandWhenReady("set_version", "set_version", [ version ]);
    }

    lcncsvr.toggleV1V2RevP = function() {
        lcncsvr.sendCommandWhenReady("toggle_v1_v2revP", "toggle_v1_v2revP", []);
    };

    lcncsvr.getINIConfig = function() {
        lcncsvr.socket.send(JSON.stringify({"id": "ini_config", "command": "get", "name": "config" }));
    }

    lcncsvr.refreshSystemStatus = function() {
        lcncsvr.socket.send(JSON.stringify({"id": "system_status", "command": "get", "name": "system_status" }));
    }
    lcncsvr.setCurrentTime = function() {
        lcncsvr.sendCommandWhenReady("set_date", "set_date", [ new Date(Date.now()).toUTCString() ]);
        lcncsvr.refreshSystemStatus();
    }
    lcncsvr.createSwap = function(swapSizeMb) {
        ssm = (swapSizeMb || 256)
        lcncsvr.sendCommandWhenReady("create_swap", "create_swap", [ssm.toString()]);
        //Allocating the disk space can take a number of seconds, occasionally causing a HB to be missed. Refresh if that happens.
        lcncsvr.needsRefresh = true;
    }
    lcncsvr.deleteSwap = function() {
        lcncsvr.sendCommandWhenReady("delete_swap", "delete_swap", []);
    }
    lcncsvr.enableSwap = function() {
        lcncsvr.sendCommandWhenReady("enable_swap", "enable_swap", []);
    }
    lcncsvr.disableSwap = function() {
        lcncsvr.sendCommandWhenReady("disable_swap", "disable_swap", []);
    }
    lcncsvr.clearLogs = function() {
        lcncsvr.sendCommandWhenReady("clear_logs", "clear_logs", []);
        lcncsvr.refreshSystemStatus();
    }
    lcncsvr.clearNCFiles = function() {
        lcncsvr.sendCommandWhenReady("clear_ncfiles", "clear_ncfiles", []);
        lcncsvr.refreshSystemStatus();
    }

    lcncsvr.warmupSpindle = function() {
        if(lcncsvr.vars["halpin_hss_warmup.full_warmup_needed"].data())
            lcncsvr.mdi("M670");
        else
            lcncsvr.mdi("M671");
    }

    lcncsvr.getFeatures = function() {
        lcncsvr.socket.send(JSON.stringify({"id": "get_features", "command": "get", "name": "config_item", "section": "POCKETNC_FEATURES", "parameter": "" }));
    }

    lcncsvr.getINIConfigParameter = function(section, parameter) {
        lcncsvr.socket.send(JSON.stringify({"id": "ini_config_parameter", "command": "get", "name": "config_item", "section": section, "parameter": parameter }));
    }

    lcncsvr.setClientConfig = function( key, value )
    {
        lcncsvr.sendCommandWhenReady("cc","save_client_config",[key,value]);
    }

    lcncsvr.getClientConfig = function()
    {
        lcncsvr.socket.send(JSON.stringify({"id": "client_config", "command": "get", "name": "client_config"}));
    }

    lcncsvr.sendFileContentRequestOrNotify = function() {
        if (typeof(lcncsvr.vars.file_content.data()) == "string")
            lcncsvr.socket.send(JSON.stringify({"id": "file_content", "command": "get", "name": "file_content"}));
        else
            lcncsvr.vars.file_content.data.valueHasMutated();
    }

/*
    lcncsvr.sendBackplotRequestOrNotify = function () {
        var x;
        if (typeof(lcncsvr.vars.backplot_async.data()) == "string")
            x = 1;
        else
            lcncsvr.vars.backplot_async.data.valueHasMutated();
    }
    */

    lcncsvr.deleteFile = function(filename) {
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MDI);
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_AUTO);
        lcncsvr.sendCommand("program_delete","program_delete",[filename]);
    }

    lcncsvr.uploadGCode = function(filename, data) {
        lcncsvr.sendCommand("program_upload","program_upload",[filename, data]);
    }

    lcncsvr.uploadChunkGCode = function(filename, data, start, end, ovw) {
      if( end ){
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_MDI);
        lcncsvr.setRmtMode(lcncsvr.TASK_MODE_AUTO);
      }
      lcncsvr.sendCommand("program_upload_chunk","program_upload_chunk",[filename, data, start, end, ovw]);
    }

    lcncsvr.downloadChunkGCode = function(requestId, fileIdx, chunkSize) {
        lcncsvr.sendCommand(requestId, "program_download_chunk",[fileIdx, chunkSize]);
    }
   
    lcncsvr.resetClock = function(){
        lcncsvr.sendCommand("reset_clock", "reset_clock", []);
    }

    lcncsvr.sendAllWatchRequests = function (doRequiresFeature) {
        try {
            var id;
            var delayval = 0;
            $.each(lcncsvr.vars, function (key, val) {
                // this will be called once immediately after opening the web socket
                // and once again after we know what features the machine has
                if((doRequiresFeature && val.requiresFeature && lcncsvr.featuresMap()[val.requiresFeature]) ||
                   (!doRequiresFeature && !val.requiresFeature)) {

                if (val.watched) {
                    //console.debug("WEBSOCKET: send watch request for " + key);
                    if (key == "actual_position")
                        id = "a";
                    else
                        id = key;

                    if (val.indexed)
                    {
                        var idx;
                        for (idx = 0; idx <= val.max_index; idx++)
                        {
                            id = key + ":" + idx;
                            // delay each request by an increasing amount, just to make sure these don't all spam the server at once
                            (function(k,i,d,index){
                                _.delay( function(key,id, index){
                                    lcncsvr.socket.send(JSON.stringify({"id": id, "command": "watch", "name": key, "index":index }));
                                }, d, k, i, index );
                            })(key,id,delayval,idx);
                        }
                    } else
                    {
                        // delay each request by an increasing amount, just to make sure these don't all spam the server at once
                        (function(k,i,d){
                            _.delay( function(key,id){
                                lcncsvr.socket.send(JSON.stringify({"id": id, "command": "watch", "name": key}));
                            }, d, k, i  );
                        })(key,id,delayval);
                    }
                    delayval = delayval + 5;

                } else {
                    try {
                        if (!val.local)
                        {
                            id = key;

                            // delay each request by an increasing amount, just to make sure these don't all spam the server at once
                            (function(k,i,d){
                                _.delay( function(key,id){
                                    lcncsvr.socket.send(JSON.stringify({"id": id, "command": "get", "name": key}));
                                }, d, k, i  );
                            })(key,id,delayval);
                            delayval = delayval + 5;
                }
                    } catch(ex) {}
                }
              }
            });

        } catch (ex) {
        }
    }


    // **** Function to auto-reopen the connection if there hasn't been activity (heartbeat)
    //      The _.debounce causes this to not trigger unless it hasn't been called since
    //      lcncsvr.serverReconnectCheckInterval milliseconds
    lcncsvr.hbTimeout = _.debounce( function(){
        lcncsvr.reopen();
    }, lcncsvr.serverReconnectHBTimeoutInterval);
    lcncsvr.checkHB = function() {
        try {
            lcncsvr.socket.send(JSON.stringify({"id":"HB", command:"get", "name":"estop"}))
        } catch(ex) {}
    }
    lcncsvr.hbCheckIntervalID = setInterval( lcncsvr.checkHB, lcncsvr.serverReconnectCheckInterval );
    lcncsvr.usbUpdateError = ko.observable("");
    lcncsvr.usbUpdateSuccess = ko.observable("");
    lcncsvr.usbCheckingFile = ko.observable(false);

    // throttle the actual position updates
    lcncsvr.updateActualPosition = _.throttle( function(newVal){ lcncsvr.vars.actual_position.data(newVal); } , 125)

    // **** reopen the connection.  will close an existing connection
    lcncsvr.reopen = function()
    {
        try {
            lcncsvr.socket.close();
        } catch (ex) { }

        lcncsvr.hbTimeout();

        try {
            if(document.location.href.startsWith("https")) {
              lcncsvr.socket = new WebSocket("wss://" + lcncsvr.server_address() + ":" + lcncsvr.server_port() + "/websocket/");
            } else {
              lcncsvr.socket = new WebSocket("ws://" + lcncsvr.server_address() + ":" + lcncsvr.server_port() + "/websocket/");
            }
            /*
            var old_send = lcncsvr.socket.send;
            lcncsvr.socket.send = function() {
                console.log("sent message", arguments);
                old_send.apply(lcncsvr.socket, arguments);
            };
            */

            lcncsvr.socket.onopen = function () {
                lcncsvr.socket.send(JSON.stringify({"id": "LOGIN", "user": lcncsvr.server_username(), "password": lcncsvr.server_password(), date: new Date().toISOString() }));
                lcncsvr.server_open(true);

                lcncsvr.getFeatures();
                lcncsvr.sendAllWatchRequests();
            }

            lcncsvr.socket.onmessage = function (msg) {
                try {
                    var data = JSON.parse(msg.data);

                    if(data.data.notify){
                      lcncsvr.notifyFromServer(data.data.notify);
                    }

		    if(data.id == "check_usb_file_for_updates") {
		      if(data.code == "?OK") {
			if(data.data != "?OK") { // initial command returns an immediate response with data == "?OK"
			  lcncsvr.usbCheckingFile(false);
			  // we only want to response to the updated versions response
			  lcncsvr.vars.versions.data(data.data);
			  lcncsvr.usbUpdateSuccess("Successfully fetched versions from file. Select a version from the list above and click Save to update.");
			}
		      } else {
			lcncsvr.usbCheckingFile(false);
			lcncsvr.usbUpdateError(data.data);
		      }
		    }

                    if (data.code != "?OK") {
                        console.debug("WEBSOCKET: ERROR code returned " + msg.data);
                        return;
                    }

                    if(data.id == "get_features") {
                      var params = [];
                      data.data.parameters.forEach(function(param) {
                        var name = param.values.name;
                        var value = param.values.value;

                        if(value === "1") {
                          params.push(name);
                        }
                      });
                      lcncsvr.features(params);
                    }

                    if(data.id == "HB" && lcncsvr.refreshOnNextHB) {
                        console.log("reloading...");
                        window.location.reload(true);
                    }
                    if(data.id == "set_version") {
                        console.log("we need to reload once we detect the server has reestablished a connection...");
			lcncsvr.needsRefresh = true;
                    }
//                    if(data.id !== "a" && data.id !== "HB") {
//                        console.log(data);
//                    }
//                    if(["id", "command", "current_line","motion_line", "read_line","settings"].includes(data.id)) {
//                        console.log(data.id, data.data);
//                    }



                    if (data.id == "a")
                    {
                        lcncsvr.updateActualPosition(data.data);
                        return;
                    }

                    if (data.id == "LOGIN") {
                        lcncsvr.server_logged_in(true);
                    }

                    if (lcncsvr.server_logged_in())
                        lcncsvr.hbTimeout();

                    var curID = data.id.split(":");

                    if(data.id === "check_for_updates" && data.data != "?OK") {
                      lcncsvr.CheckingForUpdates(false);
                      lcncsvr.vars.versions.data(data.data);
                    }
                    if (lcncsvr.vars.hasOwnProperty(curID[0])) {
                        if (lcncsvr.vars[curID[0]].indexed)
                        {
                            if (lcncsvr.vars[curID[0]].convert_to_json) {
                                lcncsvr.vars[curID[0]].data()[curID[1]] = JSON.parse(data.data);
                            } else {
                                lcncsvr.vars[curID[0]].data()[curID[1]] = data.data;
                            }
                            lcncsvr.vars[curID[0]].data.valueHasMutated();
                        } else {
                            if (lcncsvr.vars[curID[0]].convert_to_json)
                                lcncsvr.vars[curID[0]].data(JSON.parse(data.data));
                            else
                                lcncsvr.vars[curID[0]].data(data.data);
                        }
                    }
                } catch (ex) {
//                    console.debug(ex);
                }
            }

            lcncsvr.socket.onclose = function () {
                if(lcncsvr.needsRefresh) {
                    console.log("lost connection with server... refresh on next successful HB");
                    lcncsvr.refreshOnNextHB = true;
                }
                lcncsvr.server_open(false);
                lcncsvr.server_logged_in(false);
            }
        } catch (ex) {

        }
    }

    window.lcncsvr = lcncsvr;

    return lcncsvr;

});
