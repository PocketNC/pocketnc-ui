define(function(require) {

    var template = require('text!./view_tooling.html');
    var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.panel = null;
        self.settings = moduleContext.getSettings();
        self.linuxCNCServer = self.settings.linuxCNCServer;

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }

		this.initialize = function( Panel ) {
            if (_.isNull( self.panel ))
            {
                self.panel = Panel;
                var actionRenderer = function(instance, td, row, col, prop, value, cellProperties) {
                    var b = document.createElement("button");
                    b.className = "btn btn-default";
                    b.style.width = "85%";
                    b.innerHTML = "Measure Tool " + (row+1);

                    td.innerHTML = "";
                    td.appendChild(b);

                    b.onclick = function() {
                        console.log("here");
                        self.linuxCNCServer.loadTool(row+1);
                    };
                }

                // var data = self.linuxCNCServer.vars.file_content.data().split('\n');
                var data = [[0,0,0, ""]];

                self.toolListTable = $("#ToolListTable", self.panel.getJQueryElement());
                self.toolListTable.handsontable({

                    stretchH: "all",
                    rowHeaders: true,
                    //colHeaders: ["Tool Number", "Z Offset", "X Offset", "Diameter", "Front Angle", "Back Angle", "Orientation"],
                    colHeaders: [ "Z Offset", "Diameter", "Description", "" ],
                    height: 255,
                    startCols: 4,
                    outsideClickDeselects: false,
                    columns: [ { data: 0 },
                               { data: 1 },
                               { data: 2 },
                               { data: "action", renderer: actionRenderer } ],

                    afterChange: function(changes, source){
                        if (!_.isArray(changes))
                            return;

                        var ht = self.toolListTable.handsontable('getInstance');

                        changes.forEach( function(change) {
                            try {

                                var row = change[0];
                                var col = change[1];
                                var oldVal = change[2];
                                var newVal = change[3];

                                if (source == "edit")
                                    if (col == 0) {
                                        ht.setDataAtCell(row,col, parseFloat(newVal.toString()).toFixed(5), "update" );
                                    } else if(col < 2) {
                                        ht.setDataAtCell(row,col, parseFloat(newVal.toString()).toFixed(5), "update" );
                                    } else {
                                        ht.setDataAtCell(row,col, newVal.toString(), "update" );
                                    }
                                else
                                {
                                    var rowDat = ht.getDataAtRow(row);
                                    self.linuxCNCServer.setToolTableFull( row+1,self.linuxCNCServer.DisplayUnitsToMachineUnits(rowDat[0]),0,self.linuxCNCServer.DisplayUnitsToMachineUnits(rowDat[1]),0,0,0);
                                    self.settings.persist.ToolTableDescriptions()[row] = rowDat[2];
                                    self.settings.persist.ToolTableDescriptions.valueHasMutated();
                                }
                            } catch(ex){
                                console.log(ex);
                            };
                        })
                    }
                });

                var ht = self.toolListTable.handsontable('getInstance');
                if(self.linuxCNCServer.RmtManualInputAllowed() && self.linuxCNCServer.AllHomed()) {
                    ht.updateSettings({
                        readOnly: false, // make table cells read-only
                        contextMenu: true, // disable context menu to change things
                        disableVisualSelection: false, // prevent user from visually selecting
                        manualColumnResize: false, // prevent dragging to resize columns
                        manualRowResize: false, // prevent dragging to resize rows
                        comments: false // prevent editing of comments
                    });
                } else {
                    ht.updateSettings({
                        readOnly: true, // make table cells read-only
                        contextMenu: false, // disable context menu to change things
                        disableVisualSelection: true, // prevent user from visually selecting
                        manualColumnResize: false, // prevent dragging to resize columns
                        manualRowResize: false, // prevent dragging to resize rows
                        comments: false // prevent editing of comments
                    });
                }

                // monitor file contents
                self.linuxCNCServer.vars.tool_table.data.subscribe( self.updateData );
                self.linuxCNCServer.RmtManualInputAllowed.subscribe(self.updateEditable);
                self.linuxCNCServer.AllHomed.subscribe(self.updateEditable);
            }

            setTimeout( function() {
                self.updateData(self.linuxCNCServer.vars.tool_table.data());
            },2);

		};

        this.updateEditable = function() { 
            var ht = self.toolListTable.handsontable('getInstance');
            if(self.linuxCNCServer.RmtManualInputAllowed() && self.linuxCNCServer.AllHomed()) {
                ht.updateSettings({
                    readOnly: false, // make table cells read-only
                    contextMenu: true, // disable context menu to change things
                    disableVisualSelection: false, // prevent user from visually selecting
                    manualColumnResize: false, // prevent dragging to resize columns
                    manualRowResize: false, // prevent dragging to resize rows
                    comments: false // prevent editing of comments
                });
            } else {
                ht.updateSettings({
                    readOnly: true, // make table cells read-only
                    contextMenu: false, // disable context menu to change things
                    disableVisualSelection: true, // prevent user from visually selecting
                    manualColumnResize: false, // prevent dragging to resize columns
                    manualRowResize: false, // prevent dragging to resize rows
                    comments: false // prevent editing of comments
                });
            }
        }

        this.updateData = function( newfilecontent )
        {
            var ht = self.toolListTable.handsontable('getInstance');

            var desc = self.settings.persist.ToolTableDescriptions();

            var dat = [];
            newfilecontent.forEach( function(d,idx){ 
                if(idx > 0) {
                    dat.push( [ self.linuxCNCServer.MachineUnitsToDisplayUnitsLinear(d[3]).toFixed(5), self.linuxCNCServer.MachineUnitsToDisplayUnitsLinear(d[10]).toFixed(5), desc[idx-1] || "" ] ); 
                }
            });
            ht.loadData(dat);

            var rh = [];
            var rc = ht.countRows();
            for (idx = 1; idx <= rc; idx++)
                rh.push(idx.toString());
            ht.updateSettings({rowHeaders: rh});

            self.resize();

            ht.render();
        }

        self.resize = function(event){
            try {

                var height_of_tool_table_area = $("#TOOLING_INNER_WRAP",self.panel.getJQueryElement()).height() -
                    ( $("#TOOLING_CONTENT",self.panel.getJQueryElement()).offset().top - $("#TOOLING_INNER_WRAP",self.panel.getJQueryElement()).offset().top ) - 0;

                if (height_of_tool_table_area < 100)
                    height_of_tool_table_area = 100;

                var ht = self.toolListTable.handsontable('getInstance');
                ht.updateSettings({height: height_of_tool_table_area});

            } catch (ex){  };
        }

        $(window).resize( _.throttle(self.resize, 100 ) );

	};

	return ViewModel;
});
