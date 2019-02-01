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
        self.downloadProgress = ko.observable(0);
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
                self.linuxCNCServer.vars.file.data.subscribe( self.requestFileContent );
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

        //This id will be set everytime the G code program opened in Rockhopper changes, and the file's contents begin downloading to the UI
        self.fileId = 0;
        self.fileContent = [];

        self.linuxCNCServer.vars.downloadProgress = ko.observable(0);
        
        this.requestFileContent = (function(){
            
            var listener = null, chunkSize = 100000;
            var id, fileSize; 

            var listenerFactory = function(_id, _chunkSize, _fileSize){
                var id = _id;
                var chunkSize = _chunkSize;
                var fileSize = _fileSize;
                
                var idx = 0;
                var isEnd = false;
                
                return function(){
                    var msg = JSON.parse(event.data);
                    if((msg.id === id) && (msg.code === "?OK")){
                        if(msg.data.length === chunkSize){
                            idx += chunkSize;
                            self.downloadProgress((100 * idx / fileSize).toFixed(0));
                            self.linuxCNCServer.downloadChunkGCode(id, idx, chunkSize);
                        }
                        else { 
                            isEnd = true;
                            self.linuxCNCServer.socket.removeEventListener('message', listener);
                        }
                        self.updateData({ data: msg.data, id: id, isEnd: isEnd });
                    }
                }
            }

            var startDownload = function() {
                if(listener){
                    self.linuxCNCServer.socket.removeEventListener('message', listener);
                }

                listener = listenerFactory(id, chunkSize, fileSize);
                self.updateData({ data: "", id: id, isEnd: false, percent: 0 });
                self.linuxCNCServer.socket.addEventListener('message', listener);
                self.linuxCNCServer.downloadChunkGCode(id, 0, chunkSize);
            }

            return function() {
                id = Date.now();
                var sizeListener = function(){
                    var msg = JSON.parse(event.data);
                    if((msg.id === id) && (msg.code === "?OK")){
                        fileSize = parseInt(msg.data);
                        self.linuxCNCServer.socket.removeEventListener('message', sizeListener);
                        startDownload();
                    }
                }
                self.linuxCNCServer.socket.addEventListener('message', sizeListener);
                self.linuxCNCServer.sendCommand(id, "program_get_size", [])
            }
        })();

        this.updateData = function( newfilecontent )
        {
            if(newfilecontent.id < self.fileId){
                return;
            }
            var shouldRender = false;
            
            if(self.fileId !== newfilecontent.id && newfilecontent.id !== undefined){
                self.fileId = newfilecontent.id;
                self.fileContent = [];
                shouldRender = true;
                $('#download-spinner').css('visibility', 'visible');
            }
            
            var isData = (newfilecontent.data) && (newfilecontent.data.length > 0);
            if(isData){  
                if(self.fileContent.length === 0)
                    shouldRender = true;
            
                var newarr = _.zip(newfilecontent.data.split('\n'));
                if(self.fileContent.length > 0)
                    self.fileContent[self.fileContent.length - 1] = [self.fileContent.pop()[0] + newarr.shift()[0]];
                
                var i;
                for(i = 0; i < newarr.length; i++){
                    self.fileContent.push(newarr[i]);
                }
            }

            var ht = self.fileListTable.handsontable('getInstance');
            
            if(newfilecontent.isEnd){
                shouldRender = true;
                $('#download-spinner').css('visibility', 'hidden');
            }

            shouldRender = shouldRender || (ht.rowOffset() > (ht.countRows() - 100));
            
            if(shouldRender){
                ht.loadData(self.fileContent);
                ht.render();
                $("#jog_focus_handler").focus();
            }
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
