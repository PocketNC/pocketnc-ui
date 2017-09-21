define(function(require) {

    var template = require('text!./view_jog.html');
    var nls = require('i18n!./nls/resources');

    var ViewModel = function(moduleContext) {
        var self = this;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;

        self.mouseWheelOn = false;

        self.mouseWheelBufferedEvents = 0;
        self.timerSet = false;
        self.mouseWheelCallback = function(event) {
            var y = event.originalEvent.deltaY;
            if(y > 0) {
                self.mouseWheelBufferedEvents -= 1;
            } else if(y < 0) {
                self.mouseWheelBufferedEvents += 1;
            }
            if(!self.timerSet) {
                self.mouseWheelTimer = setTimeout(function() {
                    var step = self.step();
                    if(step == 0) {
                        var a = self.selected_axis();
                        if(a > 2) { // if rotational
                            step = 1;
                        } else {
                            step = .01;
                        }
                    }
                    console.log(self.mouseWheelBufferedEvents*step);
                    self.linuxCNCServer.jogIncr(self.selected_axis(), self.mouseWheelBufferedEvents*step);
                    self.mouseWheelBufferedEvents = 0;
                    self.timerSet = false;
                }, 100);
                self.timerSet = true;
            }
            event.preventDefault();
        };

        self.toggleMouseWheel = function() {
            if(self.mouseWheelOn) {
                $("body").off('wheel', self.mouseWheelCallback);
            } else {
                $("body").on('wheel', self.mouseWheelCallback);
            }
            self.mouseWheelOn = !self.mouseWheelOn;
        };

        self.linear_step_options     = [0, .1, .01, .001, .0001];
        self.a_step_options = [0,  90, 5,   1,   .5,   .05];
        self.b_step_options = [0,  360, 180, 90, 5,   1,   .5,   .05];
        self.last_linear_step = 0;
        self.last_a_step = 0;
        self.last_b_step = 0;
        self.step_multiplier = self.linuxCNCServer.MachineUnitsToDisplayUnitsLinearScaleFactor();
        self.step = ko.observable(0);
        self.selectStep = function(step) {
            self.step(step);
            console.log(step);
        };

        self.step_options = ko.observable(0);
        self.selected_axis = ko.observable(0);
        self.selectAxis = function(axis) {
            var a = self.selected_axis();
            var s = self.step();

            if(a < 3) {
                self.last_linear_step = s;
            } else if(a == 3) {
                self.last_a_step = s;
            } else if(a == 4) {
                self.last_b_step = s;
            }


            var step_options = self.linear_step_options;
            if(axis == 3) {
                step_options = self.a_step_options;
            } else if(axis == 4) {
                step_options = self.b_step_options;
            }

            var index = step_options.indexOf(s);
            if(index == -1) {
                if(axis < 3) {
                    self.step(self.last_linear_step);
                } else if(axis == 3) {
                    self.step(self.last_a_step);
                } else if(axis == 4) {
                    self.step(self.last_b_step);
                }
            }
            self.selected_axis(axis);
        };

        self.stepOptionLabel = function(s) {
            var a = self.selected_axis();
            if(a > 2) { // if rotational
                return (s == 0 ? 'Continuous' : 'Step ' + s);
            } else {
                return (s == 0 ? 'Continuous' : 'Step ' + s*self.linuxCNCServer.MachineUnitsToDisplayUnitsLinearScaleFactor());
            }
        };

        self.step_label = ko.computed(function() {
            var s = self.step();
            var a = self.selected_axis();
            if(a > 2) { // if rotational
                return (s == 0 ? 'Continuous' : 'Step ' + s);
            } else {
                return (s == 0 ? 'Continuous' : 'Step ' + s*self.linuxCNCServer.MachineUnitsToDisplayUnitsLinearScaleFactor());
            }
        });

        self.all_step_options = ko.computed(function() {
            var a = self.selected_axis();
            if(a == 3) {
                return self.a_step_options;
            } else if(a == 4) {
                return self.b_step_options;
            }
            return self.linear_step_options;
        });

        self.minus_pressed = function(data, event) {
            var multiplier = 1;
            if(self.selected_axis() > 2) {
                multiplier = 180;
            }
            if(self.step() == 0) {
                self.linuxCNCServer.jogCont(self.selected_axis(), -multiplier*self.linuxCNCServer.jog_speed_fast());
            } else {
                self.linuxCNCServer.jogIncr(self.selected_axis(), -self.step());
            }
            event.preventDefault();
        };
        self.minus_released = function(data, event) {
            if(self.step() == 0) {
                self.linuxCNCServer.jogStop(self.selected_axis());
            }
            event.preventDefault();
        };
        self.plus_pressed = function(data, event) {
            var multiplier = 1;
            if(self.selected_axis() > 2) {
                multiplier = 180;
            }
            if(self.step() == 0) {
                self.linuxCNCServer.jogCont(self.selected_axis(), multiplier*self.linuxCNCServer.jog_speed_fast());
            } else {
                self.linuxCNCServer.jogIncr(self.selected_axis(), self.step());
            }
            event.preventDefault();
        };
        self.plus_released = function(data, event) {
            if(self.step() == 0) {
                self.linuxCNCServer.jogStop(self.selected_axis());
            } 
            event.preventDefault();
        };

        this.getTemplate = function() {
            return template;
        };

        this.getNls = function() {
            return nls;
        };

        this.initialize = function( Panel ) {
            if(self.Panel == null) {
                self.Panel = Panel;
                $('.switch', self.Panel.getJQueryElement()).bootstrapSwitch();
            }
        };


    };

    return ViewModel;
});
