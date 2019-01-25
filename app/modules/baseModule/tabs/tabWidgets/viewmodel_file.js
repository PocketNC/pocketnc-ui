define(function(require) {

    var template = require('text!./view_file.html');
    var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext, privateContext) {

    	var self = this;
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
        self.context = moduleContext;
        self.privateContext = privateContext;

        self.currentLine = 0;
        self.currentLineByte = 0;

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }

        self.fileListTableCallback = function (key, options) {
            if (key === 'set_line') {
                self.setMotionLineToSelected();
            } else if (key === 'goto_line' )
            {
                self.updateDisplayLine(self.linuxCNCServer.ui_motion_line());
            }
        }

		this.initialize = function( Panel ) {
            if (_.isNull( self.Panel ))
            {
                self.Panel = Panel;
                var data = [  ];

                self.motionLineUpdateInProgress = false;

                self.fileListTable = self.Panel.getJQueryElement().find(".FileListTable");
                self.fileListTable.handsontable({
                    data: data,
                    stretchH: "last",
                    rowHeaders: true,
                    colWidths: 900,
                    height: 400,
                    startCols: 1,
                    outsideClickDeselects: false,
                    columns: [
                        {
                            readOnly: true
                        }
                    ],

                    afterSelectionEnd : function(r, c, r2, c2){
                        if (self.motionLineUpdateInProgress)
                            self.privateContext.notify("FileViewLineSelected",r);
                        else
                            self.privateContext.notify("FileViewLineSelected",r+1);
                    },

                    contextMenu: {
                        callback: _.bind(self.fileListTableCallback,self),

                        items: {
                            "set_line": {
                                name: nls.SetLine,
                                disabled: function () {
                                    return self.linuxCNCServer.RmtRunning() || (self.fileListTable.handsontable('getSelected')[0] === self.linuxCNCServer.ui_motion_line() );
                                }
                            },
                            "goto_line": {
                                name: nls.GotoCurrentLine
                            }
                        }
                    }

                });

                // monitor file contents
                self.linuxCNCServer.vars.file_content.data.subscribe( self.updateData );
                self.linuxCNCServer.ui_motion_line.subscribe( function(newval){ self.motionLineUpdateInProgress=true; self.updateDisplayLine(newval); self.motionLineUpdateInProgress=false; });
                


                self.fileListTable.dblclick( function(){ self.setMotionLineToSelected(); } );

                setTimeout( function() {
                    self.updateData(self.linuxCNCServer.vars.file_content.data());
                    self.updateDisplayLine(self.linuxCNCServer.ui_motion_line());
                },2);

            }

		};

        this.setMotionLineToSelected = function()
        {
            if (!self.linuxCNCServer.RmtRunning())
                self.linuxCNCServer.ui_motion_line(self.fileListTable.handsontable('getSelected')[0]);

        }

        self.fileId = 0;
        self.fileContent = []; 
        this.updateData = function( newfilecontent )
        {
            let shouldRender = false;
            
            if(self.fileId !== newfilecontent.id){
                self.fileId = newfilecontent.id;
                self.fileContent = [];
                shouldRender = true;
            }
            let isData = (newfilecontent.data) && (newfilecontent.data.length > 0); 
            if(isData){  
                let newarr = _.zip(newfilecontent.data.split('\n'));
                let isLastLineBroken = self.fileContent.length > 0 && self.fileContent[self.fileContent.length - 1] !== "";  
                if( isLastLineBroken ){
                    self.fileContent[self.fileContent.length - 1] = [self.fileContent[self.fileContent.length - 1] + newarr.shift()];
                }
                self.fileContent = self.fileContent.concat( newarr );
            }

            var ht = self.fileListTable.handsontable('getInstance');
            shouldRender = shouldRender || (ht.rowOffset() > (ht.countRows() - 100));
            shouldRender = shouldRender || newfilecontent.isEnd;
            if(shouldRender){
                ht.loadData(self.fileContent);
                ht.render();
            }
            $("#jog_focus_handler").focus();
        }

        this.updateDisplayLine = function( lineNum )
        {
            var ht = self.fileListTable.handsontable('getInstance');

            // if file component is visible
            if(ht.rootElement[0].offsetParent) {
                ht.selectCell(lineNum,0);

                if (ht.countRows() > lineNum+4)
                {
                    ht.view.scrollViewport({row: lineNum+4, col: 0});
                    ht.view.wt.draw(true); //these two lines are needed to fix scrolling viewport when cell dimensions are significantly bigger than assumed by Walkontable
                    ht.view.scrollViewport({row: lineNum+4, col: 0});
                }

                $("#jog_focus_handler").focus();
            }
        }



	};

	return ViewModel;
});
