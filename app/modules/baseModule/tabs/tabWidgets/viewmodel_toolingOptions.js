define(function(require) {

  var template = require('text!./view_toolingOptions.html');
  var nls = require('i18n!./nls/resources');
  var utils = require('../../../../core/helpers/utility.js');

  var ViewModel = function(moduleContext) {

    var self = this;
    self.Panel = null;
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

    this.m6ToolProbeActual = ko.observable(0); 
    this.m6ToolProbeLocal = ko.observable(0); 

    this.initialize = function( Panel ) {
        if (self.Panel == null)
        {
            self.Panel = Panel;
            
            $('.switch', self.Panel.getJQueryElement()).bootstrapSwitch();

            self.linuxCNCServer.vars.config_overlay.data.subscribe( function(newVal)
            {
                for (let i = 0; i < newVal.parameters.length; i++ ) {
                  let values = newVal.parameters[i].values;
                  if(values.name == "M6_TOOL_PROBE"){
                    self.m6ToolProbeActual( Number(values.value) );
                    self.m6ToolProbeLocal( Number(values.value) );
                    $(self.Panel.getJQueryElement()).find('#m6ToolProbe_toggle').bootstrapSwitch('setState',Number(values.value));
                  }
                }
            });
        }
    };

    self.m6Info = nls.M6Info;

    self.isM6LocalDifferent = ko.computed(function(){
      return self.m6ToolProbeLocal() != self.m6ToolProbeActual();
    }, self);

    
    self.setM6ToolProbeLocal = function()
    {
      self.m6ToolProbeLocal( $( '#m6ToolProbe_toggle', self.Panel.getJQueryElement() ).bootstrapSwitch('status') );
    };

    self.setM6ToolProbeActual = function()
    {
      self.linuxCNCServer.setM6ToolProbe( $( '#m6ToolProbe_toggle', self.Panel.getJQueryElement() ).bootstrapSwitch('status'));
    };

  };

  return ViewModel;
});
