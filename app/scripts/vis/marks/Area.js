vde.Vis.marks.Area = (function() {
  var area = function(name, layerName, groupName) {
    vde.Vis.Mark.call(this, name, layerName, groupName);

    this.type = 'area';

    this.properties = {
      x: {value: 0},
      y: {value: 0},
      y2: {value: 0},

      interpolate: {value: 'monotone'},
      tension: {value: 0},

      fill: {value: '#4682b4'},
      fillOpacity: {value: 1},
      stroke: {value: '#000000'},
      strokeWidth: {value: 0.25}
    };

    vde.Vis.callback.register('vis.post_spec', this, function(opts) {
      return vde.Vis.marks.Line.prototype.dummyData.call(this, opts);
    });

    this.connectors = {'point': {}};

    return this;
  };

  area.prototype = new vde.Vis.Mark();
  var prototype  = area.prototype;
  var line = vde.Vis.marks.Line.prototype;

  prototype.spec = function() {
    line.dummySpec.call(this);
    return vde.Vis.Mark.prototype.spec.call(this);
  };

  prototype.defaults = function(prop) {
    if(prop == 'y') {
      this.properties.y2 = {
        scale: this.properties.y.scale,
        value: 0
      };
    }

    return line.defaults.call(this, prop);
  };

  prototype.selected = function() { return line.selected.call(this); };
  prototype.helper = function(property) { return line.helper.call(this, property); };
  prototype.propertyTargets = function(connector, showGroup) {
    return line.propertyTargets.call(this, connector, showGroup);
  };

  prototype.coordinates = function(connector, item, def) {
    return line.coordinates.call(this, connector, item, def);
  };

  prototype.spans = function(item, property) { return line.spans.call(this, item, property); };

  return area;
})();
