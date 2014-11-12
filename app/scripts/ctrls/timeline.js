vde.App.controller('TimelineCtrl', function($scope, $rootScope, $window, timeline, $timeout, Vis) {
  var t = function() {
    return {
      length: timeline.timeline.length,
      idx: timeline.currentIdx,
      fileName: timeline.fileName
    };
  };

  $scope.$watch(function() {
    return t();
  }, function() {
    $scope.timeline = t();
  }, true);

  var files = function() {
    $scope.files = [];
    timeline.files().getAll().then(function(files) {
      $scope.files = files.map(function(f) { return f.fileName; });
    });
  };

  files();
  $scope.tMdl = {fileName: null};

  $scope.new = function() { 
    vde.Vis.reset(); 

    // Allow angular to detect the reset, before new blank layer/pipeline is added
    $timeout(function() {
      var g = new Vis.marks.Group("layer_0");
      $rootScope.activeGroup = $rootScope.activeLayer = g;

      var p = new Vis.Pipeline("pipeline_0");
      $rootScope.activePipeline = p;

      vde.Vis.render();
    }, 1)
  };

  $scope.showOpen = function() {
    $rootScope.fileOpenPopover = !$rootScope.fileOpenPopover;
    $rootScope.fileSavePopover = false;
    $rootScope.exportPopover   = false;
  };

  $scope.open = function(name) {
    timeline.open(name).then(function() {
      $rootScope.fileOpenPopover = false;
    });
  };

  $scope.save = function() {
    if(!$scope.timeline.fileName) {
      $rootScope.fileOpenPopover = false;
      $rootScope.fileSavePopover = !$rootScope.fileSavePopover;
      $rootScope.exportPopover   = false;
    } else {
      timeline.fileName = $scope.timeline.fileName;
      timeline.store().then(function() {
        $rootScope.fileSavePopover = false;
        $timeout(function() { files(); }, 100);
      });
    }
  };

  $scope.finishEditing = function() {
    Vis.render().then(function(spec) {
      $window.opener.postMessage({
        timeline: timeline.timeline,
        spec: spec
      }, $window.location.origin);
      $window.close();
    });
  };

  $rootScope.closeTimelinePopovers = function() {
    $rootScope.fileOpenPopover = false;
    $rootScope.fileSavePopover = false;
    $rootScope.exportPopover   = false;
  };

  $scope.delete = function(name) {
    timeline.delete(name).then(function() {
      $timeout(function() { files(); }, 100);
    });
  };

  $scope.undo = function() { timeline.undo(); };
  $scope.redo = function() { timeline.redo(); };

  $window.addEventListener('keydown', function(keyEvent) {
    var keyCode = keyEvent.keyCode;

    if (keyEvent.metaKey === true || keyEvent.ctrlKey === true) {
      if (keyCode === 89) {
        $scope.$apply(function() { $scope.redo(); });
        keyEvent.preventDefault();
        return false;
      }
      else if (keyCode === 90) {
        //special case (CTRL-SHIFT-Z) does a redo (on a mac for example)
        if (keyEvent.shiftKey === true) {
          $scope.$apply(function() { $scope.redo(); });
        }
        else {
          $scope.$apply(function() { $scope.undo(); });
        }
        keyEvent.preventDefault();
        return false;
      }
    }
  });
});