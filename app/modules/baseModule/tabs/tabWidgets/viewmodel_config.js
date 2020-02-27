define(function(require) {

    var template = require('text!./view_config.html');
    var nls = require('i18n!./nls/resources');
    var utils = require('../../../../core/helpers/utility.js');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
        self.settings = moduleContext.getSettings();

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }

        // *** Offset settings
        this.saveOffsetSettings = function()
        {
            self.settings.persist.ProbeRadius.SaveScratch();
            self.settings.persist.GaugeHeight.SaveScratch();
        }

        this.refreshOffsetSettings = function()
        {
            self.settings.persist.ProbeRadius.ResetScratch();
            self.settings.persist.GaugeHeight.ResetScratch();
        }

        // *** Jog settings
        this.saveJogSettings = function()
        {
            self.settings.persist.JogFeedFast.SaveScratch();
            self.settings.persist.JogFeedSlow.SaveScratch();
            self.settings.persist.JogStep1.SaveScratch();
            self.settings.persist.JogStep2.SaveScratch();
            self.settings.persist.JogStep3.SaveScratch();
            self.settings.persist.JogStep4.SaveScratch();

        }

        this.refreshJogSettings = function()
        {
            self.settings.persist.JogFeedFast.ResetScratch();
            self.settings.persist.JogFeedSlow.ResetScratch();
            self.settings.persist.JogStep1.ResetScratch();
            self.settings.persist.JogStep2.ResetScratch();
            self.settings.persist.JogStep3.ResetScratch();
            self.settings.persist.JogStep4.ResetScratch();
        }

        // *** Display Settings
        this.getBPColorText = (function(obs)
        {
            var c = obs.Scratch();
            return "rgb(" + c.r + "," + c.g + "," + c.b + ")";
        });


        this.refreshDisplaySettings = function()
        {
            self.settings.persist.DisplayUnitsPerMM.ResetScratch();
            self.settings.persist.ChangeDisplayUnitsToProgramUnits.ResetScratch();
            self.settings.persist.PressureUnits.ResetScratch();
            self.settings.persist.TemperatureUnits.ResetScratch();
        }

        this.saveDisplaySettings = function()
        {
            self.settings.persist.ChangeDisplayUnitsToProgramUnits.SaveScratch();
            self.settings.persist.DisplayUnitsPerMM.SaveScratch();
            self.settings.persist.PressureUnits.SaveScratch();
            self.settings.persist.TemperatureUnits.SaveScratch();
        }

        this.refreshBackplotSettings = function()
        {
            self.settings.persist.BPShowGrid.ResetScratch();

            // coordinate color pickers
            self.colorFields.forEach( function(el) {
                el[1].ResetScratch();
                $("#"+el[0], self.Panel.getJQueryElement()).colorpicker('setValue',self.getBPColorText(el[1]));
            });

            $(self.Panel.getJQueryElement()).find('#config_bpgrid_toggle').bootstrapSwitch('setState',self.settings.persist.BPShowGrid.Scratch());
        }

        this.saveBackplotSettings = function()
        {
            self.settings.persist.BPShowGrid.SaveScratch();
            self.colorFields.forEach( function(el) { el[1].SaveScratch(); } );
        }


		this.initialize = function( Panel ) {
            if (_.isUndefined(self.Panel))
            {
                self.Panel = Panel;

                // initialize individual tab values
                $('#OffsetsTab', self.Panel.getJQueryElement()).on('shown', this.refreshOffsetSettings );
                $('#DisplayTab', self.Panel.getJQueryElement()).on('shown', this.refreshDisplaySettings );
                $('#BackplotTab', self.Panel.getJQueryElement()).on('shown', this.refreshBackplotSettings );
                $('#JogTab', self.Panel.getJQueryElement()).on('shown', this.refreshBackplotSettings );

                $('#myTab a:first', self.Panel.getJQueryElement() ).tab('show');

                // setup colorpickers
                var setupColorPicker = function( element_name, observable ) {
                    $("#"+element_name, self.Panel.getJQueryElement()).colorpicker({format:"rgb"});
                    $("#"+element_name, self.Panel.getJQueryElement()).colorpicker().on('changeColor',function(ev){
                        observable.Scratch( ev.color.toRGB() );
                        $("#"+element_name, self.Panel.getJQueryElement()).val(self.getBPColorText(observable));
                    });
                }

                self.colorFields = [
                    ["inputBackplotBackgroundColor",self.settings.persist.BPBGColor],
                    ["inputBackplotFeedColor",self.settings.persist.BPFeedColor],
                    ["inputBackplotFeedExecutedColor",self.settings.persist.BPFeedExecutedColor],
                    ["inputBackplotTraverseColor",self.settings.persist.BPTraverseColor],
                    ["inputBackplotTraverseExecutedColor",self.settings.persist.BPTraverseExecutedColor],
                    ["inputBackplotGridColor",self.settings.persist.BPGridColor],
                    ["inputBackplotGridMajorColor",self.settings.persist.BPGridMajorColor]
                ];

                self.colorFields.forEach( function(el) {setupColorPicker(el[0],el[1]);});

                // setup toggle controls
                $('.switch', self.Panel.getJQueryElement()).bootstrapSwitch();
                self.settings.persist.BPShowGrid.subscribe( function(newVal)
                {
                    $(self.Panel.getJQueryElement()).find('#config_bpgrid_toggle').bootstrapSwitch('setState',newVal);
                });

            }
        }

        this.setBackplotGrid = function(){
            self.settings.persist.BPShowGrid.Scratch( $( '#config_bpgrid_toggle', self.Panel.getJQueryElement() ).bootstrapSwitch('status') ? true : false );
        }

        this.getDetectedHardwareString = function() {
          var board_revision = self.linuxCNCServer.vars.board_revision.data();
          
          if(board_revision) {
            var revision = board_revision.split("rev");
            return revision[0] + " Revision " + revision[1];
          } else {
            return "Detecting version...";
          }
        };
        this.toggleV1ButtonVisible = ko.computed(function() {
          var board_revision = self.linuxCNCServer.vars.board_revision.data();

          return (board_revision === "v1revH" || board_revision === "v2revP");
        });
        this.toggleV1ButtonText = ko.computed(function() {
          var board_revision = self.linuxCNCServer.vars.board_revision.data();
          
          if(board_revision === "v2revP") {
            return "Set v1";
          } else if(board_revision === "v1revH") {
            return "Set v2 Revision P";
          }
        });
        this.diskTotal = ko.computed( function() {
            if(self.linuxCNCServer.vars.system_status.data().disk) {
                return self.linuxCNCServer.vars.system_status.data().disk.total;
            }
            return 100;
        });
        this.diskOther = ko.computed( function() {
            if(self.linuxCNCServer.vars.system_status.data().disk) {
                return self.linuxCNCServer.vars.system_status.data().disk.other;
            }
            return 100;
        });
        this.diskLogs = ko.computed( function() {
            if(self.linuxCNCServer.vars.system_status.data().disk) {
                return self.linuxCNCServer.vars.system_status.data().disk.logs;
            }
            return 0;
        });
        this.diskNCFiles = ko.computed( function() {
            if(self.linuxCNCServer.vars.system_status.data().disk) {
                return self.linuxCNCServer.vars.system_status.data().disk.ncfiles;
            }
            return 0;
        });
        this.addresses = ko.computed(function() {
            if(self.linuxCNCServer.vars.system_status.data().addresses) {
                return self.linuxCNCServer.vars.system_status.data().addresses;
            }

            return [];
        });

        self.swapExists = ko.computed(function() {
            if(self.linuxCNCServer.vars.system_status.data().swap && self.linuxCNCServer.vars.system_status.data().swap.exists)
                return self.linuxCNCServer.vars.system_status.data().swap.exists;
        });
        self.swapEnabled = ko.computed(function() {
            if(self.linuxCNCServer.vars.system_status.data().swap && self.linuxCNCServer.vars.system_status.data().swap.on)
                return self.linuxCNCServer.vars.system_status.data().swap.on;
        });
        self.swapStatusText = ko.computed(function(){
            if(self.swapExists()){
                if(self.swapEnabled())
                    return "The swap file has been created and enabled.";
                else
                    return "The swap file has been created but is not enabled.";
            }
            else
                return "The swap file has not been created.";
        });
        self.swapInfo = nls.SwapInfo;
        self.swapTooltip = ko.computed(function(){
            if(self.swapExists()){
                if(self.swapEnabled())
                    return "The swap file is in use by the system as additional memory.'";
                else
                    return "The swap file has been created, allocated disk space, and given an entry in the file system table, but is not yet enabled for use as memory.";
            }
            else
                return "The swap file will allow your system to use disk space as additional memory.";
        });

        self.processingSwapCmd = ko.observable(false);

        //Generic function for manipulating swap so we can listen for server reply and disable buttons in one place
        this.swapCommand = function( data, event ) {
          if( !self.processingSwapCmd() ){
            self.processingSwapCmd(true);
            var gotCmdResponse = gotSystemStatus = false;
            function listenForSwapCmdReply(event){
              var msg = JSON.parse(event.data);
              gotCmdResponse = gotCmdResponse || msg.data.isSwapCmd;
              gotSystemStatus = gotSystemStatus || msg.id === 'system_status';
              if( gotCmdResponse && gotSystemStatus ){
                self.processingSwapCmd(false);
                self.linuxCNCServer.socket.removeEventListener('message', listenForSwapCmdReply);
              }
            }
            self.linuxCNCServer.socket.addEventListener('message', listenForSwapCmdReply);
            self.linuxCNCServer[String(event.target.id)]();
            self.linuxCNCServer.refreshSystemStatus();
          }
        };

        this.diskAvailable = ko.computed( function() {
            if(self.linuxCNCServer.vars.system_status.data().disk) {
                return self.linuxCNCServer.vars.system_status.data().disk.available;
            }
            return 0;
        });
        this.getVersion = ko.computed( {
            read: function() {
                return self.linuxCNCServer.vars.current_version.data.Scratch();
            },
            write: function(newval) {
                self.linuxCNCServer.vars.current_version.data.Scratch(newval);
            }
        });

        this.saveVersion = function() {
            self.linuxCNCServer.setVersion(self.linuxCNCServer.vars.current_version.data.Scratch());
            self.linuxCNCServer.SettingVersion(true);
        };

        this.getDisplayUnitValue = ko.computed(
        {
            read: function() {
                if (self.settings.persist.ChangeDisplayUnitsToProgramUnits.Scratch())
                    return "PROGRAM";

                switch (self.settings.persist.DisplayUnitsPerMM.Scratch())
                {
                    case 1: return "MM"; break;
                    case 1/10: return "CM"; break;
                    default: return "INCH"; break;
                }
            },
            write: function(newval){
                switch (newval)
                {
                    case "PROGRAM":
                        self.settings.persist.ChangeDisplayUnitsToProgramUnits.Scratch(true);
                        self.settings.persist.DisplayUnitsPerMM.Scratch(self.linuxCNCServer.ProgramUnitsPerMM());
                        break;
                    case "MM":
                        self.settings.persist.ChangeDisplayUnitsToProgramUnits.Scratch(false);
                        self.settings.persist.DisplayUnitsPerMM.Scratch(1);
                        break;
                    case "CM":
                        self.settings.persist.ChangeDisplayUnitsToProgramUnits.Scratch(false);
                        self.settings.persist.DisplayUnitsPerMM.Scratch(1/10);
                        break;
                    default:
                        self.settings.persist.ChangeDisplayUnitsToProgramUnits.Scratch(false);
                        self.settings.persist.DisplayUnitsPerMM.Scratch(1/25.4);
                        break;
                }
            }
        });

        this.getPressureUnitValue = ko.computed(
        {
            read: function() {
                return self.settings.persist.PressureUnits.Scratch();
            },
            write: function(newval){
                self.settings.persist.PressureUnits.Scratch(newval);
            }
        });

        this.getTemperatureUnitValue = ko.computed(
        {
            read: function() {
                return self.settings.persist.TemperatureUnits.Scratch();
            },
            write: function(newval){
                console.log(newval);
                self.settings.persist.TemperatureUnits.Scratch(newval);
            }
        });

        this.launchServerConfig = function()
        {
            window.open( "http://" + self.linuxCNCServer.server_address() + ":" + self.linuxCNCServer.server_port(),'_blank');
        }

        this.launchServerHelp = function()
        {
            window.open( "/external/linuxCNCDoc//linuxCNCDocumentation/index.html", "Linux CNC Server Documentation", "height=700,width=1024,scrollbars=yes,resizable=1,location=no,status=no,toolbar=no");
        }

	};

	return ViewModel;
});
