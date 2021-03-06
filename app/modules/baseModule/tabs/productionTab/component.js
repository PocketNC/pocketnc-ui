define(function(require) {

    // Load the dependencies
    var Boiler = require('Boiler');

    var ViewModel = require('./viewmodel');
    var ViewModel_dro = require('../tabWidgets/viewmodel_dro');
    var ViewModel_jog = require('../tabWidgets/viewmodel_jog');
    var ViewModel_file = require('../tabWidgets/viewmodel_file');
    var ViewModel_run = require('../tabWidgets/viewmodel_run');
    var ViewModel_spindle = require('../tabWidgets/viewmodel_spindle');
    var ViewModel_fileOpen = require('../tabWidgets/viewmodel_fileOpen');
    var ViewModel_sensors = require('../tabWidgets/viewmodel_sensors');
    var ViewModel_gcodes = require('../tabWidgets/viewmodel_gcodes');
//    var ViewModel_backplot = require('../tabWidgets/viewmodel_backplot');

    var Component = function(moduleContext) {
		var panel = null;
        var panel_dro = null;
        var panel_jog = null;
        var panel_file = null;
        var panel_run = null;
        var panel_spindle = null;
        var panel_coolant = null;
        var panel_sensors = null;
        var panel_gcodes = null;
//        var panel_backplot = null;
        var panel_fileopen = null;
        var vm = null;
        var vm_dro = null;
        var vm_jog = null;
        var vm_file = null;
        var vm_run = null;
        var vm_fileopen = null;
        var vm_spindle = null;
        var vm_coolant = null;
        var vm_sensors = null;
        var vm_gcodes = null;
//        var vm_backplot = null;

        var privateContext = new Boiler.Context();

        // Need this here because featuresMap sometimes is not assigned when the primary activation occurs.
        moduleContext.getSettings().linuxCNCServer.featuresMap.subscribe(function(newval){
            if(newval.HIGH_SPEED_SPINDLE)
                activateSensorsWidget();
        });
        function activateSensorsWidget (){
            if (!panel_sensors) {
                vm_sensors = new ViewModel_sensors(moduleContext, privateContext);
                panel_sensors = new Boiler.ViewTemplate(panel.getJQueryElement().find("#SENSORS_PANEL"), vm_sensors.getTemplate(), vm_sensors.getNls());
                ko.applyBindings( vm_sensors, panel_sensors.getDomElement());
            }
            vm_sensors.initialize(panel_sensors);
        }

		return {
			activate : function(parent) {
				if (!panel) {
                    vm = new ViewModel(moduleContext, privateContext);
					panel = new Boiler.ViewTemplate(parent, vm.getTemplate(), vm.getNls());
                    ko.applyBindings( vm, panel.getDomElement());
				}
                vm.initialize(panel);

                if (!panel_dro) {
                    vm_dro = new ViewModel_dro(moduleContext, privateContext);
                    panel_dro = new Boiler.ViewTemplate(panel.getJQueryElement().find("#DRO_PANEL"), vm_dro.getTemplate(), vm_dro.getNls());
                    ko.applyBindings( vm_dro, panel_dro.getDomElement());
                }
                vm_dro.initialize(panel_dro);

                if (!panel_fileopen) {
                    vm_fileopen = new ViewModel_fileOpen(moduleContext, privateContext);
                    panel_fileopen = new Boiler.ViewTemplate(panel.getJQueryElement().find("#FILE_OPEN_PANEL"), vm_fileopen.getTemplate(), vm_fileopen.getNls());
                    ko.applyBindings( vm_fileopen, panel_fileopen.getDomElement());
                }
                vm_fileopen.initialize(panel_fileopen);

                if (!panel_jog) {
                    vm_jog = new ViewModel_jog(moduleContext, privateContext);
                    panel_jog = new Boiler.ViewTemplate(panel.getJQueryElement().find("#JOG_PANEL"), vm_jog.getTemplate(), vm_jog.getNls());
                    ko.applyBindings( vm_jog, panel_jog.getDomElement());
                }
                vm_jog.initialize(panel_jog);

                if (!panel_run) {
                    vm_run = new ViewModel_run(moduleContext, privateContext);
                    panel_run = new Boiler.ViewTemplate(panel.getJQueryElement().find("#RUN_PANEL"), vm_run.getTemplate(), vm_run.getNls());
                    ko.applyBindings( vm_run, panel_run.getDomElement());
                }
                vm_run.initialize(panel_run);

                if (!panel_spindle) {
                    vm_spindle = new ViewModel_spindle(moduleContext, privateContext);
                    panel_spindle = new Boiler.ViewTemplate(panel.getJQueryElement().find("#SPINDLE_PANEL"), vm_spindle.getTemplate(), vm_spindle.getNls());
                    ko.applyBindings( vm_spindle, panel_spindle.getDomElement());
                }
                vm_spindle.initialize(panel_spindle);

/*
                if (!panel_coolant) {
                    vm_coolant = new ViewModel_coolant(moduleContext, privateContext);
                    panel_coolant = new Boiler.ViewTemplate(panel.getJQueryElement().find("#COOLANT_PANEL"), vm_coolant.getTemplate(), vm_coolant.getNls());
                    ko.applyBindings( vm_coolant, panel_coolant.getDomElement());
                }
                vm_coolant.initialize(panel_coolant);
*/
                if (!panel_gcodes) {
                    vm_gcodes = new ViewModel_gcodes(moduleContext, privateContext);
                    panel_gcodes = new Boiler.ViewTemplate(panel.getJQueryElement().find("#GCODES_PANEL"), vm_gcodes.getTemplate(), vm_gcodes.getNls());
                    ko.applyBindings( vm_gcodes, panel_gcodes.getDomElement());
                }
                vm_gcodes.initialize(panel_gcodes);

                if(moduleContext.getSettings().linuxCNCServer.featuresMap().HIGH_SPEED_SPINDLE){
                    if (!panel_sensors) {
                        vm_sensors = new ViewModel_sensors(moduleContext, privateContext);
                        panel_sensors = new Boiler.ViewTemplate(panel.getJQueryElement().find("#SENSORS_PANEL"), vm_sensors.getTemplate(), vm_sensors.getNls());
                        ko.applyBindings( vm_sensors, panel_sensors.getDomElement());
                    }
                    vm_sensors.initialize(panel_sensors);
                  }

                /*
                if (!panel_backplot) {
                    vm_backplot = new ViewModel_backplot(moduleContext, privateContext);
                    panel_backplot = new Boiler.ViewTemplate(panel.getJQueryElement().find("#BACKPLOT_PANEL"), vm_backplot.getTemplate(), vm_backplot.getNls());
                    ko.applyBindings( vm_backplot, panel_backplot.getDomElement());
                }
                vm_backplot.initialize(panel_backplot);
                */

                if (!panel_file) {
                    vm_file = new ViewModel_file(moduleContext, privateContext);
                    panel_file = new Boiler.ViewTemplate(panel.getJQueryElement().find("#FILE_PANEL"), vm_file.getTemplate(), vm_file.getNls());
                    ko.applyBindings( vm_file, panel_file.getDomElement());
                }
                vm_file.initialize(panel_file);

                panel.show();

                //moduleContext.notify("ActivatedTabNeedsResize",panel_backplot.getJQueryElement());

			},



			deactivate : function() {
				if (panel) {
					panel.hide();
				}
			}
		};
	};

	return Component;

});
