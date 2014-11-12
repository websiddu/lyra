vde.Vis.transforms.Facet = (function() {
  var facet = function(pipelineName) {
    vde.Vis.Transform.call(this, pipelineName, 'facet', 'Group By', ['keys', 'sort', 'layout']);

    // Because facets perform structural transformations, fork
    // whatever pipeline this is assigned to.
    this.forkPipeline = true;

    this.properties.keys = [];

    this._groups = {};
    this._transforms = [];

    // Instead of registering post_spec callbacks on each of the primitives
    // (marks, axes), we'll now just register one on vis.pre_group.
    // Here, we'll do all the re-arranging into subgroups that we want, and
    // let spec gen run like normal.
    vde.Vis.callback.register('pipeline.post_spec', this, this.pipelinePostSpec);
    vde.Vis.callback.register('group.pre_spec', this, this.groupPreSpec);
    vde.Vis.callback.register('group.post_spec', this, this.groupPostSpec);
    vde.Vis.callback.register('mark.post_spec', this, this.markPostSpec);

    return this;
  };

  facet.prototype = new vde.Vis.Transform();
  var prototype = facet.prototype;

  facet.layout_overlap = 'Overlap';
  facet.layout_horiz = 'Horizontal';
  facet.layout_vert = 'Vertical';

  facet.dropzone_horiz = 'facetLayoutHoriz';
  facet.hint_horiz     = 'Grouped Horizontally';
  facet.dropzone_vert  = 'facetLayoutVert';
  facet.hint_vert      = 'Grouped Vertically';

  prototype.destroy = function() {
    vde.Vis.callback.deregister('pipeline.post_spec',  this);
    vde.Vis.callback.deregister('group.pre_spec', this);
    vde.Vis.callback.deregister('group.post_spec', this);
    vde.Vis.callback.deregister('mark.post_spec',  this);

    if(this.pipeline()) {
      for(var layerName in vde.Vis.groups) {
        var layer = vde.Vis.groups[layerName];
        if(this.groupName() in layer.marks) {
          var group = layer.marks[this.groupName()];
          for(var markName in group.marks) {
            group.marks[markName].groupName = null;
            layer.marks[markName] = group.marks[markName];
            layer.markOrder.push(markName);
          }

          for(var axisName in group.axes) {
            group.axes[axisName].groupName = null;
            layer.axes[axisName] = group.axes[axisName];
          }

          for(var scaleName in group.scales)
            if(!(scaleName in layer.scales)) layer.scales[scaleName] = group.scales[scaleName];

          delete layer.marks[this.groupName()];
          layer.markOrder.splice(layer.markOrder.indexOf(this.groupName()), 1);
        }
      }

      this.pipeline().forkName = null;
      this.pipeline().forkIdx  = null;
    }
  };

  prototype.spec = function() {
    var spec = {type: 'facet'};
    if(this.properties.keys.length)
      spec.keys = this.properties.keys.map(function(k) { return k.spec(); });

    return spec;
  };

  prototype.groupName = function() { return this.pipelineName + '_facet'; };

  prototype.bindProperty = function(prop, opts) {
    var field = opts.field, props = this.properties;
    if(!field) return; // Because this makes negatory sense.
    if(!(field instanceof vde.Vis.Field)) field = new vde.Vis.Field(field);

    if(prop == 'keys') {
      if(!props.keys) props.keys = [];
      props.keys.push(field);
    } else this.properties[prop] = field;
  };

  prototype.pipelinePostSpec = function(opts) {
    if(!this.pipeline() || !this.pipeline().forkName) return;
    if(this.properties.keys.length === 0) return;
    if(opts.item.name != this.pipelineName) return;

    // Grab the transforms that must work within each facet, and them to our group
    var self = this;
    this._transforms = [];
    opts.item.transforms.forEach(function(t) { if(!t.onFork()) self._transforms.push(t.spec()); });
  };

  prototype.groupPreSpec = function(opts) {
    if(!this.pipeline() || !this.pipeline().forkName) return;
    if(this.properties.keys.length === 0) return;

    if(opts.item.isLayer()) {
      this._layer(opts.item);
    } else if(opts.item.name == this.groupName()) {
      opts.spec.from.data = this.pipeline().forkName;
    }
  };

  // Once all the specs have been generated, see if any marks/scales have been
  // marked to inherit their data from the facet group.
  prototype.groupPostSpec = function(opts) {
    if(!this.pipeline() || !this.pipeline().forkName) return;
    if(this.properties.keys.length === 0) return;
    if(opts.item.name != this.groupName()) return;

    var i;
    for(i = 0; i < opts.spec.marks.length; i++) {
      var m = opts.spec.marks[i];
      if(m.from.data == this.pipelineName) delete m.from.data;
    }

    for(i = 0; i < opts.spec.scales.length; i++) {
      var s = opts.spec.scales[i];
      if(s.inheritFromGroup) {
        delete s.domain.from;
        delete s.inheritFromGroup;
      }
    }
  };

  prototype.markPostSpec = function(opts) {
    if(!this.pipeline() || !this.pipeline().forkName) return;
    if(this.properties.keys.length === 0) return;
    if(opts.item.pipelineName != this.pipelineName) return;
    if(opts.item.type == 'group') return;

    var spec = opts.spec;
    if(!spec.from.transform) spec.from.transform = [];
    spec.from.transform = spec.from.transform.concat(this._transforms);
    spec.from['lyra.role'] = 'fork';
    spec.from['lyra.for'] = this.pipelineName;
    if(opts.item.oncePerFork) {
      spec.from.transform.push({
        type: 'filter',
        test: 'index == 0'
      });
    }
  };

  prototype.group = function(layer) {
    var group = layer.marks[this.groupName()];
    if(!group) {
      group = new vde.Vis.marks.Group(this.groupName(), layer.name);
      group.displayName = 'Group By: ' +
          this.properties.keys.map(function(f) { return f.name; }).join(", ");
      group.pipelineName = this.pipelineName;
      group.doLayout(this.properties.layout || facet.layout_horiz); // By default split horizontally
    }

    return group;
  }

  prototype._addToGroup = function(type, item, layer) {
    var group = this.group(layer);

    item.layerName = layer.name;
    item.groupName = this.groupName();
    group[type][item.name] = item;

    // Don't delete scales from their layer because we may want an axis in the layer
    // rather than the group. Instead, when we get the spec gen the scales within the
    // group, we just toss out spec.domain.data for the group, and vega automatically
    // uses the nearest scale.
    if(type != 'scales') delete layer[type][item.name];
    if(type == 'axes') group._axisCount++;
    if(type == 'marks') {
      layer.markOrder.splice(layer.markOrder.indexOf(item.name), 1);
      group.markOrder.push(item.name);
      group._markCount++;
    }

    // Since we're re-arranging things, we need to make sure angular's scope is maintained.
    var scope = vde.iVis.ngScope();
    if(scope.activeVisual == item) {
      window.setTimeout(function() { scope.toggleVisual(item, null, true); }, 100);
    }
  };

  prototype._layer = function(layer) {
    for(var markName in layer.marks) {
      var mark = layer.marks[markName];
      if(mark.type == 'group' && mark.name == this.groupName()) continue;
      if(!mark.pipeline() ||
          (mark.pipeline() && mark.pipeline().name != this.pipeline().name)) continue;

      this._addToGroup('marks', mark, layer);
    }

    for(var axisName in layer.axes) {
      var axis = layer.axes[axisName];
      if(!axis.pipeline() ||
          (axis.pipeline() && axis.pipeline().name != this.pipeline().name)) continue;

      // Let's try to be smart about this. If we're in a layout mode, only pick axis that
      // a user would expect to be replicated.
      var addToGroup = ((this.properties.layout == facet.layout_horiz && axis.properties.type == 'x') ||
          (this.properties.layout == facet.layout_vert && axis.properties.type == 'y'));

      if(addToGroup) this._addToGroup('axes', axis, layer);
    }

    // We want to move any spatial scales from the layer into the group EXCEPT for any
    // scales the group's properties are using.
    var group = layer.marks[this.groupName()] || {};
    var groupScales = vg.keys(group.properties).map(function(p) {
      var prop =  group.properties[p];
      return prop.scale ? prop.scale.name : '';
    });

    for(var scaleName in layer.scales) {
      var scale = layer.scales[scaleName];
      if(!(scale.range() instanceof vde.Vis.Field)) continue;
      if(groupScales.indexOf(scale.name) != -1) continue;
      if(scale.range().name == 'width' || scale.range().name == 'height')
        this._addToGroup('scales', scale, layer);
    }
  };

  return facet;
})();