define(function(require) {

  var template = require('text!./view_toolingOptions.html');
  var nls = require('i18n!./nls/resources');
  var utils = require('../../../../core/helpers/utility.js');

  var ViewModel = function(moduleContext) {

    var self = this;
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
        self.settings = moduleContext.getSettings();

        self.nextUniqueElementID = ko.observable(Date.now());

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

            self.linuxCNCServer.vars.config_overlay.data.subscribe( function(newVal)
            {
                for (let i = 0; i < newVal.parameters.length; i++ ) {
                  let values = newVal.parameters[i].values;
                  console.log(values);
                  if(values.name == "M6_TOOL_PROBE"){
                    console.log('in here');
                    $(self.Panel.getJQueryElement()).find('#m6ToolProbe_toggle').bootstrapSwitch('setState',Number(newVal.parameters[i].values.value));
                  }
                }
            });
        }
    };

    self.setM6ToolProbe = function()
    {
        self.linuxCNCServer.setM6ToolProbe( $( '#m6ToolProbe_toggle', self.Panel.getJQueryElement() ).bootstrapSwitch('status'));
    };

  };

  return ViewModel;
});
